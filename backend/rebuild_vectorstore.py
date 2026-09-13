"""
Fallback: rebuild ./chroma_db from scratch if the uploaded one won't load
(e.g. chromadb on-disk format version mismatch — see DEPLOY.md).

Reproduces the exact pipeline from CSC_583_NLP_Final_Project.ipynb:
title+content combined -> RecursiveCharacterTextSplitter(1000, 200) ->
OpenAIEmbeddings(text-embedding-3-small) -> Chroma persisted to CHROMA_DIR.

Cost: ~150k chunks x text-embedding-3-small ≈ $0.50-$1.00 in OpenAI usage.
Time: roughly 10-20 minutes depending on API rate limits.

Usage:
    export OPENAI_API_KEY=sk-...
    python rebuild_vectorstore.py --csv /path/to/cleantech_media_dataset_v3_2024-10-28.csv
"""

from __future__ import annotations

import argparse
import ast
import os

import pandas as pd
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="Path to cleantech_media_dataset_v3_2024-10-28.csv")
    parser.add_argument("--out", default="./chroma_db", help="Output directory for the Chroma store")
    parser.add_argument("--batch-size", type=int, default=1000)
    args = parser.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("Set OPENAI_API_KEY before running this script.")

    print(f"Loading {args.csv} ...")
    df = pd.read_csv(args.csv)
    print(f"Loaded {len(df):,} articles")

    df["content_clean"] = df["content"].apply(
        lambda x: " ".join(ast.literal_eval(x)) if isinstance(x, str) and x.startswith("[") else x
    )

    documents, metadatas = [], []
    for _, row in df.iterrows():
        text = f"Title: {row['title']}\n\nContent: {row['content_clean']}"
        documents.append(text)
        metadatas.append({
            "title": row["title"],
            "date": str(row["date"]),
            "author": str(row.get("author", "")),
            "url": row["url"],
            "domain": row["domain"],
        })
    print(f"Prepared {len(documents):,} documents")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000, chunk_overlap=200, length_function=len,
        separators=["\n\n", "\n", " ", ""],
    )

    chunks, chunk_metadatas = [], []
    for doc, metadata in zip(documents, metadatas):
        doc_chunks = splitter.split_text(doc)
        for chunk_idx, chunk in enumerate(doc_chunks):
            chunks.append(chunk)
            m = metadata.copy()
            m["chunk_id"] = chunk_idx
            m["total_chunks"] = len(doc_chunks)
            chunk_metadatas.append(m)
    print(f"Created {len(chunks):,} chunks from {len(documents):,} documents")

    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

    vectordb = None
    batch_size = args.batch_size
    for i in range(0, len(chunks), batch_size):
        end = min(i + batch_size, len(chunks))
        print(f"Embedding batch {i // batch_size + 1} / {(len(chunks) - 1) // batch_size + 1} "
              f"(chunks {i:,}-{end:,})")
        batch_chunks = chunks[i:end]
        batch_meta = chunk_metadatas[i:end]
        if vectordb is None:
            vectordb = Chroma.from_texts(
                texts=batch_chunks, embedding=embeddings, metadatas=batch_meta,
                persist_directory=args.out,
            )
        else:
            vectordb.add_texts(texts=batch_chunks, metadatas=batch_meta)

    print(f"Done. Vector store saved to {args.out} ({len(chunks):,} chunks).")


if __name__ == "__main__":
    main()
