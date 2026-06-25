"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, BookOpen, Library as LibraryIcon, Trash2, Pencil, Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import Spinner from "@/components/Spinner";

interface Topic { id: string; name: string; }

export default function LibraryPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    loadTopics();
  }, [router]);

  function loadTopics() {
    setLoading(true);
    api.listTopics()
      .then(setTopics)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  function startEdit(topic: Topic, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(topic.id);
    setEditValue(topic.name);
  }

  async function saveEdit(topicId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!editValue.trim()) return;
    setBusyId(topicId);
    try {
      await api.renameTopic(topicId, editValue.trim());
      setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, name: editValue.trim() } : t)));
      setEditingId(null);
    } catch {
      alert("Could not rename topic.");
    } finally {
      setBusyId(null);
    }
  }

  function cancelEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(null);
  }

  function askDelete(topicId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(topicId);
  }

  async function confirmDelete(topicId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusyId(topicId);
    try {
      await api.deleteTopic(topicId);
      setTopics((prev) => prev.filter((t) => t.id !== topicId));
      setConfirmDeleteId(null);
    } catch {
      alert("Could not delete topic.");
    } finally {
      setBusyId(null);
    }
  }

  function cancelDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(null);
  }

  return (
    <div>
      <TopBar />
      <div className="px-6 max-w-5xl mx-auto pb-20">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-2">
          <div>
            <h1 className="font-display text-4xl mb-1 shimmer">Your Library</h1>
            <p style={{ color: "var(--text-secondary)" }}>
              Everything you&apos;ve learned, remembered and connected.
            </p>
          </div>
          <Link href="/library/upload"
                className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium">
            <Plus size={18} /> Add Content
          </Link>
        </motion.div>

        {topics.length > 0 && (
          <p className="font-mono text-xs mb-8 mt-4" style={{ color: "var(--text-muted)" }}>
            {topics.length} {topics.length === 1 ? "TOPIC" : "TOPICS"}
          </p>
        )}

        {loading && (
          <div className="flex justify-center py-24"><Spinner size={28} /></div>
        )}

        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

        {!loading && !error && topics.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="glass text-center py-24 rounded-3xl mt-8">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--accent-glow)" }}>
              <LibraryIcon size={28} style={{ color: "var(--accent)" }} />
            </motion.div>
            <p className="text-xl mb-2 font-display">Your library is empty</p>
            <p className="mb-7 max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
              Add your first video or podcast and Recall will start building your knowledge base.
            </p>
            <Link href="/library/upload"
                  className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium">
              <Plus size={18} /> Add your first content
            </Link>
          </motion.div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {topics.map((topic, i) => (
              <motion.div key={topic.id}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="glass glow-hover relative block p-6 rounded-2xl h-full group">
                  {confirmDeleteId === topic.id ? (
                    <div className="flex flex-col h-full justify-center items-center text-center gap-3 py-4">
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        Delete &quot;{topic.name}&quot;? This removes all its content, chats, PDFs and quizzes.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={(e) => confirmDelete(topic.id, e)} disabled={busyId === topic.id}
                          className="px-4 py-1.5 rounded-lg text-sm font-medium"
                          style={{ background: "var(--danger)", color: "white" }}>
                          {busyId === topic.id ? "..." : "Delete"}
                        </button>
                        <button onClick={cancelDelete}
                          className="px-4 py-1.5 rounded-lg text-sm"
                          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Link href={`/topics/${topic.id}`} className="block">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                             style={{ background: "var(--accent-glow)" }}>
                          <BookOpen size={20} style={{ color: "var(--accent)" }} />
                        </div>

                        {editingId === topic.id ? (
                          <div className="mb-2 flex items-center gap-1">
                            <input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              className="flex-1 px-2 py-1 rounded-lg text-sm outline-none"
                              style={{ background: "var(--surface-solid)", border: "1px solid var(--accent)", color: "var(--text-primary)" }}
                            />
                            <button onClick={(e) => saveEdit(topic.id, e)} className="p-1.5 rounded-lg" style={{ color: "var(--success)" }}>
                              <Check size={15} />
                            </button>
                            <button onClick={cancelEdit} className="p-1.5 rounded-lg" style={{ color: "var(--danger)" }}>
                              <X size={15} />
                            </button>
                          </div>
                        ) : (
                          <h3 className="font-medium text-lg mb-2">{topic.name}</h3>
                        )}

                        <p className="text-sm flex items-center gap-1" style={{ color: "var(--cyan)" }}>
                          Open topic →
                        </p>
                      </Link>

                      {editingId !== topic.id && (
                        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => startEdit(topic, e)}
                            className="p-1.5 rounded-lg glow-hover" style={{ background: "var(--surface-solid)", color: "var(--text-secondary)" }}>
                            <Pencil size={13} />
                          </button>
                          <button onClick={(e) => askDelete(topic.id, e)}
                            className="p-1.5 rounded-lg glow-hover" style={{ background: "var(--surface-solid)", color: "var(--danger)" }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}