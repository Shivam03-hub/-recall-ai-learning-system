"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Video, MessageSquare, FileText, GraduationCap, Calendar } from "lucide-react";
import { api } from "@/lib/api";

interface Stats {
  meetingCount: number;
  chatCount: number;
  pdfCount: number;
  quizCount: number;
  createdAt?: string;
}

export default function TopicStats({ topicId, topicName }: { topicId: string; topicName: string }) {
  const [stats, setStats] = useState<Stats>({ meetingCount: 0, chatCount: 0, pdfCount: 0, quizCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getChatHistory(topicId).catch(() => []),
      api.getPdfHistory(topicId).catch(() => []),
      api.listQuizzes(topicId).catch(() => []),
    ]).then(([chats, pdfs, quizzes]) => {
      setStats({
        meetingCount: new Set(
          chats.flatMap((c: { sources?: string[] }) => c.sources || [])
        ).size,
        chatCount: chats.length,
        pdfCount: pdfs.length,
        quizCount: quizzes.length,
      });
      setLoading(false);
    });
  }, [topicId]);

  const items = [
    { icon: <Video size={16} />, label: "Sources", value: stats.meetingCount, color: "var(--cyan)" },
    { icon: <MessageSquare size={16} />, label: "Questions asked", value: stats.chatCount, color: "var(--accent)" },
    { icon: <FileText size={16} />, label: "PDFs generated", value: stats.pdfCount, color: "var(--success)" },
    { icon: <GraduationCap size={16} />, label: "Quizzes taken", value: stats.quizCount, color: "var(--warning)" },
  ];

  return (
    <div className="glass rounded-2xl p-5 w-full">
      <p className="font-display text-lg mb-1">{topicName}</p>
      <p className="text-xs font-mono flex items-center gap-1 mb-5" style={{ color: "var(--text-muted)" }}>
        <Calendar size={11} /> Active topic
      </p>

      <div className="space-y-3">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl"
            style={{ background: "var(--surface-solid)" }}
          >
            <div className="flex items-center gap-2.5">
              <div style={{ color: item.color }}>{item.icon}</div>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{item.label}</span>
            </div>
            <span className="font-mono text-sm font-medium">
              {loading ? "—" : item.value}
            </span>
          </motion.div>
        ))}
      </div>

      <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Recall remembers everything across this topic and connects answers back to their original source.
        </p>
      </div>
    </div>
  );
}