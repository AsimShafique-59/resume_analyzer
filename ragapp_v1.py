import os
from dotenv import load_dotenv
import PyPDF2
import streamlit as st
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone, ServerlessSpec
import google.generativeai as genai

import warnings

# Suppress all warnings
warnings.filterwarnings("ignore")

# --- Load secrets ---
load_dotenv()
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENV = os.getenv("PINECONE_ENV")
INDEX_NAME = os.getenv("INDEX_NAME")
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")

# --- Helper functions ---
def extract_text_from_pdf(pdf_path):
    text = ""
    with open(pdf_path, "rb") as file:
        reader = PyPDF2.PdfReader(file)
        for page in reader.pages:
            text += page.extract_text() or ""
    return text

def split_text(text, chunk_size=100, overlap=50):
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks

def pinecone_upsert(index, chunks, chunk_embeddings):
    ids = [f"chunk-{i}" for i in range(len(chunks))]
    vectors = list(zip(ids, chunk_embeddings, [{"text": c} for c in chunks]))
    index.upsert(vectors=vectors)

def get_index(client, index_name, embedding_dim):
    # Create if not exists
    if index_name not in client.list_indexes().names():
        client.create_index(
            name=index_name,
            dimension=embedding_dim,
            metric="cosine",
            spec=ServerlessSpec(cloud='aws', region='us-east-1')
        )
    return client.Index(index_name)

def rag_answer(question, model, index, gemini, top_k=3):
    query_emb = model.encode([question]).tolist()[0]
    results = index.query(
        vector=query_emb,
        top_k=top_k,
        include_metadata=True,
    )
    context = "\n".join([match['metadata']['text'] for match in results['matches']])
    prompt = f"""
You are a resume analyzer. Please read the context careful and answer the user query. 
Context:\n{context}\n\nQuestion: {question}\n\nAnswer:
    """
    response = gemini.generate_content(prompt)
    return response.text

# --- Streamlit UI ---
st.set_page_config(page_title="RAG App: Pinecone + Gemini", layout="wide")
st.title("RAG App: Pinecone + Gemini")
st.write("Ask questions about your uploaded PDF! Powered by Pinecone & Gemini.")

# -- SIDEBAR: File uploader
with st.sidebar:
    st.header("Upload PDF")
    uploaded_file = st.file_uploader("Choose a PDF file", type="pdf")
    st.info("If you don't upload a file, the app will use all PDFs in /docs/")

# --- File handling: save upload to docs/ if provided ---
docs_folder = "docs/"
os.makedirs(docs_folder, exist_ok=True)
uploaded_pdf_path = None

if uploaded_file:
    uploaded_pdf_path = os.path.join(docs_folder, uploaded_file.name)
    with open(uploaded_pdf_path, "wb") as f:
        f.write(uploaded_file.read())

# --- Gather all PDFs from docs/ ---
pdf_files = [f for f in os.listdir(docs_folder) if f.endswith('.pdf')]
if not pdf_files:
    st.error("No PDF found in docs/. Please upload one in the sidebar.")
    st.stop()

# --- Extract, chunk, and embed all PDFs ---
with st.spinner("Extracting, chunking, and embedding all PDFs in docs/..."):
    all_chunks = []
    for pdf_file in pdf_files:
        file_path = os.path.join(docs_folder, pdf_file)
        document_text = extract_text_from_pdf(file_path)
        chunks = split_text(document_text)
        all_chunks.extend(chunks)
    model = SentenceTransformer('all-MiniLM-L6-v2')
    all_embeddings = model.encode(all_chunks).tolist()

# --- Pinecone setup ---
pc = Pinecone(api_key=PINECONE_API_KEY)
embedding_dim = len(all_embeddings[0])
index = get_index(pc, INDEX_NAME, embedding_dim)

# --- Upsert to Pinecone (overwrite each run for demo) ---
with st.spinner("Uploading embeddings to Pinecone..."):
    pinecone_upsert(index, all_chunks, all_embeddings)

# --- Delete uploaded file after embedding (optional, only new uploads) ---
if uploaded_pdf_path and os.path.exists(uploaded_pdf_path):
    try:
        os.remove(uploaded_pdf_path)
    except Exception as e:
        st.warning(f"Could not remove uploaded file: {e}")

# --- Gemini setup ---
genai.configure(api_key=GOOGLE_API_KEY)
gemini = genai.GenerativeModel('gemini-2.0-flash-lite')

# --- Q&A in main area ---
st.subheader("Ask your question about the PDFs:")
question = st.text_input("Enter your question here:")
if st.button("Get Answer") and question:
    with st.spinner("Gemini is thinking..."):
        try:
            answer = rag_answer(question, model, index, gemini)
            st.markdown("**Answer:**")
            st.write(answer)
        except Exception as e:
            st.error(f"Error generating answer: {e}")
