"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Download, ExternalLink, FileQuestion } from "lucide-react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import Spinner from "@/components/Spinner";

interface Concept { name: string; explanation: string; is_claim: boolean; }
interface MeetingDetail {
  id: string; title: string; summary: string; transcript: string;
  source: string; status: string; concepts: Concept[];
}

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const topicId = params.topicId as string;
  const meetingId = params.meetingId as string;

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"summary" | "transcript" | "concepts">("summary");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    api.getMeeting(meetingId).then(setMeeting).catch(() => {}).finally(() => setLoading(false));
  }, [meetingId, router]);

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await api.exportMeetingPdf(meetingId);
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${meeting?.title || "notes"}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size={28} /></div>;
  }

  if (!meeting) {
    return (
      <div className="px-6 max-w-2xl mx-auto py-20 text-center">
        <p style={{ color: "var(--text-secondary)" }}>Could not load this content.</p>
      </div>
    );
  }

  const explained = meeting.concepts.filter((c) => !c.explanation.toLowerCase().includes("not explained"));
  const referenced = meeting.concepts.filter((c) => c.explanation.toLowerCase().includes("not explained"));

  return (
    <div>
      <TopBar />
      <div className="px-6 max-w-3xl mx-auto pb-20">
        <button onClick={() => router.push(`/topics/${topicId}`)}
          className="inline-flex items-center gap-2 mb-6 text-sm glow-hover px-3 py-1.5 rounded-lg"
          style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          <ArrowLeft size={15} /> Back to topic
        </button>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl mb-2">{meeting.title || "Untitled content"}</h1>
          <div className="flex items-center gap-3 mb-6">
            <a href={meeting.source} target="_blank" rel="noopener noreferrer"
              className="text-sm flex items-center gap-1" style={{ color: "var(--cyan)" }}>
              <ExternalLink size={13} /> View original
            </a>
            <button onClick={handleExport} disabled={exporting}
              className="text-sm flex items-center gap-1 disabled:opacity-50" style={{ color: "var(--accent)" }}>
              <Download size={13} /> {exporting ? "Exporting..." : "Export PDF"}
            </button>
          </div>

          <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: "var(--surface-solid)" }}>
            {[
              { key: "summary", label: "Summary", icon: <FileText size={14} /> },
              { key: "transcript", label: "Transcript", icon: <FileText size={14} /> },
              { key: "concepts", label: "Concepts", icon: <FileQuestion size={14} /> },
            ].map((t) => (
              <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
                style={{
                  background: tab === t.key ? "var(--accent-glow)" : "transparent",
                  color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)",
                }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="glass rounded-2xl p-6">
            {tab === "summary" && (
              <p className="leading-relaxed whitespace-pre-wrap">{meeting.summary || "No summary available."}</p>
            )}

            {tab === "transcript" && (
              <div className="max-h-[600px] overflow-y-auto">
                <p className="leading-relaxed whitespace-pre-wrap font-mono text-sm">
                  {meeting.transcript || "No transcript available."}
                </p>
              </div>
            )}

            {tab === "concepts" && (
              <div className="space-y-5">
                {explained.length > 0 && (
                  <div>
                    <p className="text-xs font-mono mb-3" style={{ color: "var(--success)" }}>EXPLAINED IN THIS CONTENT</p>
                    <div className="space-y-3">
                      {explained.map((c, i) => (
                        <div key={i} className="px-4 py-3 rounded-xl" style={{ background: "var(--surface-solid)" }}>
                          <p className="font-medium mb-1">{c.name}</p>
                          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{c.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {referenced.length > 0 && (
                  <div>
                    <p className="text-xs font-mono mb-3" style={{ color: "var(--warning)" }}>REFERENCED BUT NOT EXPLAINED</p>
                    <div className="flex flex-wrap gap-2">
                      {referenced.map((c, i) => (
                        <span key={i} className="text-sm px-3 py-1.5 rounded-lg"
                          style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {meeting.concepts.length === 0 && (
                  <p style={{ color: "var(--text-muted)" }}>No concepts extracted.</p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}