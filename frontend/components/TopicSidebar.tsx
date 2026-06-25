"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, FileText, GraduationCap, Clock, ChevronRight, Download } from "lucide-react";
import { api } from "@/lib/api";

interface ChatItem { id?: string; question: string; created_at?: string; }
interface PdfItem { id: string; instruction: string; created_at: string; }
interface QuizItem { id: string; created_at: string; total_questions: number; answered: number; score: number | null; }

type Tab = "chats" | "pdfs" | "quizzes";

export default function TopicSidebar({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("chats");
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, [topicId]);

  function loadAll() {
    setLoading(true);
    Promise.all([
      api.getChatHistory(topicId).catch(() => []),
      api.getPdfHistory(topicId).catch(() => []),
      api.listQuizzes(topicId).catch(() => []),
    ]).then(([c, p, q]) => {
      setChats(c);
      setPdfs(p);
      setQuizzes(q);
      setLoading(false);
    });
  }

  async function handleDownloadPdf(pdfId: string) {
    setDownloadingId(pdfId);
    try {
      const blob = await api.downloadPastPdf(topicId, pdfId);
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "recall-notes.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not download this PDF.");
    } finally {
      setDownloadingId(null);
    }
  }

  function timeAgo(dateStr?: string) {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "chats", label: "Chats", icon: <MessageSquare size={14} />, count: chats.length },
    { key: "pdfs", label: "PDFs", icon: <FileText size={14} />, count: pdfs.length },
    { key: "quizzes", label: "Quizzes", icon: <GraduationCap size={14} />, count: quizzes.length },
  ];

  return (
    <div className="glass rounded-2xl flex flex-col w-full overflow-hidden" style={{ height: "100%" }}>
      <div className="flex gap-1 p-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all relative"
            style={{
              background: tab === t.key ? "var(--accent-glow)" : "transparent",
              color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            {t.count > 0 && (
              <span
                className="font-mono text-[10px] px-1.5 rounded-full"
                style={{
                  background: tab === t.key ? "var(--accent)" : "var(--surface-solid)",
                  color: tab === t.key ? "white" : "var(--text-muted)",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading && (
          <p className="text-xs text-center py-8 font-mono" style={{ color: "var(--text-muted)" }}>
            LOADING...
          </p>
        )}

        <AnimatePresence mode="wait">
          {!loading && tab === "chats" && (
            <motion.div key="chats" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="space-y-1.5">
              {chats.length === 0 && <EmptyHint text="No questions asked yet" />}
              {chats.map((c, i) => (
                <div key={i} className="px-3 py-2.5 rounded-xl text-sm" style={{ background: "var(--surface-solid)" }}>
                  <p className="line-clamp-2 mb-1">{c.question}</p>
                  <p className="text-[11px] font-mono flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                    <Clock size={10} /> {timeAgo(c.created_at)}
                  </p>
                </div>
              ))}
            </motion.div>
          )}

          {!loading && tab === "pdfs" && (
            <motion.div key="pdfs" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="space-y-1.5">
              {pdfs.length === 0 && <EmptyHint text="No PDFs generated yet" />}
              {pdfs.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleDownloadPdf(p.id)}
                  disabled={downloadingId === p.id}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-start justify-between gap-2 glow-hover"
                  style={{ background: "var(--surface-solid)" }}
                >
                  <div>
                    <p className="line-clamp-2 mb-1">{p.instruction}</p>
                    <p className="text-[11px] font-mono flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                      <Clock size={10} /> {timeAgo(p.created_at)}
                    </p>
                  </div>
                  <Download size={14} style={{ color: "var(--cyan)", flexShrink: 0, marginTop: 2 }} />
                </button>
              ))}
            </motion.div>
          )}

          {!loading && tab === "quizzes" && (
            <motion.div key="quizzes" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="space-y-1.5">
              {quizzes.length === 0 && <EmptyHint text="No quizzes yet" />}
              {quizzes.map((q) => (
                <button
                  key={q.id}
                  onClick={() => router.push(`/topics/${topicId}/quiz/${q.id}`)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center justify-between glow-hover"
                  style={{ background: "var(--surface-solid)" }}
                >
                  <div>
                    <p className="mb-1">{q.total_questions} questions</p>
                    <p className="text-[11px] font-mono flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                      <Clock size={10} /> {timeAgo(q.created_at)}
                    </p>
                  </div>
                  {q.score !== null ? (
                    <span
                      className="font-mono text-xs px-2 py-1 rounded-md"
                      style={{ background: "var(--success-bg)", color: "var(--success)" }}
                    >
                      {q.score}/{q.total_questions}
                    </span>
                  ) : (
                    <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="text-xs text-center py-10 px-4" style={{ color: "var(--text-muted)" }}>
      {text}
    </p>
  );
}