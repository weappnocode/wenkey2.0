"""
PDF Ingestion Script for RAG
Extracts text from a PDF, chunks it, generates embeddings via OpenAI,
and inserts into the Supabase knowledge_base table.

Usage:
  python scripts/ingest_pdf.py <pdf_path> --openai-key <key> --supabase-url <url> --supabase-key <service_role_key>

Or with environment variables:
  OPENAI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python scripts/ingest_pdf.py <pdf_path>
"""

import sys
import os
import json
import time
import argparse
import urllib.request
import urllib.error

try:
    import pypdf
except ImportError:
    print("ERROR: pypdf not installed. Run: pip install pypdf")
    sys.exit(1)


CHUNK_SIZE = 800       # characters per chunk
CHUNK_OVERLAP = 100    # overlap between chunks
EMBED_MODEL = "text-embedding-3-small"
BATCH_SIZE = 10        # embeddings per API call
SLEEP_BETWEEN_BATCHES = 0.5  # seconds


def extract_text_from_pdf(pdf_path: str) -> list[dict]:
    """Extract text page by page from PDF."""
    print(f"📄 Opening PDF: {pdf_path}")
    reader = pypdf.PdfReader(pdf_path)
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            pages.append({"page": i + 1, "text": text})
    print(f"   → {len(reader.pages)} pages total, {len(pages)} with text.")
    return pages


def chunk_text(pages: list[dict], chunk_size: int, overlap: int) -> list[dict]:
    """Split pages into overlapping chunks."""
    chunks = []
    for page_data in pages:
        text = page_data["text"]
        page_num = page_data["page"]
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end].strip()
            if chunk:
                chunks.append({
                    "content": chunk,
                    "metadata": {
                        "source": os.path.basename(sys.argv[1]),
                        "page": page_num
                    }
                })
            start += chunk_size - overlap
    print(f"✂️  Created {len(chunks)} chunks from {len(pages)} pages.")
    return chunks


def generate_embeddings_batch(texts: list[str], api_key: str) -> list[list[float]]:
    """Call OpenAI embeddings API for a batch of texts."""
    payload = json.dumps({"model": EMBED_MODEL, "input": texts}).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        },
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    return [item["embedding"] for item in data["data"]]


def insert_chunks(chunks: list[dict], supabase_url: str, service_role_key: str):
    """Insert chunks with embeddings into Supabase knowledge_base."""
    url = f"{supabase_url}/rest/v1/knowledge_base"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Prefer": "return=minimal"
    }
    success = 0
    errors = 0

    for chunk in chunks:
        payload = json.dumps({
            "content": chunk["content"],
            "metadata": chunk["metadata"],
            "embedding": chunk["embedding"]
        }).encode()
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                if resp.status in (200, 201):
                    success += 1
                else:
                    print(f"  ⚠️  Unexpected status: {resp.status}")
                    errors += 1
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f"  ❌ Insert error: {e.code} - {body[:200]}")
            errors += 1

    print(f"✅ Inserted: {success} | ❌ Errors: {errors}")
    return success, errors


def main():
    parser = argparse.ArgumentParser(description="Ingest PDF into Supabase knowledge_base for RAG.")
    parser.add_argument("pdf_path", help="Path to the PDF file.")
    parser.add_argument("--openai-key", default=os.environ.get("OPENAI_API_KEY"), help="OpenAI API key.")
    parser.add_argument("--supabase-url", default=os.environ.get("SUPABASE_URL", os.environ.get("VITE_SUPABASE_URL")), help="Supabase project URL.")
    parser.add_argument("--supabase-key", default=os.environ.get("SUPABASE_SERVICE_ROLE_KEY"), help="Supabase service role key.")
    args = parser.parse_args()

    if not os.path.isfile(args.pdf_path):
        print(f"ERROR: File not found: {args.pdf_path}")
        sys.exit(1)
    if not args.openai_key:
        print("ERROR: OPENAI_API_KEY not set. Use --openai-key or OPENAI_API_KEY env var.")
        sys.exit(1)
    if not args.supabase_url:
        print("ERROR: SUPABASE_URL not set. Use --supabase-url or SUPABASE_URL env var.")
        sys.exit(1)
    if not args.supabase_key:
        print("ERROR: SUPABASE_SERVICE_ROLE_KEY not set. Use --supabase-key or SUPABASE_SERVICE_ROLE_KEY env var.")
        sys.exit(1)

    print(f"\n🚀 Starting PDF ingestion pipeline\n{'='*50}")

    # 1. Extract text from PDF
    pages = extract_text_from_pdf(args.pdf_path)

    # 2. Chunk the text
    chunks = chunk_text(pages, CHUNK_SIZE, CHUNK_OVERLAP)

    # 3. Generate embeddings in batches
    print(f"\n🧠 Generating embeddings (model: {EMBED_MODEL}) ...")
    texts = [c["content"] for c in chunks]
    all_embeddings = []

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        print(f"   Batch {i // BATCH_SIZE + 1}/{(len(texts) + BATCH_SIZE - 1) // BATCH_SIZE} ({len(batch)} items)...", end=" ")
        try:
            embeddings = generate_embeddings_batch(batch, args.openai_key)
            all_embeddings.extend(embeddings)
            print("✅")
        except Exception as e:
            print(f"❌ Error: {e}")
            sys.exit(1)
        time.sleep(SLEEP_BETWEEN_BATCHES)

    for i, chunk in enumerate(chunks):
        chunk["embedding"] = all_embeddings[i]

    # 4. Insert into Supabase
    print(f"\n💾 Inserting {len(chunks)} chunks into Supabase knowledge_base ...")
    insert_chunks(chunks, args.supabase_url, args.supabase_key)

    print(f"\n🎉 Done! The PDF content is now searchable via RAG.")


if __name__ == "__main__":
    main()
