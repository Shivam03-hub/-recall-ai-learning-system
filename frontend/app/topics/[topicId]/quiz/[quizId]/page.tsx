"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, X, ArrowLeft, RotateCcw, Layers } from "lucide-react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Link from "next/link";
import Spinner from "@/components/Spinner";

interface Question { id: string; question: string; related_concept?: string; }
interface Result {
  score: number; total: number; weak_areas: string[];
  results: { question: string; your_answer: string; correct_answer: string; is_correct: boolean; related_concept?: string }[];
}
interface Flashcard { front: string; back: string; }

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const topicId = params.topicId as string;
  const quizId = params.quizId as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    // We don't have a GET quiz endpoint, so questions come via sessionStorage from creation,
    // OR we re-fetch. Simplest: stored on creation. Fallback handled below.
    const stored = sessionStorage.getItem(`quiz_${quizId}`);
    if (stored) {
      setQuestions(JSON.parse(stored));
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [quizId, router]);

  async function handleSubmit() {
    setSubmitting(true);
    const payload = questions.map((q) => ({ question_id: q.id, answer: answers[q.id] || "" }));
    try {
      const res = await api.submitQuiz(topicId, quizId, payload);
      setResult(res);
    } catch (err) {
      alert("Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function loadFlashcards() {
    try {
      const cards = await api.getFlashcards(topicId, quizId);
      setFlashcards(cards);
    } catch {
      alert("Could not load flashcards.");
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size={28} /></div>;

  if (questions.length === 0 && !result) {
    return (
      <div className="px-6 max-w-2xl mx-auto py-20 text-center">
        <p className="mb-4" style={{ color: "var(--text-secondary)" }}>
          This quiz session expired. Please generate a new quiz.
        </p>
        <Link href={`/topics/${topicId}`} className="btn-primary inline-block px-5 py-2.5 rounded-xl">
          Back to topic
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 max-w-2xl mx-auto py-10 pb-20">
      <Link href={`/topics/${topicId}`} className="inline-flex items-center gap-2 mb-8 text-sm glow-hover px-3 py-1.5 rounded-lg"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
        <ArrowLeft size={15} /> Back to topic
      </Link>

      {!result ? (
        <>
          <h1 className="font-display text-3xl mb-8">Quiz</h1>
          <div className="space-y-5">
            {questions.map((q, i) => (
              <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }} className="glass rounded-2xl p-5">
                <p className="mb-3 font-medium">{i + 1}. {q.question}</p>
                <input value={answers[q.id] || ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  placeholder="Your answer..."
                  className="w-full px-4 py-3 rounded-xl outline-none"
                  style={{ background: "var(--surface-solid)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </motion.div>
            ))}
          </div>
          <button onClick={handleSubmit} disabled={submitting}
            className="btn-primary w-full py-3 rounded-xl font-medium mt-6 disabled:opacity-50">
            {submitting ? "Scoring..." : "Submit Answers"}
          </button>
        </>
      ) : (
        <>
          <div className="glass rounded-2xl p-8 text-center mb-6">
            <p className="font-mono text-sm mb-2" style={{ color: "var(--text-muted)" }}>YOUR SCORE</p>
            <p className="font-display text-5xl mb-1">
              {result.score}<span style={{ color: "var(--text-muted)" }}>/{result.total}</span>
            </p>
          </div>

          {result.weak_areas.length > 0 && (
            <div className="rounded-2xl p-5 mb-6"
                 style={{ background: "var(--warning-bg)", border: "1px solid var(--warning)" }}>
              <p className="flex items-center gap-2 mb-2 font-medium" style={{ color: "var(--warning)" }}>
                <Layers size={16} /> Areas to review
              </p>
              <div className="flex flex-wrap gap-2">
                {result.weak_areas.map((w, i) => (
                  <span key={i} className="text-sm px-2.5 py-1 rounded-md"
                        style={{ background: "var(--surface-solid)", color: "var(--text-secondary)" }}>{w}</span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3 mb-6">
            {result.results.map((r, i) => (
              <div key={i} className="glass rounded-xl p-4">
                <div className="flex items-start gap-2 mb-2">
                  {r.is_correct
                    ? <Check size={18} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} />
                    : <X size={18} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />}
                  <p className="font-medium">{r.question}</p>
                </div>
                <p className="text-sm ml-6" style={{ color: "var(--text-secondary)" }}>
                  Your answer: {r.your_answer || "(blank)"}
                </p>
                {!r.is_correct && (
                  <p className="text-sm ml-6" style={{ color: "var(--success)" }}>
                    Correct: {r.correct_answer}
                  </p>
                )}
              </div>
            ))}
          </div>

          {flashcards.length === 0 ? (
            <button onClick={loadFlashcards}
              className="glass glow-hover w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2">
              <Layers size={16} style={{ color: "var(--accent)" }} /> Generate Flashcards from Weak Areas
            </button>
          ) : (
            <div>
              <h2 className="font-display text-2xl mb-4">Flashcards</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {flashcards.map((card, i) => (
                  <div key={i} onClick={() => setFlipped({ ...flipped, [i]: !flipped[i] })}
                    className="glass glow-hover rounded-2xl p-6 cursor-pointer min-h-[140px] flex items-center justify-center text-center">
                    <p className={flipped[i] ? "" : "font-medium"}
                       style={{ color: flipped[i] ? "var(--text-secondary)" : "var(--text-primary)" }}>
                      {flipped[i] ? card.back : card.front}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-center mt-3 font-mono" style={{ color: "var(--text-muted)" }}>
                TAP A CARD TO FLIP
              </p>
            </div>
          )}

          <Link href={`/topics/${topicId}`}
            className="flex items-center justify-center gap-2 mt-6 text-sm" style={{ color: "var(--cyan)" }}>
            <RotateCcw size={14} /> Back to topic
          </Link>
        </>
      )}
    </div>
  );
}