"""
CleanTech RAG — production backend.

This is a productionized version of the agent built in
CSC_583_NLP_Final_Project.ipynb (Part I + Part II). It keeps the same
pipeline the notebook validated:

  - Vector store: Chroma, persisted on disk, built from
    cleantech_media_dataset_v3_2024-10-28.csv (1000-char chunks, 200 overlap)
  - Embeddings: OpenAI text-embedding-3-small
  - LLM: gpt-4o-mini
  - Tools: citation_retriever, summarizer (inline [1][2] citations), bibliography
  - Guardrails: keyword/regex input filter (PII + off-topic), output quality check

What changed vs. the notebook (and why):
  - The notebook used ONE global `citation_tracker` shared by every call. That's
    fine in a single-cell notebook but breaks the moment two users hit the app
    at the same time (citations from one question could leak into another's
    answer). Here each call to `answer_question()` gets its own tracker via a
    contextvar, so it's safe under Streamlit's session model and would also be
    safe under a concurrent server (FastAPI, etc.) if you move to one later.
  - Config (API key, paths, model names) comes from environment variables /
    Streamlit secrets instead of getpass()/hardcoded paths, so it runs headless
    in a container.
"""

from __future__ import annotations

import os
import re
from collections import OrderedDict
from contextvars import ContextVar
from typing import Optional, TypedDict

from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_chroma import Chroma
from langchain_core.tools import StructuredTool
from langchain.agents import create_agent

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

CHROMA_DIR = os.environ.get("CHROMA_DIR", "./chroma_db")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")
RETRIEVER_K = int(os.environ.get("RETRIEVER_K", "5"))

# Same topic/PII guardrail as the notebook's final `validate_input` (cell 122).
CLEANTECH_KEYWORDS = [
    "solar", "solar energy", "photovoltaic", "pv", "wind energy", "wind turbine",
    "offshore wind", "onshore wind", "hydrogen", "fuel cell", "battery",
    "energy storage", "geothermal", "hydropower", "renewable energy",
    "climate", "climate change", "carbon", "carbon emissions", "carbon capture",
    "decarbonization", "net zero", "greenhouse gas", "ghg",
    "cleantech", "clean tech", "clean technology", "sustainable technology",
    "electric vehicle", "electric vehicles", "ev", "ev charging",
    "charging infrastructure", "agrovoltaics", "agrivoltaics",
    "sustainable agriculture", "vertical farming", "precision agriculture",
    "recycling", "solar panel recycling", "circular economy", "waste management",
    "green deal", "green hydrogen", "green energy", "sustainable energy",
    "renewable", "energy efficiency", "esg", "clean energy policy",
    "energy policy", "renewable policy", "ppa", "power purchase agreement",
]

PHONE_PATTERN = re.compile(
    r"(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\d)"
)
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")

ENHANCED_SYSTEM_PROMPT = """
You are an expert Cleantech Research Assistant.

You answer questions using a retrieval-augmented generation system
with citation tracking.

AVAILABLE TOOLS:

1. citation_retriever
   Searches the CleanTech article database and returns relevant
   documents with citation identifiers such as [1], [2], [3].

2. summarizer
   Retrieves multiple documents and synthesizes their information
   into a comprehensive answer with citations.

3. bibliography
   Returns the bibliography of sources tracked during the current question.

MANDATORY RETRIEVAL RULE
For EVERY factual or research-related question, you MUST use
citation_retriever or summarizer BEFORE generating your answer.
Do NOT answer factual questions using only your general knowledge.

CITATION RULES
1. Every factual claim based on retrieved information MUST have an inline
   citation, e.g. "Solar cells convert sunlight into electricity [1]."
2. Use citation numbers exactly as provided by the tools. NEVER invent them.
3. If multiple sources support a claim, cite all of them, e.g. [1][3].
4. If the retrieved sources do not contain enough information, say so
   explicitly instead of inventing an answer.

TOOL SELECTION
- Use citation_retriever for specific facts, companies, technologies, policies.
- Use summarizer when the question needs comparison or synthesis of sources.
- Use bibliography when the user asks for sources.

Your final response should directly answer the question, be concise but
sufficiently detailed, use retrieved evidence, include inline citations, and
never fabricate facts or citations. Do NOT expose internal tool calls,
reasoning, or implementation details to the user.
"""


# --------------------------------------------------------------------------
# Citation tracking (per-call, not global — see module docstring)
# --------------------------------------------------------------------------

class CitationTracker:
    def __init__(self) -> None:
        self.citations: "OrderedDict[int, dict]" = OrderedDict()

    def add_citation(self, source_type="article", title="N/A", url="N/A",
                      date="n.d.", domain="CleanTech DB") -> int:
        for cit_id, citation in self.citations.items():
            if citation["title"] == title and citation["url"] == url:
                return cit_id
        cit_id = len(self.citations) + 1
        self.citations[cit_id] = {
            "source_type": source_type, "title": title, "url": url,
            "date": date, "domain": domain,
        }
        return cit_id

    def get_inline_citation(self, cit_id: int) -> str:
        return f"[{cit_id}]"

    def generate_bibliography(self) -> str:
        if not self.citations:
            return "No citations were used."
        entries = []
        for cit_id, c in self.citations.items():
            entries.append(
                f"[{cit_id}] {c['title']} ({c['date']})\n"
                f"    Domain: {c['domain']}\n"
                f"    URL: {c['url']}"
            )
        return "\n\n".join(entries)


_citation_ctx: ContextVar[Optional[CitationTracker]] = ContextVar(
    "citation_tracker", default=None
)


def _get_tracker() -> CitationTracker:
    tracker = _citation_ctx.get()
    if tracker is None:
        raise RuntimeError(
            "No active citation tracker. Tools must be called from within "
            "answer_question()."
        )
    return tracker


# --------------------------------------------------------------------------
# Guardrails (same logic as the notebook's final validate_input / cell 122)
# --------------------------------------------------------------------------

def validate_input(query: str):
    """Returns True if the query passes, otherwise a string alert message."""
    if not isinstance(query, str):
        return "SECURITY ALERT: Invalid input type."
    q = query.strip()
    if not q:
        return "INPUT ALERT: Query cannot be empty."
    if PHONE_PATTERN.search(q):
        return "SECURITY ALERT: Input contains potential PII (phone number)."
    if EMAIL_PATTERN.search(q):
        return "SECURITY ALERT: Input contains potential PII (email address)."
    q_lower = q.lower()
    if not any(keyword in q_lower for keyword in CLEANTECH_KEYWORDS):
        return "TOPIC ALERT: Query is off-topic. I can only discuss Clean Tech."
    return True


def check_output_quality(response: str) -> dict:
    if not response or "I don't know" in response or len(response) < 10:
        return {"allowed": False, "reason": "QUALITY ALERT: Response was too vague or empty."}
    return {"allowed": True, "reason": "Output passed checks."}


# --------------------------------------------------------------------------
# Pipeline construction
# --------------------------------------------------------------------------

class AnswerResult(TypedDict):
    answer: str
    citations: list
    bibliography: str
    blocked: bool


def build_pipeline():
    """Load the persisted vector store and compile the agent. Call once and
    cache the result (e.g. with st.cache_resource in Streamlit)."""
    if not os.environ.get("OPENAI_API_KEY"):
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Set it as an environment variable "
            "or Streamlit secret before starting the app."
        )
    if not os.path.isdir(CHROMA_DIR):
        raise RuntimeError(
            f"Chroma directory '{CHROMA_DIR}' not found. Make sure chroma_db/ "
            "was included in the deployment (see DEPLOY.md)."
        )

    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    vectordb = Chroma(persist_directory=CHROMA_DIR, embedding_function=embeddings)
    retriever = vectordb.as_retriever(
        search_type="similarity", search_kwargs={"k": RETRIEVER_K}
    )

    count = vectordb._collection.count()
    if count == 0:
        raise RuntimeError(
            f"Chroma collection at '{CHROMA_DIR}' loaded but contains 0 "
            "documents. This usually means the on-disk format doesn't match "
            "this chromadb version, or the wrong collection name is being "
            "used. See DEPLOY.md troubleshooting section."
        )

    llm = ChatOpenAI(model=LLM_MODEL, temperature=0)

    def citation_retriever_function(query: str) -> str:
        tracker = _get_tracker()
        docs = retriever.invoke(query)
        if not docs:
            return "No relevant documents found."
        results = []
        for doc in docs:
            cit_id = tracker.add_citation(
                title=doc.metadata.get("title", "N/A"),
                url=doc.metadata.get("url", "N/A"),
                date=doc.metadata.get("date", "n.d."),
                domain=doc.metadata.get("domain", "CleanTech DB"),
            )
            inline = tracker.get_inline_citation(cit_id)
            results.append(
                f"Source {inline}\nTitle: {doc.metadata.get('title', 'N/A')}\n"
                f"Date: {doc.metadata.get('date', 'n.d.')}\n"
                f"URL: {doc.metadata.get('url', 'N/A')}\n"
                f"Content: {doc.page_content}"
            )
        return "\n\n---\n\n".join(results)

    citation_retriever_tool = StructuredTool.from_function(
        func=citation_retriever_function,
        name="citation_retriever",
        description=(
            "Search the cleantech article database and return relevant "
            "articles with citation identifiers."
        ),
    )

    def summarize_with_citations(query: str) -> str:
        tracker = _get_tracker()
        docs = retriever.invoke(query)
        if not docs:
            return "No relevant documents found."
        context_parts = []
        for doc in docs:
            cit_id = tracker.add_citation(
                title=doc.metadata.get("title", "N/A"),
                url=doc.metadata.get("url", "N/A"),
                date=doc.metadata.get("date", "n.d."),
                domain=doc.metadata.get("domain", "CleanTech DB"),
            )
            inline = tracker.get_inline_citation(cit_id)
            context_parts.append(
                f"Source {inline}:\nTitle: {doc.metadata.get('title', 'N/A')}\n"
                f"Date: {doc.metadata.get('date', 'n.d.')}\n"
                f"Content: {doc.page_content}"
            )
        context = "\n\n---\n\n".join(context_parts)
        prompt_text = f"""
You are a cleantech research assistant.

Synthesize the following sources to answer the question.

IMPORTANT CITATION RULES:
- Include inline citation numbers such as [1], [2], [3].
- Every factual claim derived from a source should have a citation.
- Do not invent citation numbers.
- Only use citation numbers that appear in the provided sources.
- If multiple sources support a statement, cite all relevant sources.

Question:
{query}

Sources:
{context}

Provide a comprehensive but concise answer with inline citations.
"""
        response = llm.invoke(prompt_text)
        return response.content

    summarizer_tool = StructuredTool.from_function(
        func=summarize_with_citations,
        name="summarizer",
        description=(
            "Synthesize information from multiple cleantech articles with "
            "proper inline citations. Use this for comprehensive answers "
            "that require synthesis of multiple sources."
        ),
    )

    def bibliography_function(query: str = "") -> str:
        return _get_tracker().generate_bibliography()

    bibliography_tool = StructuredTool.from_function(
        func=bibliography_function,
        name="bibliography",
        description="Return the bibliography of sources used so far for this question.",
    )

    tools = [citation_retriever_tool, summarizer_tool, bibliography_tool]
    agent = create_agent(model=llm, tools=tools, system_prompt=ENHANCED_SYSTEM_PROMPT)
    return agent


# --------------------------------------------------------------------------
# Public entry point
# --------------------------------------------------------------------------

def answer_question(agent, query: str) -> AnswerResult:
    """Run one query through input guardrail -> agent -> output guardrail.

    Safe to call concurrently for different users against the same compiled
    `agent` object — each call gets its own CitationTracker.
    """
    validation = validate_input(query)
    if validation is not True:
        return {"answer": f"Guardrail Alert: {validation}", "citations": [],
                "bibliography": "", "blocked": True}

    tracker = CitationTracker()
    token = _citation_ctx.set(tracker)
    try:
        result = agent.invoke({"messages": [{"role": "user", "content": query}]})
        answer = result["messages"][-1].content
    except Exception as e:  # noqa: BLE001 - surface any failure to the UI
        return {"answer": f"Error: agent failed to process query - {e}",
                "citations": [], "bibliography": "", "blocked": True}
    finally:
        _citation_ctx.reset(token)

    quality = check_output_quality(answer)
    if not quality["allowed"]:
        return {"answer": f"Guardrail Alert: {quality['reason']}",
                "citations": list(tracker.citations.values()),
                "bibliography": tracker.generate_bibliography(), "blocked": True}

    return {
        "answer": answer,
        "citations": list(tracker.citations.values()),
        "bibliography": tracker.generate_bibliography(),
        "blocked": False,
    }
