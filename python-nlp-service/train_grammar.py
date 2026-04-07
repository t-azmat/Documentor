"""
train_grammar.py — Fine-tune flan-t5-base on grammarly/coedit
================================================================

Usage
-----
  # Full training run (~6-10 h on GTX 960 4 GB)
  python train_grammar.py

  # Quick smoke-test (500 train + 100 val samples, ~3 min)
  python train_grammar.py --max_train_samples 500 --max_eval_samples 100

  # Resume from a previous checkpoint
  python train_grammar.py --resume_from_checkpoint grammar-finetuned/checkpoint-XXXX

Hardware strategy for GTX 960 (4 GB VRAM, Maxwell)
---------------------------------------------------
  • AdaFactor optimizer  — no per-param second moments → saves ~1.5 GB vs AdamW
  • gradient_checkpointing — trades recompute for memory
  • per_device_train_batch_size = 2  +  gradient_accumulation_steps = 8
    → effective batch = 16
  • fp16 = False  — Maxwell has 1/32 fp16 throughput; fp32 is faster here
  • max_input / target length = 128  — keeps activation memory low

Output
------
  grammar-finetuned/          ← best checkpoint (loaded automatically by
                                 GrammarEnhancer when present)
"""

import argparse
import os
import logging
from typing import Optional

import numpy as np
import torch
from datasets import load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSeq2SeqLM,
    DataCollatorForSeq2Seq,
    Seq2SeqTrainer,
    Seq2SeqTrainingArguments,
)
from transformers.optimization import Adafactor, AdafactorSchedule
import sacrebleu

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_MODEL   = "google/flan-t5-base"
OUTPUT_DIR   = "./grammar-finetuned"
MAX_INPUT    = 128
MAX_TARGET   = 128

# Map CoEdit task → the ENHANCEMENT_MODES prefix used at inference time.
# grammarly/coedit uses lowercase task names in the 'task' column.
# This ensures the model is trained on exactly the prompts it will see later.
CATEGORY_PREFIX = {
    "gec":            "Fix grammar and spelling: ",          # grammatical error correction
    "fluency":        "Improve grammar and clarity: ",       # balanced mode
    "formal":         "Fix grammar and use formal language: ",
    "coherence":      "Improve grammar and academic tone: ",
    "simplification": "Improve grammar and clarity: ",
    "neutralization": "Improve grammar and clarity: ",
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Fine-tune flan-t5-base on grammarly/coedit")
    p.add_argument("--model_name",           default=BASE_MODEL)
    p.add_argument("--output_dir",           default=OUTPUT_DIR)
    p.add_argument("--num_train_epochs",     type=int,   default=3)
    p.add_argument("--per_device_batch",     type=int,   default=2)
    p.add_argument("--grad_accum_steps",     type=int,   default=8)
    p.add_argument("--max_input_length",     type=int,   default=MAX_INPUT)
    p.add_argument("--max_target_length",    type=int,   default=MAX_TARGET)
    p.add_argument("--max_train_samples",    type=Optional[int], default=None)
    p.add_argument("--max_eval_samples",     type=Optional[int], default=None)
    p.add_argument("--resume_from_checkpoint", default=None)
    p.add_argument("--seed",                 type=int,   default=42)
    return p.parse_args()

# ---------------------------------------------------------------------------
# Evaluation metrics
# ---------------------------------------------------------------------------

def make_compute_metrics(tokenizer):
    """
    Returns a compute_metrics function for Seq2SeqTrainer.

    Metrics reported per evaluation epoch
    ──────────────────────────────────────
    • BLEU  (sacreBLEU corpus-level) — standard MT/GEC quality measure
    • Exact Match (EM)               — fraction of sentences unchanged from reference
    • Token Accuracy                 — fraction of tokens correct across all predictions
    """
    def compute_metrics(eval_preds):
        predictions, labels = eval_preds

        # predictions may be raw logit arrays when generation is enabled
        if isinstance(predictions, tuple):
            predictions = predictions[0]

        # Convert token ids → strings, skip special / pad tokens
        decoded_preds = tokenizer.batch_decode(
            predictions, skip_special_tokens=True
        )

        # labels use -100 as ignore index; replace before decoding
        labels = np.where(labels != -100, labels, tokenizer.pad_token_id)
        decoded_labels = tokenizer.batch_decode(
            labels, skip_special_tokens=True
        )

        # Strip surrounding whitespace
        decoded_preds  = [p.strip() for p in decoded_preds]
        decoded_labels = [l.strip() for l in decoded_labels]

        # ── BLEU ────────────────────────────────────────────────────────
        # sacrebleu expects refs as list-of-lists (one list per reference)
        bleu_result = sacrebleu.corpus_bleu(
            decoded_preds, [decoded_labels]
        )
        bleu_score = round(bleu_result.score, 2)          # 0–100 scale

        # ── Exact Match ─────────────────────────────────────────────────
        exact_matches = sum(p == l for p, l in zip(decoded_preds, decoded_labels))
        em_score = round(exact_matches / max(1, len(decoded_preds)) * 100, 2)

        # ── Token Accuracy ──────────────────────────────────────────────
        # Tokenise predictions & labels (fresh, so we get aligned token ids)
        pred_ids  = tokenizer(decoded_preds,  truncation=True, max_length=MAX_TARGET, padding="max_length").input_ids
        label_ids = tokenizer(decoded_labels, truncation=True, max_length=MAX_TARGET, padding="max_length").input_ids
        pred_ids  = np.array(pred_ids)
        label_ids = np.array(label_ids)

        # Ignore positions where the reference is padding
        mask = label_ids != tokenizer.pad_token_id
        correct_tokens = ((pred_ids == label_ids) & mask).sum()
        total_tokens   = mask.sum()
        token_acc = round(correct_tokens / max(1, total_tokens) * 100, 2)

        logger.info(
            "Eval  →  BLEU: %.2f  |  Exact Match: %.2f%%  |  Token Acc: %.2f%%",
            bleu_score, em_score, token_acc,
        )

        return {
            "bleu":        bleu_score,
            "exact_match": em_score,
            "token_acc":   token_acc,
        }

    return compute_metrics


# ---------------------------------------------------------------------------
# Dataset helpers
# ---------------------------------------------------------------------------

def load_coedit(max_train: Optional[int], max_eval: Optional[int]):
    """Download grammarly/coedit and keep only relevant categories."""
    logger.info("Loading grammarly/coedit …")
    ds = load_dataset("grammarly/coedit")

    def keep_relevant(example):
        return example.get("task", "") in CATEGORY_PREFIX

    train = ds["train"].filter(keep_relevant)
    val   = ds["validation"].filter(keep_relevant)

    if max_train:
        train = train.select(range(min(max_train, len(train))))
    if max_eval:
        val = val.select(range(min(max_eval, len(val))))

    logger.info("Train rows: %d  |  Val rows: %d", len(train), len(val))
    return train, val


def make_preprocess_fn(tokenizer, max_input: int, max_target: int):
    """
    Return a tokenisation function suitable for dataset.map(batched=True).

    Input format:  "{prefix}{src}"
    Target format: "{tgt}"
    """
    def preprocess(batch):
        # Build prompted inputs
        inputs = [
            CATEGORY_PREFIX.get(cat, "Improve grammar and clarity: ") + src
            for cat, src in zip(batch["task"], batch["src"])
        ]
        targets = batch["tgt"]

        model_inputs = tokenizer(
            inputs,
            max_length=max_input,
            truncation=True,
            padding=False,
        )

        # T5 uses the same vocabulary for encoder and decoder — tokenize
        # targets with a plain call (no deprecated as_target_tokenizer needed).
        labels = tokenizer(
            targets,
            max_length=max_target,
            truncation=True,
            padding=False,
        )

        # Replace padding token id with -100 so loss ignores it
        model_inputs["labels"] = [
            [(tok if tok != tokenizer.pad_token_id else -100) for tok in label]
            for label in labels["input_ids"]
        ]
        return model_inputs

    return preprocess

# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def main():
    args = parse_args()

    logger.info("=== Grammar Fine-Tuning ===")
    logger.info("Base model   : %s", args.model_name)
    logger.info("Output dir   : %s", args.output_dir)
    logger.info("Epochs       : %d", args.num_train_epochs)
    logger.info("Batch/device : %d  (accum=%d → effective=%d)",
                args.per_device_batch, args.grad_accum_steps,
                args.per_device_batch * args.grad_accum_steps)
    logger.info("CUDA         : %s", torch.cuda.is_available())
    if torch.cuda.is_available():
        p = torch.cuda.get_device_properties(0)
        logger.info("GPU          : %s  (%.1f GB VRAM)", p.name, p.total_memory / 1e9)

    os.makedirs(args.output_dir, exist_ok=True)

    # ── Load tokeniser + model ──────────────────────────────────────────────
    logger.info("Loading tokeniser and model …")
    tokenizer = AutoTokenizer.from_pretrained(args.model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(args.model_name)

    # Gradient checkpointing — halves activation memory at the cost of ~20%
    # extra compute per backward pass (well worth it at 4 GB VRAM).
    model.gradient_checkpointing_enable()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cuda":
        model = model.to(device)
    logger.info("Model parameters: %.1f M", model.num_parameters() / 1e6)

    # ── Load & tokenise dataset ────────────────────────────────────────────
    train_raw, val_raw = load_coedit(args.max_train_samples, args.max_eval_samples)

    preprocess = make_preprocess_fn(tokenizer, args.max_input_length, args.max_target_length)

    logger.info("Tokenising train set …")
    train_ds = train_raw.map(
        preprocess,
        batched=True,
        desc="Tokenise train",
    )
    # Remove original text columns AFTER mapping so a silent map failure
    # doesn't strip all columns and leave an empty dataset.
    orig_train_cols = [c for c in train_raw.column_names if c in train_ds.column_names]
    if orig_train_cols:
        train_ds = train_ds.remove_columns(orig_train_cols)
    logger.info("Train dataset columns after tokenisation: %s", train_ds.column_names)

    logger.info("Tokenising validation set …")
    val_ds = val_raw.map(
        preprocess,
        batched=True,
        desc="Tokenise val",
    )
    orig_val_cols = [c for c in val_raw.column_names if c in val_ds.column_names]
    if orig_val_cols:
        val_ds = val_ds.remove_columns(orig_val_cols)
    logger.info("Val dataset columns after tokenisation: %s", val_ds.column_names)

    # ── Data collator ──────────────────────────────────────────────────────
    data_collator = DataCollatorForSeq2Seq(
        tokenizer=tokenizer,
        model=model,
        label_pad_token_id=-100,
        pad_to_multiple_of=8,
    )

    # ── Optimizer: AdaFactor ───────────────────────────────────────────────
    # AdaFactor stores only factored approximations of the second moment,
    # using O(n+m) memory instead of O(n*m) — critical for 4 GB VRAM.
    # scale_parameter=True + relative_step=True gives an LR schedule for free.
    optimizer = Adafactor(
        model.parameters(),
        scale_parameter=True,
        relative_step=True,
        warmup_init=True,
        lr=None,           # managed by the built-in schedule
    )
    lr_scheduler = AdafactorSchedule(optimizer)

    # ── TrainingArguments ──────────────────────────────────────────────────
    training_args = Seq2SeqTrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.num_train_epochs,
        per_device_train_batch_size=args.per_device_batch,
        per_device_eval_batch_size=4,
        gradient_accumulation_steps=args.grad_accum_steps,

        # Memory
        fp16=False,                  # Maxwell fp16 is 32× slower — skip it
        gradient_checkpointing=True,

        # Evaluation & saving
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        save_total_limit=2,          # keep only the 2 best checkpoints on disk

        # Generation — needed to produce decoded text for BLEU / EM / token-acc
        predict_with_generate=True,
        generation_max_length=MAX_TARGET,

        # Misc
        logging_steps=50,
        report_to="none",            # no wandb / tensorboard required
        seed=args.seed,
        dataloader_num_workers=0,    # 0 avoids multiprocessing tokenizer issues on Windows

        # Keep non-model columns; we strip them manually above.
        remove_unused_columns=False,

        # Disable the default AdamW so we can supply AdaFactor
        optim="adafactor",
    )

    # ── Trainer ───────────────────────────────────────────────────────────
    compute_metrics = make_compute_metrics(tokenizer)

    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        processing_class=tokenizer,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
        # Pass our AdaFactor + schedule so Trainer doesn't override them
        optimizers=(optimizer, lr_scheduler),
    )

    # ── Train ──────────────────────────────────────────────────────────────
    logger.info("Starting training …")
    trainer.train(resume_from_checkpoint=args.resume_from_checkpoint)

    # ── Save best model ────────────────────────────────────────────────────
    logger.info("Saving best model to %s …", args.output_dir)
    trainer.save_model(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)

    # ── Final evaluation report ────────────────────────────────────────────
    logger.info("Running final evaluation on validation set …")
    final_metrics = trainer.evaluate()
    logger.info("=== Final Evaluation Metrics ===")
    logger.info("  eval_loss    : %.4f",  final_metrics.get("eval_loss", float("nan")))
    logger.info("  BLEU         : %.2f",  final_metrics.get("eval_bleu", float("nan")))
    logger.info("  Exact Match  : %.2f%%", final_metrics.get("eval_exact_match", float("nan")))
    logger.info("  Token Acc    : %.2f%%", final_metrics.get("eval_token_acc", float("nan")))

    logger.info("Done.  Load the model in GrammarEnhancer by pointing")
    logger.info("MODEL_NAME to '%s' or just restart the service —", args.output_dir)
    logger.info("GrammarEnhancer auto-detects the fine-tuned checkpoint.")


if __name__ == "__main__":
    main()
