import streamlit as st
from transformers import GPT2Tokenizer, GPT2LMHeadModel
import nltk
from nltk.util import ngrams
from collections import Counter
from nltk.tokenize import word_tokenize
import string
import plotly.express as px
import torch

tokenizer = GPT2Tokenizer.from_pretrained("gpt2")
model = GPT2LMHeadModel.from_pretrained("gpt2")


def calculate_perplexity(text):
    """Calculate a perplexity-like score using the AI detector model."""
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
    
    # Use the model's logits for classification confidence as a proxy for perplexity
    logits = outputs.logits
    probabilities = torch.nn.functional.softmax(logits, dim=-1)
    
    # Calculate entropy as a perplexity measure
    entropy = -torch.sum(probabilities * torch.log(probabilities + 1e-9), dim=-1)
    perplexity_score = torch.exp(entropy).item()
    
    return perplexity_score * 1000  # Scale for better interpretability

def calculate_burstiness(text):
    """Calculate burstiness based on repeated bigram patterns."""
    tokens = word_tokenize(text)
    tokens = [token for token in tokens if token not in string.punctuation]
    bigrams = list(ngrams(tokens, 2))
    bigram_freq = Counter(bigrams)
    burstiness = sum(count for bigram, count in bigram_freq.items() if count > 1) / len(bigrams) if bigrams else 0
    return burstiness


def plot_top_repeated_phrases(text, top_n=10):
    tokens = word_tokenize(text)
    tokens = [token for token in tokens if token not in string.punctuation]
    bigrams = list(ngrams(tokens, 2))
    bigram_freq = Counter(bigrams)
    most_common_bigrams = bigram_freq.most_common(top_n)
    
    if most_common_bigrams:
        bigram_labels = [' '.join(bigram) for bigram, count in most_common_bigrams]
        counts = [count for bigram, count in most_common_bigrams]
        
        fig = px.bar(x=bigram_labels, y=counts, labels={'x': 'Bigrams', 'y': 'Frequency'}, title='Top Repeated Bigrams')
        st.plotly_chart(fig)
    else:
        st.write("No repeated bigrams found.")


st.set_page_config(page_icon="🔍", layout= "wide")
st.title("Plagiarism Detector")
text_area = st.text_area("Enter the text to check for plagiarism:", height=200)

if text_area is not None:
    if st.button("Analyze"):
        st.write("Analyzing the text for plagiarism...")
        # Here you would add your plagiarism detection logic
        col1, col2, col3 = st.columns([1,1,1])

        with col1:
            st.info("Your input text")
            st.success(text_area)

        with col2:
            st.info("Calculated Metrics")
            perplexity = calculate_perplexity(text_area)
            burstiness = calculate_burstiness(text_area)
            st.write(f"Perplexity: {perplexity:.2f}")
            st.write(f"Burstiness: {burstiness:.2f}")

            if perplexity > 3000 and burstiness < 0.2:
                st.error("High perplexity detected, which may indicate AI-generated content.")
            else:
                st.success("The text appears to be human-written based on the calculated metrics.")
        with col3:
            st.info("Top Repeated Phrases")
            plot_top_repeated_phrases(text_area)