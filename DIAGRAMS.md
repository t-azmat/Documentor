# Documentor — UML Diagrams

> Last updated: March 8, 2026 — reflects all code changes including fine-tuned T5,
> two-column PDF extraction, AISemanticCitationMatcher, two-pass citation matching,
> multi-feature AI detection, side-by-side grammar diff, and grammar training pipeline.

## Table of Contents
1. [Use Case Diagram](#1-use-case-diagram)
2. [Sequence — User Registration](#2-sequence-diagram--user-registration)
3. [Sequence — User Login (Email & Social)](#3-sequence-diagram--user-login)
4. [Sequence — Document Upload & Processing (incl. Two-Column PDF)](#4-sequence-diagram--document-upload--processing)
5. [Sequence — Grammar Enhancement (Side-by-Side Diff)](#5-sequence-diagram--grammar-enhancement)
6. [Sequence — Grammar Model Fine-Tuning](#6-sequence-diagram--grammar-model-fine-tuning)
7. [Sequence — Plagiarism Detection](#7-sequence-diagram--plagiarism-detection)
8. [Sequence — AI Content Detection](#8-sequence-diagram--ai-content-detection)
9. [Sequence — Citation Extraction & AI Matching](#9-sequence-diagram--citation-extraction--ai-matching)
10. [Sequence — Document Formatting (AI Pipeline)](#10-sequence-diagram--document-formatting-ai-pipeline)
11. [Sequence — Section Detection](#11-sequence-diagram--document-section-detection)
12. [Sequence — Subscription & Payment](#12-sequence-diagram--subscription--payment)
13. [Component Architecture Diagram](#13-component-architecture-diagram)
14. [Data Flow — Citation Two-Pass Matching](#14-data-flow--citation-two-pass-matching)

---

## 1. Use Case Diagram

> **Actors**: User (Student/Researcher), Admin, Stripe, OAuth Provider, Python NLP Service

```mermaid
flowchart TB
    classDef actor fill:#dae8fc,stroke:#6c8ebf,color:#000,font-weight:bold
    classDef usecase fill:#d5e8d4,stroke:#82b366,color:#000
    classDef ext fill:#fff2cc,stroke:#d6b656,color:#000,font-weight:bold

    U(["👤 User\nStudent / Researcher"]):::actor
    AD(["🛡️ Admin"]):::actor
    STRIPE(["💳 Stripe"]):::ext
    OAUTH(["🔑 OAuth Provider\nGoogle / Facebook / Apple"]):::ext
    NLP(["🐍 Python NLP Service\nFlask :5001"]):::ext

    subgraph SYSTEM ["Documentor Application"]
        subgraph AUTH_UC ["Authentication"]
            UC_REG("Register Account"):::usecase
            UC_LOGIN("Login with Email"):::usecase
            UC_SOC("Social Login"):::usecase
            UC_RESET("Reset Password"):::usecase
        end

        subgraph DOC_UC ["Document Management"]
            UC_UP("Upload Document\nPDF / DOCX / TXT / LaTeX"):::usecase
            UC_VIEW("View / Edit Document"):::usecase
            UC_DL("Download Document"):::usecase
            UC_DEL("Delete Document"):::usecase
            UC_PROJ("Manage Projects"):::usecase
            UC_DASH("View Dashboard Stats"):::usecase
        end

        subgraph NLP_UC ["NLP Analysis"]
            UC_GRAM("Enhance Grammar\nFine-tuned flan-t5-base"):::usecase
            UC_PLAG("Detect Plagiarism\nTF-IDF + all-MiniLM-L6-v2"):::usecase
            UC_AI("Detect AI Content\nMulti-feature + GPT-2"):::usecase
            UC_CIT("Extract & Match Citations\nRegex + AISemanticCitationMatcher"):::usecase
            UC_SEC("Detect Document Sections\nGaussianNB + Regex"):::usecase
        end

        subgraph FMT_UC ["Formatting & Export"]
            UC_FMT("Apply Citation Style\nAPA/MLA/IEEE/Chicago/Harvard"):::usecase
            UC_AIFMT("AI-Powered Formatting\n4-step pipeline"):::usecase
            UC_EXP("Export PDF / DOCX / LaTeX"):::usecase
        end

        subgraph SUB_UC ["Subscription"]
            UC_PLANS("Browse Pricing Plans"):::usecase
            UC_SUB("Subscribe / Upgrade Plan"):::usecase
            UC_CANCEL("Cancel Subscription"):::usecase
        end

        subgraph ADMIN_UC ["Administration"]
            UC_TPLS("Manage Style Templates"):::usecase
            UC_LOGS("View System Logs"):::usecase
            UC_USERS("Manage Users"):::usecase
        end
    end

    U --> UC_REG
    U --> UC_LOGIN
    U --> UC_SOC
    U --> UC_RESET
    U --> UC_UP
    U --> UC_VIEW
    U --> UC_DL
    U --> UC_DEL
    U --> UC_PROJ
    U --> UC_DASH
    U --> UC_GRAM
    U --> UC_PLAG
    U --> UC_AI
    U --> UC_CIT
    U --> UC_SEC
    U --> UC_FMT
    U --> UC_AIFMT
    U --> UC_EXP
    U --> UC_PLANS
    U --> UC_SUB
    U --> UC_CANCEL

    AD --> UC_TPLS
    AD --> UC_LOGS
    AD --> UC_USERS

    UC_SOC -->|"uses"| OAUTH
    UC_SUB -->|"initiates payment"| STRIPE
    UC_CANCEL -->|"cancels via"| STRIPE

    UC_GRAM -->|"calls"| NLP
    UC_PLAG -->|"calls"| NLP
    UC_AI -->|"calls"| NLP
    UC_CIT -->|"calls"| NLP
    UC_SEC -->|"calls"| NLP
    UC_AIFMT -->|"calls"| NLP
```

---

## 2. Sequence Diagram — User Registration

```mermaid
sequenceDiagram
    actor User
    participant SG as Signup.jsx
    participant API as api.js
    participant BE as Node Backend :3001
    participant DB as MongoDB
    participant AS as authStore (Zustand)

    User->>SG: Fill name, email, password
    SG->>API: authAPI.register({name, email, password})
    API->>BE: POST /api/auth/register
    BE->>BE: Hash password (bcrypt)
    BE->>DB: User.create({name, email, passwordHash})
    DB-->>BE: saved user document
    BE->>BE: Sign JWT (userId, email)
    BE-->>API: {token, user}
    API-->>SG: {token, user}
    SG->>AS: login(user, token)
    AS->>AS: Persist token to localStorage
    SG-->>User: Redirect to /dashboard
```

---

## 3. Sequence Diagram — User Login

```mermaid
sequenceDiagram
    actor User
    participant LP as Login.jsx
    participant FB as Firebase OAuth
    participant API as api.js
    participant BE as Node Backend :3001
    participant DB as MongoDB
    participant AS as authStore (Zustand)

    alt Email / Password Login
        User->>LP: Enter email + password
        LP->>API: authAPI.login(email, password)
        API->>BE: POST /api/auth/login
        BE->>DB: User.findOne({email})
        DB-->>BE: user document or null
        alt Invalid credentials
            BE-->>LP: 401 Unauthorized
            LP-->>User: Show error toast
        else Valid credentials
            BE->>BE: bcrypt.compare(password, hash)
            BE->>BE: Sign JWT
            BE-->>API: {token, user}
            API-->>LP: {token, user}
            LP->>AS: login(user, token)
            AS->>AS: Persist to localStorage
            LP-->>User: Redirect to /dashboard
        end

    else Social Login (Google / Facebook / Apple)
        User->>LP: Click social provider button
        LP->>FB: signInWithPopup(provider)
        FB-->>LP: {uid, email, displayName, photoURL}
        LP->>API: authAPI.socialLogin(providerData)
        API->>BE: POST /api/auth/social
        BE->>DB: User.findOneAndUpdate (upsert by email)
        DB-->>BE: user document
        BE->>BE: Sign JWT
        BE-->>API: {token, user}
        API-->>LP: {token, user}
        LP->>AS: login(user, token)
        LP-->>User: Redirect to /dashboard
    end
```

---

## 4. Sequence Diagram — Document Upload & Processing

> Includes **two-column IEEE PDF** detection via `_find_column_gutter()` / `_split_by_column()`

```mermaid
sequenceDiagram
    actor User
    participant UD as UploadDocument.jsx
    participant DS as documentService.js
    participant BE as Node Backend :3001
    participant FE as fileExtractorService.js
    participant PY as Python Flask :5001
    participant FX as file_extractor.py
    participant DB as MongoDB

    User->>UD: Select file + optionally assign to project
    UD->>DS: documentAPI.upload(formData)
    DS->>BE: POST /api/documents/upload (multipart/form-data)
    BE->>FE: extractText(file, mimetype)
    FE->>PY: POST /api/extract/file (multipart)

    PY->>FX: extract_structured(file, mimetype)

    alt PDF file
        FX->>FX: pdfplumber.open() — use_text_flow=False (raw positional)
        FX->>FX: extract_words(x_tolerance=3, y_tolerance=3) per page
        FX->>FX: _find_column_gutter(words, page_width)
        alt Two-column layout detected (gutter gap ≥ 10pt)
            FX->>FX: _split_by_column(words, gutter)
            Note over FX: full_width words first (headings / captions),<br/>then left_col (top→bottom),<br/>then right_col (top→bottom)
        else Single-column
            FX->>FX: Sort words by (round(top,1), x0)
        end
        FX->>FX: Join words into paragraph blocks
    else DOCX file
        FX->>FX: python-docx — extract paragraphs + styles
    else LaTeX / TXT
        FX->>FX: Raw text read
    end

    FX-->>PY: {text, blocks[], metadata, wordCount, pages}
    PY-->>FE: extracted content
    FE-->>BE: extracted content
    BE->>DB: Document.create({userId, title, filePath, content, metadata})
    DB-->>BE: saved document
    BE-->>DS: document object
    DS-->>UD: document
    UD-->>User: Success toast + document appears in list
```

---

## 5. Sequence Diagram — Grammar Enhancement

> Results tab shows **side-by-side diff**: left = original, right = highlighted enhanced text

```mermaid
sequenceDiagram
    actor User
    participant GEP as GrammarEnhancerPage.jsx
    participant GE as GrammarEnhancer.jsx
    participant API as api.js
    participant BE as Node Backend :3001
    participant PY as Python Flask :5001
    participant T5 as GrammarEnhancer (fine-tuned flan-t5-base)

    User->>GEP: Paste or load text + select mode
    Note over GEP: Modes: balanced / academic / formal / casual
    GEP->>GE: render GrammarEnhancer component
    GE->>API: grammarAPI.enhance({text, mode})
    API->>BE: POST /api/grammar/enhance
    BE->>PY: POST /api/grammar/enhance {text, mode}

    PY->>T5: Check grammar-finetuned/ checkpoint exists
    alt Fine-tuned checkpoint found (grammar-finetuned/config.json)
        T5->>T5: Load ./grammar-finetuned/ (Seq2Seq fine-tuned on grammarly/coedit)
    else No checkpoint
        T5->>T5: Load google/flan-t5-base (base model)
    end

    T5->>T5: _preprocess_text() — normalise whitespace + expand contractions
    T5->>T5: split_into_sentences() (NLTK / regex)
    loop Per sentence
        T5->>T5: Build prompt: ENHANCEMENT_MODES[mode] + sentence
        T5->>T5: T5ForConditionalGeneration.generate() (max_length=256)
        T5->>T5: _calculate_confidence() — Jaccard similarity original∩enhanced
    end
    T5->>T5: Stitch sentences back, compute diff
    T5-->>PY: {enhanced, original, changes[], qualityScore, issuesByType}
    PY-->>BE: result
    BE-->>API: result
    API-->>GE: result

    GE->>GE: Build docDiff from changes[] array (textDiff.js)

    GE-->>GEP: enhanced text + docDiff + stats

    Note over GEP: Results tab — two-column grid (md:grid-cols-2)
    GEP-->>User: Left panel: original text (plain)<br/>Right panel: diff highlights<br/>(red strikethrough = deleted, green underline = inserted)<br/>+ stats panel below
```

---

## 6. Sequence Diagram — Grammar Model Fine-Tuning

> `train_grammar.py` — fine-tunes `google/flan-t5-base` on `grammarly/coedit`

```mermaid
sequenceDiagram
    participant CLI as Developer (CLI)
    participant TG as train_grammar.py
    participant HF as HuggingFace Hub
    participant DS as grammarly/coedit dataset
    participant TR as Seq2SeqTrainer
    participant FS as ./grammar-finetuned/

    CLI->>TG: python train_grammar.py [--max_train_samples N]
    TG->>HF: AutoTokenizer.from_pretrained("google/flan-t5-base")
    HF-->>TG: tokenizer (SentencePiece BPE)
    TG->>HF: AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-base")
    HF-->>TG: model (250M params, loaded to CUDA)
    TG->>TG: model.gradient_checkpointing_enable()

    TG->>DS: load_dataset("grammarly/coedit")
    DS-->>TG: train + validation splits
    TG->>TG: filter(task in {gec, fluency, formal, coherence, ...})
    TG->>TG: make_preprocess_fn(tokenizer, max_input=128, max_target=128)
    TG->>TG: dataset.map(preprocess, batched=True)
    Note over TG: inputs: CATEGORY_PREFIX[task] + src<br/>labels: tgt (pad tokens → -100)

    TG->>TG: DataCollatorForSeq2Seq(tokenizer, pad_to_multiple_of=8)
    TG->>TG: Adafactor(scale_parameter=True, relative_step=True)
    TG->>TG: AdafactorSchedule(optimizer)
    TG->>TG: make_compute_metrics(tokenizer)
    Note over TG: Metrics: BLEU (sacrebleu), Exact Match, Token Accuracy

    TG->>TR: Seq2SeqTrainer(model, args, train_ds, val_ds,<br/>processing_class=tokenizer, compute_metrics)

    loop Each epoch (default: 3)
        TR->>TR: Train on train_ds (batch=2, grad_accum=8 → eff=16)
        TR->>TR: Evaluate on val_ds (predict_with_generate=True)
        TR->>TR: Decode predictions → compute BLEU, EM, Token Acc
        TR-->>CLI: "Eval → BLEU: XX.XX | Exact Match: XX.XX% | Token Acc: XX.XX%"
        TR->>FS: Save checkpoint if eval_loss improved
    end

    TR->>FS: trainer.save_model(./grammar-finetuned/)
    FS-->>CLI: checkpoint saved

    TR->>TR: trainer.evaluate() — final metrics
    TR-->>CLI: "=== Final Evaluation Metrics ===" (loss, BLEU, EM, Token Acc)

    Note over FS,CLI: GrammarEnhancer auto-detects grammar-finetuned/config.json<br/>on next service start — no config change needed
```

---

## 7. Sequence Diagram — Plagiarism Detection

```mermaid
sequenceDiagram
    actor User
    participant PC as PlagiarismChecker.jsx
    participant PY as Python Flask :5001
    participant SPD as SemanticPlagiarismDetector
    participant MINI as all-MiniLM-L6-v2
    participant TFIDF as TF-IDF Vectorizer
    participant BERT as paraphrase-MiniLM-L6-v2

    User->>PC: Upload document + add source texts
    PC->>PY: POST /api/plagiarism/studio {doc_text, sources[]}

    loop For each source text
        PY->>TFIDF: TfidfVectorizer.fit_transform([doc_chunk, src_chunk])
        TFIDF-->>PY: cosine_similarity score (lexical)

        PY->>BERT: SentenceTransformer.encode([doc_chunk, src_chunk])
        BERT-->>PY: semantic cosine similarity score

        PY->>PY: combined = average(tfidf_score, bert_score)
    end

    PY->>SPD: detect_plagiarism(doc_text, sources)
    SPD->>SPD: _split_into_chunks(doc_text, chunk_size=2 sentences)
    loop Per chunk
        SPD->>MINI: _get_embedding(chunk) — cached in embedding_cache
        MINI-->>SPD: 384-dim L2-normalised vector
        SPD->>SPD: cosine_similarity(chunk_emb, source_embs)
        SPD->>SPD: Record match if similarity ≥ threshold (0.75)
    end
    SPD->>SPD: Compute overall score + risk band (None/Low/Medium/High/Critical)
    SPD-->>PY: {plagiarismScore, plagiarismLevel, matches[], stats}

    PY-->>PC: {tfidf_results, bert_results, semantic_results, overall}
    PC-->>User: Similarity scores + matched passages highlighted + risk badge
```

---

## 8. Sequence Diagram — AI Content Detection

> Multi-feature heuristic scorer. GPT-2 perplexity is **supplementary only** (±5 pts max).

```mermaid
sequenceDiagram
    actor User
    participant AD as PlagiarismChecker.jsx (AI tab)
    participant PY as Python Flask :5001
    participant SA as studio_ai_detect()
    participant GPT2 as GPT-2 LMHeadModel (lazy-loaded)

    User->>AD: Paste text to analyse
    AD->>PY: POST /api/ai-detect {text}

    PY->>SA: studio_ai_detect(text)

    SA->>SA: Guard: len(text) < 80 → return "Too short to analyze"

    SA->>SA: Feature 1 — Sentence burstiness (weight: ±35 pts)
    Note over SA: Split on [.!?], filter sentences ≥ 4 words<br/>burstiness = (σ - μ) / (σ + μ)<br/>low/negative → AI-uniform; high positive → human-varied

    SA->>SA: Feature 2 — Coefficient of Variation (weight: ±20 pts)
    Note over SA: CV = σ / μ of sentence lengths<br/>CV < 0.25 → strongly AI; CV > 0.70 → human

    SA->>SA: Feature 3 — Mean sentence length (weight: ±10 pts)
    Note over SA: ChatGPT sweet spot: 14–26 words

    SA->>SA: Feature 4 — Filler phrase density (weight: +15 pts)
    Note over SA: 28 ChatGPT signature phrases counted<br/>("delve into", "it is important to note", "furthermore", etc.)

    SA->>SA: Feature 5 — Type-Token Ratio (vocabulary diversity)
    Note over SA: TTR = unique_words / total_words (context only)

    SA->>GPT2: _gpt2_perplexity(text) — supplementary ±5 pts
    Note over GPT2: GPT2LMHeadModel.from_pretrained("gpt2") lazy-loaded<br/>cross-entropy over token sequence → perplexity<br/>NOTE: ChatGPT text has GPT-2 perplexity ~100–300 (NOT low)
    GPT2-->>SA: perplexity score (or None if unavailable)

    SA->>SA: Score = 50 + Σ weighted feature contributions
    SA->>SA: Clamp score to [0, 100]
    SA->>SA: Map to label:
    Note over SA: ≥75 → Likely AI-generated<br/>≥55 → Possibly AI-generated<br/>≥40 → Uncertain<br/>≥25 → Probably human-written<br/><25 → Likely human-written

    SA-->>PY: {score, label, perplexity, features{burstiness, sentence_cv,<br/>mean_sentence_len, filler_density, ttr}}
    PY-->>AD: result
    AD-->>User: Score gauge + label badge + per-feature breakdown card
```

---

## 9. Sequence Diagram — Citation Extraction & AI Matching

> Two-pass matching: **Pass 1** = regex/IEEE numeric; **Pass 2** = `AISemanticCitationMatcher` fallback.
> New endpoint: `POST /api/citations/match-ai`

```mermaid
sequenceDiagram
    actor User
    participant CM as CitationManager.jsx
    participant NLP as pythonNlpService.js
    participant BE as Node Backend :3001
    participant PY as Python Flask :5001
    participant CIT as citation.py

    User->>CM: Upload document file
    CM->>NLP: citationAPI.extractFromFile(file)
    NLP->>BE: POST /api/citations/extract (multipart)
    BE->>PY: POST /api/citations/extract (text)

    %% --- Style detection + extraction ---
    PY->>CIT: CitationManager.detect_citation_style(text)
    Note over CIT: Score APA/MLA/IEEE/Chicago patterns<br/>IEEE boosted 1.5× when no author-date found<br/>Majority vote across all citations
    CIT-->>PY: detected_style

    PY->>CIT: extract_in_text_citations(text)
    CIT-->>PY: citations[] with {text, author, year, context, style_type}

    %% --- Reference extraction (robust parser) ---
    PY->>CIT: extract_references_section(text)
    CIT->>CIT: Pass 1 — _REF_HEADER regex (case-insensitive, Roman-numeral prefix)
    alt Header found on its own line
        CIT->>CIT: Extract lines after header, merge continuation lines
    else Header inline with [1] (_INLINE_HEADER)
        CIT->>CIT: _parse_ieee_block() — split collapsed [N] entries from one block
    else No header found (Pass 2 fallback)
        CIT->>CIT: Scan full doc for last [1], extract sequential [1]…[n]
        CIT->>CIT: Validate sequentiality (≥3 consecutive entries)
    end
    CIT->>CIT: Build ref_by_number dict (ref_number → list_index)
    CIT-->>PY: references[] with {text, ref_number, author}

    %% --- Two-pass citation matching ---
    PY->>CIT: match_citations_to_references(citations, references)

    Note over CIT: Pass 1 — Regex / Numeric matching
    loop Per citation
        alt IEEE style [N] / [N, M, ...]
            CIT->>CIT: Split all numbers, resolve each via ref_by_number[N]
            CIT->>CIT: Store extras in citation.extra_ref_indices
        else Author-date (APA / MLA / Harvard)
            CIT->>CIT: Token overlap between citation author and reference first author
        end
    end

    Note over CIT: Pass 2 — AI Semantic fallback (unmatched citations only)
    CIT->>CIT: AISemanticCitationMatcher.fit(references)
    Note over CIT: Encode all reference texts once<br/>all-MiniLM-L6-v2 → 384-dim L2-normalised vectors
    loop Per unmatched citation
        CIT->>CIT: _build_query(citation) — author + year + context (marker stripped)
        CIT->>CIT: Encode query → dot product with ref_embeddings = cosine sim
        CIT->>CIT: Best match if score ≥ MATCH_THRESHOLD (0.30)
    end

    CIT-->>PY: matched_pairs[] + unmatched_citations[]
    PY-->>BE: {citations, references, matched_pairs, detectedStyle, count}
    BE-->>NLP: result
    NLP-->>CM: result
    CM-->>User: Citation library + reference map + unmatched list

    Note over User,CM: ── New endpoint: AI match only ──
    User->>CM: Trigger AI semantic match
    CM->>NLP: POST /api/citations/match-ai {text}
    NLP->>PY: POST /api/citations/match-ai
    PY->>CIT: Full two-pass matching (as above)
    PY-->>CM: {matches[{citation_text, ref_text, score, matched, query}],<br/>unmatched_citations[], total, matched_count, unmatched_count}
    CM-->>User: Per-citation match details with confidence scores
```

---

## 10. Sequence Diagram — Document Formatting (AI Pipeline)

```mermaid
sequenceDiagram
    actor User
    participant FP as FormatDocument.jsx
    participant PY as Python Flask :5001
    participant FX as file_extractor.py
    participant DC as document_chunker.py
    participant CC as citation_converter.py
    participant LG as latex_generator.py
    participant BD as app.py _build_docx()

    User->>FP: Upload document + select style
    Note over FP: Styles: APA / MLA / IEEE / Chicago / Harvard
    FP->>PY: POST /api/formatting/ai-format {file, style}

    PY->>FX: extract_structured(file, mimetype)
    Note over FX: PDF: two-column gutter detection per page<br/>DOCX: python-docx paragraph styles<br/>TXT: raw text
    FX-->>PY: {text, blocks[], title}

    PY->>DC: chunk_blocks(blocks)
    DC->>DC: _detect_boundaries() + _is_heading_line() heuristic
    DC->>DC: _infer_level() per heading
    DC->>DC: _detect_references_in_blocks() — bottom-up ref scan
    DC-->>PY: flat_chunks[{heading, text, section_type, level}]

    PY->>CC: convert_citations(flat_chunks, target_style)
    CC->>CC: detect_style() — IEEE/APA/MLA/Chicago/Harvard
    CC->>CC: _parse() per reference entry → normalised record
    CC->>CC: _render_<style>() for target style
    CC-->>PY: converted_chunks (citations rewritten to target style)

    PY->>DC: build_tree(flat_chunks=converted_chunks)
    DC->>DC: Stack-based nesting algorithm
    DC-->>PY: document_tree{title, abstract, sections[], references[]}

    PY->>LG: generate(title, authors, abstract, section_tree, style)
    LG->>LG: _render_section_node() recursive rendering
    LG-->>PY: latex_source (.tex string)

    PY->>BD: _build_docx(sections, style)
    BD->>BD: Apply _STYLE_MARGINS per style
    BD->>BD: Per-style heading formatting
    Note over BD: APA: L1 centred bold, L2 left bold, L3 bold-italic<br/>IEEE: L1 centred small-caps, L2 left italic<br/>Chicago: L1 centred bold, L2 centred italic
    BD->>BD: Add page numbers (APA: header right / others: footer centre)
    BD->>BD: Apply hanging indent on references
    BD-->>PY: docx bytes

    PY-->>FP: {plain_sections, latex, citation_stats, warnings}
    FP-->>User: Preview panel + Download buttons (PDF / DOCX / LaTeX)
```

---

## 11. Sequence Diagram — Document Section Detection

```mermaid
sequenceDiagram
    actor User
    participant SD as SectionDetector.jsx
    participant PY as Python Flask :5001
    participant DSD as section_detector.py (GaussianNB)

    User->>SD: Paste or load document text
    SD->>PY: POST /api/sections/detect {text, hint}

    PY->>DSD: detect_sections(text)

    DSD->>DSD: Regex boundary detection (HEADING_PATTERNS)
    Note over DSD: Patterns matched for 7 types:<br/>abstract, introduction, methodology,<br/>results, discussion, conclusion, references

    loop Per detected section block
        DSD->>DSD: _extract_features(text, section_type)
        Note over DSD: Features: keyword_count, word_count,<br/>sentence_count, uppercase_ratio, citation_count
        DSD->>DSD: GaussianNB.predict_proba(feature_vector)
        DSD->>DSD: Assign label with highest probability
    end

    DSD->>DSD: validate_structure(sections)
    Note over DSD: Check completeness — all 7 canonical sections present?
    DSD-->>PY: {sections[], documentType, confidence, completeness_score, missing[]}

    PY-->>SD: result
    SD-->>User: Section map + completeness score + missing section warnings
```

---

## 12. Sequence Diagram — Subscription & Payment

```mermaid
sequenceDiagram
    actor User
    participant PR as Pricing.jsx
    participant API as api.js
    participant BE as Node Backend :3001
    participant STRIPE as Stripe API
    participant DB as MongoDB
    participant AS as authStore (Zustand)

    User->>PR: Browse plans (Free / Premium / Team)
    User->>PR: Click Subscribe on desired plan

    PR->>API: subscriptionAPI.createCheckout({planId})
    API->>BE: POST /api/subscriptions/create-checkout
    BE->>STRIPE: stripe.checkout.sessions.create(priceId, metadata)
    STRIPE-->>BE: {session_id, checkout_url}
    BE-->>API: {checkout_url}
    API-->>PR: {checkout_url}
    PR-->>User: Redirect to Stripe Checkout page

    User->>STRIPE: Complete payment
    STRIPE->>BE: POST /api/subscriptions/webhook (checkout.session.completed)
    BE->>BE: Verify Stripe webhook signature
    BE->>DB: User.findByIdAndUpdate set subscription {plan, status, expiry}
    DB-->>BE: updated user

    Note over User,AS: User returns to app after payment
    User->>PR: Redirect back to /dashboard
    PR->>API: subscriptionAPI.getCurrentSubscription()
    API->>BE: GET /api/subscriptions/current
    BE->>DB: User.findById (populate subscription)
    DB-->>BE: subscription object
    BE-->>API: {plan, status, features, limits}
    API-->>PR: subscription
    PR->>AS: updateSubscription(subscription)
    AS-->>User: Dashboard reflects new plan features and limits
```

---

## 13. Component Architecture Diagram

```mermaid
flowchart TB
    classDef frontend fill:#dae8fc,stroke:#6c8ebf
    classDef backend fill:#d5e8d4,stroke:#82b366
    classDef python fill:#fff2cc,stroke:#d6b656
    classDef db fill:#f8cecc,stroke:#b85450
    classDef ext fill:#e1d5e7,stroke:#9673a6

    subgraph FE ["Frontend — React 18 + Vite + Tailwind CSS"]
        direction TB
        APP(App.jsx + React Router):::frontend
        subgraph PAGES ["Pages"]
            PG_DASH(Dashboard):::frontend
            PG_DOC(Documents):::frontend
            PG_GE(GrammarEnhancerPage\nSide-by-side diff results tab):::frontend
            PG_PL(Plagiarism / AI Detect):::frontend
            PG_FMT(FormatDocument):::frontend
            PG_CIT(Citations):::frontend
            PG_PROJ(Projects):::frontend
        end
        subgraph COMPS ["Key Components"]
            C_GE(GrammarEnhancer.jsx\ntextDiff + docDiff):::frontend
            C_PC(PlagiarismChecker.jsx):::frontend
            C_CIT(CitationManager.jsx):::frontend
            C_FMT(DocumentFormatter.jsx):::frontend
            C_SD(SectionDetector.jsx):::frontend
        end
        SVC_A(api.js — Axios):::frontend
        STORE(authStore.js — Zustand):::frontend
    end

    subgraph NODE ["Node.js / Express Backend :3001"]
        direction TB
        MW_AUTH(authMiddleware\nJWT verify):::backend
        MW_PLAN(requirePlan\nSubscription gate):::backend
        subgraph CTRL ["Controllers"]
            CTRL_AUTH(authController):::backend
            CTRL_DOC(documentController):::backend
            CTRL_GRAM(grammarController):::backend
            CTRL_PLAG(plagiarismController):::backend
            CTRL_CIT(citationController... proxy):::backend
            CTRL_FMT(documentController... format):::backend
        end
        SVC_FE(fileExtractorService.js):::backend
        MODELS(User / Document / Project\nMongoose models):::backend
    end

    subgraph PY ["Python Flask NLP Service :5001"]
        direction TB
        subgraph ALGO ["Algorithms"]
            A1(GrammarEnhancer\nfine-tuned flan-t5-base):::python
            A2(SemanticPlagiarismDetector\nall-MiniLM-L6-v2):::python
            A3(DocumentFormattingEngine\nparse-and-render rules):::python
            A4(DocumentSectionDetector\nGaussianNB + regex):::python
        end
        subgraph SUPP ["Supplementary"]
            CIT_MOD(citation.py\nCitationManager\nAISemanticCitationMatcher\nextract_references_section):::python
            FX_MOD(file_extractor.py\n_find_column_gutter\n_split_by_column):::python
            AI_DET(studio_ai_detect\nburstiness + CV + fillers + TTR + GPT-2):::python
            TG(train_grammar.py\nSeq2SeqTrainer + BLEU/EM/TokenAcc):::python
        end
        subgraph PIPELINE ["Formatting Pipeline"]
            DC(document_chunker.py):::python
            CC(citation_converter.py):::python
            LG(latex_generator.py):::python
        end
    end

    subgraph STORE_EXT ["External Storage / Services"]
        MDB[(MongoDB Atlas)]:::db
        FS[(File System\n/uploads/)]:::db
        HF([HuggingFace Hub\nflan-t5-base\nall-MiniLM-L6-v2\ngpt2]):::ext
        STRIPE([Stripe]):::ext
        FIREBASE([Firebase Auth]):::ext
    end

    APP --> PAGES
    APP --> COMPS
    COMPS --> SVC_A
    SVC_A --> NODE
    NODE --> MW_AUTH --> CTRL
    CTRL --> MODELS --> MDB
    CTRL --> SVC_FE --> PY
    CTRL_GRAM --> PY
    CTRL_PLAG --> PY
    CTRL_CIT --> PY
    CTRL_FMT --> PY
    PY --> A1
    PY --> A2
    PY --> A3
    PY --> A4
    PY --> CIT_MOD
    PY --> FX_MOD
    PY --> AI_DET
    A3 --> PIPELINE
    A1 --> HF
    A2 --> HF
    AI_DET --> HF
    TG --> HF
    NODE --> STRIPE
    FE --> FIREBASE
```

---

## 14. Data Flow — Citation Two-Pass Matching

```mermaid
flowchart TD
    classDef input fill:#dae8fc,stroke:#6c8ebf
    classDef proc fill:#d5e8d4,stroke:#82b366
    classDef decision fill:#fff2cc,stroke:#d6b656
    classDef output fill:#f8cecc,stroke:#b85450
    classDef ai fill:#e1d5e7,stroke:#9673a6

    IN_TEXT([Input: Raw Document Text]):::input

    STYLE[detect_citation_style\nMajority vote — IEEE/APA/MLA/Chicago/Harvard]:::proc
    EXTRACT_CIT[extract_in_text_citations\nRegex patterns per style]:::proc
    REF_EXTRACT[extract_references_section]:::proc

    subgraph REF_PARSE ["Reference Extraction (3 strategies)"]
        R1{_REF_HEADER found\non own line?}:::decision
        R2{Header inline\nwith bracket 1\n_INLINE_HEADER?}:::decision
        R3[_parse_ieee_block\nSplit collapsed entries on bracket N]:::proc
        R4[Full-doc fallback\nFind last bracket 1\nExtract sequential block]:::proc
        R5[Normal line-by-line extraction\nMerge continuation lines]:::proc
        REFNUM[Build ref_by_number dict\nref_number → list_index]:::proc
    end

    PASS1{Pass 1 — Regex/Numeric}:::decision

    subgraph P1 ["Pass 1: IEEE / Author-Date"]
        IEEE_MATCH[IEEE bracket N\nResolve ALL numbers\nExtras → extra_ref_indices]:::proc
        APA_MATCH[Author-date\nToken overlap match]:::proc
    end

    MATCHED1{All citations\nmatched?}:::decision

    subgraph P2 ["Pass 2: AI Semantic Fallback"]
        FIT[AISemanticCitationMatcher.fit\nEncode all refs once\nall-MiniLM-L6-v2 384-dim]:::ai
        QUERY[_build_query\nauthor + year + context sentence\n(marker stripped)]:::ai
        ENCODE[Encode query\ndot product = cosine sim]:::ai
        THRESH{score ≥ 0.30?}:::decision
        MATCHED_AI([Matched with confidence score]):::output
        UNMATCHED([Surfaced as unmatched]):::output
    end

    RESULT([Final result\nmatched_pairs + unmatched_citations\ntotal / matched / unmatched counts]):::output

    IN_TEXT --> STYLE --> EXTRACT_CIT
    IN_TEXT --> REF_EXTRACT --> R1
    R1 -->|Yes| R5 --> REFNUM
    R1 -->|No| R2
    R2 -->|Yes| R3 --> REFNUM
    R2 -->|No| R4 --> REFNUM

    EXTRACT_CIT --> PASS1
    REFNUM --> PASS1
    PASS1 -->|IEEE| IEEE_MATCH
    PASS1 -->|Author-date| APA_MATCH
    IEEE_MATCH --> MATCHED1
    APA_MATCH --> MATCHED1
    MATCHED1 -->|Yes — all matched| RESULT
    MATCHED1 -->|No — unmatched remain| FIT
    FIT --> QUERY --> ENCODE --> THRESH
    THRESH -->|Yes| MATCHED_AI --> RESULT
    THRESH -->|No| UNMATCHED --> RESULT
```
