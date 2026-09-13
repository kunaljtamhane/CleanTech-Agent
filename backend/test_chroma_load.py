"""
Quick local sanity check: does ./chroma_db load correctly with the pinned
chromadb/langchain-chroma versions, before we spend time pushing 2.3GB to
Hugging Face Spaces?

Usage:
    export OPENAI_API_KEY=sk-...
    python test_chroma_load.py --dir /path/to/chroma_db
"""

import argparse
import sys

from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", default="./chroma_db", help="Path to the chroma_db folder")
    parser.add_argument("--query", default="solar energy", help="Sample query to test retrieval")
    args = parser.parse_args()

    print(f"Loading Chroma store from: {args.dir}")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectordb = Chroma(persist_directory=args.dir, embedding_function=embeddings)

    count = vectordb._collection.count()
    print(f"Collection document count: {count:,}")

    if count == 0:
        print(
            "\nFAILED: collection loaded but is empty. This is the version-"
            "mismatch symptom described in DEPLOY.md. Run rebuild_vectorstore.py "
            "instead."
        )
        sys.exit(1)

    print(f"\nRunning a sample similarity search for: '{args.query}'")
    results = vectordb.similarity_search(args.query, k=3)
    for i, doc in enumerate(results, 1):
        title = doc.metadata.get("title", "N/A")
        print(f"  {i}. {title}")

    print(f"\nSUCCESS: {count:,} documents loaded and retrieval works. Safe to deploy.")


if __name__ == "__main__":
    main()
