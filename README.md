# Recall — AI Learning Memory System

A persistent AI memory system for everything you watch or listen to. Recall transcribes real audio and video, remembers across your entire library, catches when sources contradict each other, and flags what you don't know yet.

Unlike asking a generic chatbot about a single video, Recall organizes content into **topics** — a persistent library that accumulates knowledge over time, cross-references new content against everything you've already added, and surfaces tension between sources instead of silently treating every claim as equally true.

---

## Why this exists

Most "summarize this video" tools are stateless — each video is its own isolated conversation, with no memory of anything you watched before it. Recall is built around the opposite assumption: that learning is cumulative, and a good system should know what you've already learned, notice when something doesn't add up, and tell you what's still unexplained.

---

## Core features

**Universal ingestion** — Paste a YouTube URL (video or podcast), pick English or Hindi/Hinglish, and Recall transcribes it via local Whisper (GPU-accelerated) or Sarvam AI for Hindi content. Async background processing means long content doesn't block the request; the frontend polls for status.

**Speaker diarization** — For podcast/multi-speaker content, `pyannote.audio` identifies who's speaking and produces a speaker-labeled transcript (`SPEAKER_00: ...`), saved permanently and viewable per source.

**Cross-content memory + RAG** — Content lives inside topics, not in isolation. Ask anything within a topic and get an answer with source attribution — which specific video the answer came from. Full chat history is saved and browsable in a sidebar, persisting across sessions.

**Contradiction detection** — When new content is added to a topic, an LLM agent compares its claims against everything already known in that topic and flags genuine conflicts — not just topic drift, but claims that actually disagree (e.g. two sources citing different stats for the same comparison).

**Knowledge gap detection** — Flags concepts that new content assumes you already know but never explains, and separately flags concepts referenced but not covered anywhere yet in the topic's history.

**Multi-agent pipeline (LangGraph)** — Extraction, quality-checking, gap detection, and contradiction detection are separate agents in a LangGraph pipeline, with automatic retry if extraction confidence is low. Every agent step is traced end-to-end with LangSmith.

**Gap-targeted quizzes + flashcards** — Generate quizzes that specifically target the more complex or commonly-misunderstood concepts in a topic, with adjustable count and difficulty. Answers are scored by an LLM judge (so paraphrased correct answers aren't marked wrong), and wrong answers automatically generate flashcards from the weak areas.

**Flexible PDF export** — Two paths: a one-click export of a single video's notes, or a chat-driven flow where you describe what you want ("15 exam questions with answers", "a 1-page summary") and Recall generates exactly that, grounded in the topic's actual content.

---

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Next.js    │────────▶│     FastAPI       │────────▶│  PostgreSQL  │
│   Frontend   │  REST   │     Backend        │   ORM   │   (Neon)     │
└─────────────┘         └──────────────────┘         └─────────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                ▼                 ▼                 ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │   Whisper /   │  │   ChromaDB    │  │   LangGraph   │
        │  Sarvam AI    │  │ (per-topic    │  │ multi-agent   │
        │ + pyannote    │  │  vector       │  │   pipeline    │
        │ (transcription│  │  isolation)   │  │ (extract →    │
        │ + diarization)│  │               │  │  check →      │
        └──────────────┘  └──────────────┘  │  gaps →       │
                                              │  contradict)  │
                                              └──────────────┘
                                                      │
                                                      ▼
                                              ┌──────────────┐
                                              │  LangSmith    │
                                              │ observability │
                                              └──────────────┘
```

**Backend:** FastAPI · SQLAlchemy · PostgreSQL (Neon) · LangChain + LangGraph · LangSmith · Groq (Llama 3.3 70B for extraction/RAG) · OpenAI Whisper (local, CUDA) · Sarvam AI (Hindi/Hinglish) · pyannote.audio (diarization) · ChromaDB · JWT auth (python-jose, passlib) · Resend (email) · ReportLab (PDF export)

**Frontend:** Next.js 16 (App Router, TypeScript) · Tailwind CSS · Framer Motion

---

## What makes the agent pipeline real, not decorative

The LangGraph pipeline isn't a thin wrapper around a single LLM call. It's four distinct nodes with real control flow:

1. **Extractor** — pulls concepts from the transcript, distinguishing concepts that are explained from ones that are merely referenced
2. **Quality Check** — a separate LLM call judges whether the extraction is complete; if not, it routes back to the Extractor for a retry (capped at 3 attempts)
3. **Gap Detector** — compares newly extracted concepts against everything already known in the topic, flagging genuine gaps without over-flagging
4. **Contradiction Checker** — compares new claims against past claims in the same topic, instructed explicitly to avoid false positives ("if unsure, do not flag it")

Every node's input, output, and latency is visible in LangSmith — this was used throughout development to debug retry behavior and verify the contradiction/gap logic wasn't producing false positives.

---

## A real example, from testing

Two unrelated YouTube videos comparing two footballers' statistics were added to the same topic. Recall's contradiction checker correctly flagged that a specific numeric claim from one video ("a 0.71 goals-per-game ratio") sat in tension with a broader claim from the other ("scored over 900 career goals... the top scorer in international football history") — a genuine, non-obvious tension between sources that a person skimming both videos separately would likely never notice.

---

## Known limitations

- **Speaker diarization currently only supports English/Whisper.** Selecting both "Podcast" and "Hindi/Hinglish" together silently falls back to Whisper for transcription rather than Sarvam AI, since diarization's word-timestamp alignment was built specifically around Whisper's output format. Plain Hindi transcription (without diarization) works correctly.
- **Diarization has a small word-attribution error rate** (roughly 10–15% of words near speaker-change boundaries) due to timestamp granularity differences between Whisper and pyannote. A tolerance window reduces but doesn't eliminate this.
- **Live deployment was attempted but not completed.** The backend builds successfully on Railway, but the combined memory footprint of Whisper + pyannote + torch exceeds the ~1GB RAM ceiling of free-tier hosting (Railway Trial, Render Free, and Fly.io's free shared VMs all cap around the same limit). The application runs correctly locally with GPU acceleration; a production deployment would need either a paid tier with more RAM or splitting transcription into a separate on-demand worker service.

---

## Project status

All core features — ingestion, diarization, cross-content RAG, contradiction detection, gap detection, the LangGraph pipeline, LangSmith tracing, quizzes, flashcards, and PDF export — are built and have been tested with real content, including edge cases (blank quiz answers, boundary mismatches in diarization, multi-source contradiction checks).