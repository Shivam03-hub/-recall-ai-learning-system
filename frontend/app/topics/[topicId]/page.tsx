"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Send, FileText, GraduationCap, ArrowLeft, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import Spinner from "@/components/Spinner";
import TopicSidebar from "@/components/TopicSidebar";
import TopicStats from "@/components/TopicStats";
import KnowledgeFlags from "@/components/KnowledgeFlags";
import SourcesList from "@/components/SourcesList";

interface ChatMsg {
  id?: string; question: string; answer: string; sources: string[];
}

export default function TopicPage() {
  const params = useParams();
  const router = useRouter();
  const topicId = params.topicId as string;

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [topicName, setTopicName] = useState("Topic");
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showPdfBox, setShowPdfBox] = useState(false);
  const [pdfInstruction, setPdfInstruction] = useState("");
  const [showQuizBox, setShowQuizBox] = useState(false);
  const [quizCount, setQuizCount] = useState(5);
  const [quizDifficulty, setQuizDifficulty] = useState("medium");
  const [quizCustom, setQuizCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    api.getChatHistory(topicId)
      .then((h) => setMessages(h))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
    api.listTopics()
      .then((topics: { id: string; name: string }[]) => {
        const t = topics.find((t) => t.id === topicId);
        if (t) setTopicName(t.name);
      })
      .catch(() => {});
  }, [topicId, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    const q = question;
    setQuestion("");
    setAsking(true);
    setMessages((m) => [...m, { question: q, answer: "", sources: [] }]);
    try {
      const res = await api.askTopic(topicId, q);
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { question: q, answer: res.answer, sources: res.sources || [] };
        return copy;
      });
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { question: q, answer: "Something went wrong. Please try again.", sources: [] };
        return copy;
      });
    } finally {
      setAsking(false);
    }
  }

  async function handleGeneratePdf() {
    if (!pdfInstruction.trim()) return;
    setBusy(true);
    try {
      const blob = await api.generatePdf(topicId, pdfInstruction);
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement("a");
      a.href = url; a.download = "recall-notes.pdf"; a.click();
      URL.revokeObjectURL(url);
      setShowPdfBox(false); setPdfInstruction("");
      window.location.reload();
    } catch (err) {
      alert("PDF generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateQuiz() {
    setBusy(true);
    try {
      const quiz = await api.createQuiz(topicId, quizCount, quizDifficulty, quizCustom);
      sessionStorage.setItem(`quiz_${quiz.id}`, JSON.stringify(quiz.questions));
      router.push(`/topics/${topicId}/quiz/${quiz.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Quiz generation failed.");
      setBusy(false);
    }
  }

  return (
    <div>
      <TopBar />

      {/* Left sidebar */}
      <div
        className="hidden lg:block fixed"
        style={{ top: 96, left: 24, width: 340, height: "calc(100vh - 120px)" }}
      >
        <TopicSidebar topicId={topicId} />
      </div>

      {/* Right stats panel */}
      <div
        className="hidden xl:block fixed"
        style={{ top: 96, right: 24, width: 280 }}
      >
        <TopicStats topicId={topicId} topicName={topicName} />
      </div>

      {/* Main chat column */}
      <div className="px-6 pb-32 flex justify-center">
        <div className="w-full lg:ml-[364px] xl:mr-[304px]" style={{ maxWidth: 700 }}>
          <Link href="/library" className="inline-flex items-center gap-2 mb-6 text-sm glow-hover px-3 py-1.5 rounded-lg"
                style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            <ArrowLeft size={15} /> Library
          </Link>

          <KnowledgeFlags topicId={topicId} />
          <SourcesList topicId={topicId} />

          <div className="flex flex-wrap gap-3 mb-8">
            <button onClick={() => { setShowPdfBox(!showPdfBox); setShowQuizBox(false); }}
              className="glass glow-hover flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm">
              <FileText size={16} style={{ color: "var(--cyan)" }} /> Generate PDF
            </button>
            <button onClick={() => { setShowQuizBox(!showQuizBox); setShowPdfBox(false); }}
              className="glass glow-hover flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm">
              <GraduationCap size={16} style={{ color: "var(--accent)" }} /> Generate Quiz
            </button>
          </div>

          {showPdfBox && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="glass rounded-2xl p-5 mb-6">
              <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                Tell Recall what kind of PDF to generate:
              </p>
              <input value={pdfInstruction} onChange={(e) => setPdfInstruction(e.target.value)}
                placeholder="e.g. 15 exam-prep questions with answers"
                className="w-full px-4 py-3 rounded-xl outline-none mb-3"
                style={{ background: "var(--surface-solid)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <button onClick={handleGeneratePdf} disabled={busy}
                className="btn-primary px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                {busy ? "Generating..." : "Download PDF"}
              </button>
            </motion.div>
          )}

          {showQuizBox && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="glass rounded-2xl p-5 mb-6">
              <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>Number of questions</p>
              <input
                type="number"
                min={1}
                max={25}
                value={quizCount}
                onChange={(e) => setQuizCount(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
                className="w-full px-4 py-3 rounded-xl outline-none mb-1"
                style={{ background: "var(--surface-solid)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              <p className="text-xs font-mono mb-4" style={{ color: "var(--text-muted)" }}>
                Up to 25 at a time, for the best question quality
              </p>

              <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>Custom instructions (optional)</p>
              <input
                value={quizCustom}
                onChange={(e) => setQuizCustom(e.target.value)}
                placeholder="e.g. focus more on the second video, or make it exam-style"
                className="w-full px-4 py-3 rounded-xl outline-none mb-4"
                style={{ background: "var(--surface-solid)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />

              <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>Difficulty</p>
              <div className="flex gap-2 mb-4">
                {["easy", "medium", "hard"].map((d) => (
                  <button key={d} onClick={() => setQuizDifficulty(d)}
                    className="px-4 py-2 rounded-lg text-sm capitalize"
                    style={{
                      background: quizDifficulty === d ? "var(--accent-glow)" : "var(--surface-solid)",
                      border: `1px solid ${quizDifficulty === d ? "var(--accent)" : "var(--border)"}`,
                    }}>{d}</button>
                ))}
              </div>
              <button onClick={handleCreateQuiz} disabled={busy}
                className="btn-primary px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                {busy ? "Generating..." : "Start Quiz"}
              </button>
            </motion.div>
          )}

          {loadingHistory ? (
            <div className="flex justify-center py-16"><Spinner size={26} /></div>
          ) : (
            <div className="space-y-6">
              {messages.length === 0 && (
                <div className="text-center py-16">
                  <Sparkles size={28} style={{ color: "var(--accent)", margin: "0 auto 12px" }} />
                  <p style={{ color: "var(--text-secondary)" }}>
                    Ask anything about the content in this topic.
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex justify-end mb-3">
                    <div className="px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[80%]"
                         style={{ background: "var(--accent)", color: "white" }}>
                      {msg.question}
                    </div>
                  </div>
                  <div className="glass rounded-2xl rounded-bl-sm p-4 w-full">
                    {msg.answer === "" ? (
                      <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                        <Spinner size={16} /> Thinking...
                      </div>
                    ) : (
                      <>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.answer}</p>
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-4 pt-3"
                               style={{ borderTop: "1px solid var(--border)" }}>
                            {msg.sources.map((s, j) => (
                              <span key={j} className="font-mono text-xs px-2.5 py-1 rounded-md"
                                style={{ background: "var(--cyan-glow)", color: "var(--cyan)" }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Fixed chat input */}
      <div className="fixed bottom-0 left-0 right-0 px-6 py-4 flex justify-center">
        <div className="w-full lg:ml-[364px] xl:mr-[304px]" style={{ maxWidth: 700 }}>
          <form onSubmit={handleAsk} className="glass rounded-2xl flex items-center gap-2 p-2">
            <input value={question} onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about this topic..."
              className="flex-1 px-4 py-2.5 bg-transparent outline-none"
              style={{ color: "var(--text-primary)" }} />
            <button type="submit" disabled={asking || !question.trim()}
              className="btn-primary w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40">
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}