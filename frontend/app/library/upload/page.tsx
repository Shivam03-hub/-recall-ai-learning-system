"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Link2, Mic, Video, ArrowLeft, FolderPlus, Folder } from "lucide-react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import Link from "next/link";
import Spinner from "@/components/Spinner";

interface Topic { id: string; name: string; }

export default function UploadPage() {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [language, setLanguage] = useState("english");
  const [isPodcast, setIsPodcast] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicMode, setTopicMode] = useState<"new" | "existing">("new");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [newTopicName, setNewTopicName] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    api.listTopics().then(setTopics).catch(() => {});
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setProcessing(true); setStatus("Starting...");
    try {
      const meeting = await api.createMeeting(source, language, isPodcast);
      setStatus("Processing your content — transcribing and analyzing...");
      pollStatus(meeting.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
      setProcessing(false);
    }
  }

  async function pollStatus(meetingId: string) {
    const interval = setInterval(async () => {
      try {
        const meeting = await api.getMeeting(meetingId);
        if (meeting.status === "done") {
          clearInterval(interval);
          setStatus("Done! Linking to topic...");

          const result =
            topicMode === "existing" && selectedTopicId
              ? await api.confirmTopic(meetingId, selectedTopicId, undefined)
              : await api.confirmTopic(meetingId, undefined, newTopicName.trim() || meeting.title || "New Topic");

          setStatus("Done! Redirecting...");
          router.push(`/topics/${result.topic_id}`);
        } else if (meeting.status === "failed") {
          clearInterval(interval);
          setError("Processing failed. Please try another source.");
          setProcessing(false);
        }
      } catch {
        clearInterval(interval);
        setError("Lost connection while processing.");
        setProcessing(false);
      }
    }, 4000);
  }

  return (
    <div className="px-6 max-w-2xl mx-auto py-10">
      <Link href="/library" className="inline-flex items-center gap-2 mb-8 text-sm glow-hover px-3 py-1.5 rounded-lg"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
        <ArrowLeft size={15} /> Back to Library
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl mb-2">Add Content</h1>
        <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
          Paste a YouTube link to a video or podcast. Recall will transcribe and remember it.
        </p>

        {!processing ? (
          <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-5">
            <div>
              <label className="flex items-center gap-2 text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
                <Link2 size={15} /> YouTube URL
              </label>
              <input type="url" required placeholder="https://youtube.com/watch?v=..."
                value={source} onChange={(e) => setSource(e.target.value)}
                className="w-full px-4 py-3 rounded-xl outline-none"
                style={{ background: "var(--surface-solid)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>

            <div>
              <label className="text-sm mb-2 block" style={{ color: "var(--text-secondary)" }}>Add to topic</label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button type="button" onClick={() => setTopicMode("new")}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm transition-all"
                  style={{
                    background: topicMode === "new" ? "var(--accent-glow)" : "var(--surface-solid)",
                    border: `1px solid ${topicMode === "new" ? "var(--accent)" : "var(--border)"}`,
                    color: topicMode === "new" ? "var(--text-primary)" : "var(--text-secondary)",
                  }}>
                  <FolderPlus size={16} /> New topic
                </button>
                <button type="button" onClick={() => setTopicMode("existing")} disabled={topics.length === 0}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm transition-all disabled:opacity-40"
                  style={{
                    background: topicMode === "existing" ? "var(--accent-glow)" : "var(--surface-solid)",
                    border: `1px solid ${topicMode === "existing" ? "var(--accent)" : "var(--border)"}`,
                    color: topicMode === "existing" ? "var(--text-primary)" : "var(--text-secondary)",
                  }}>
                  <Folder size={16} /> Existing topic
                </button>
              </div>

              {topicMode === "new" ? (
                <input
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  placeholder="Leave blank to auto-name from content"
                  className="w-full px-4 py-3 rounded-xl outline-none"
                  style={{ background: "var(--surface-solid)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              ) : (
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  required={topicMode === "existing"}
                  className="w-full px-4 py-3 rounded-xl outline-none"
                  style={{ background: "var(--surface-solid)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="">Select a topic...</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-sm mb-2 block" style={{ color: "var(--text-secondary)" }}>Language</label>
              <div className="grid grid-cols-2 gap-3">
                {["english", "hinglish"].map((lang) => (
                  <button key={lang} type="button" onClick={() => setLanguage(lang)}
                    className="px-4 py-3 rounded-xl text-sm capitalize transition-all"
                    style={{
                      background: language === lang ? "var(--accent-glow)" : "var(--surface-solid)",
                      border: `1px solid ${language === lang ? "var(--accent)" : "var(--border)"}`,
                      color: language === lang ? "var(--text-primary)" : "var(--text-secondary)",
                    }}>
                    {lang === "hinglish" ? "Hindi / Hinglish" : "English"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm mb-2 block" style={{ color: "var(--text-secondary)" }}>Content type</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setIsPodcast(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm transition-all"
                  style={{
                    background: !isPodcast ? "var(--accent-glow)" : "var(--surface-solid)",
                    border: `1px solid ${!isPodcast ? "var(--accent)" : "var(--border)"}`,
                    color: !isPodcast ? "var(--text-primary)" : "var(--text-secondary)",
                  }}>
                  <Video size={16} /> Video / Lecture
                </button>
                <button type="button" onClick={() => setIsPodcast(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm transition-all"
                  style={{
                    background: isPodcast ? "var(--accent-glow)" : "var(--surface-solid)",
                    border: `1px solid ${isPodcast ? "var(--accent)" : "var(--border)"}`,
                    color: isPodcast ? "var(--text-primary)" : "var(--text-secondary)",
                  }}>
                  <Mic size={16} /> Podcast (speakers)
                </button>
              </div>
              {isPodcast && (
                <p className="text-xs mt-2 font-mono" style={{ color: "var(--cyan)" }}>
                  → Speaker diarization enabled
                </p>
              )}
            </div>

            {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

            <button type="submit" className="btn-primary w-full py-3 rounded-xl font-medium">
              Process Content
            </button>
          </form>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass rounded-2xl p-10 text-center">
            <div className="flex justify-center mb-5"><Spinner size={32} /></div>
            <p className="text-lg mb-2">{status}</p>
            <p className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
              This can take a few minutes for long content. Keep this tab open.
            </p>
            {error && <p className="text-sm mt-4" style={{ color: "var(--danger)" }}>{error}</p>}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}