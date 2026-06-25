"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Video, ChevronRight, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

interface MeetingItem {
  id: string;
  title: string | null;
  source: string;
  status: string;
  created_at: string;
}

export default function SourcesList({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.listTopicMeetings(topicId).then(setMeetings).catch(() => {}).finally(() => setLoading(false));
  }, [topicId]);

  if (loading || meetings.length === 0) return null;

  return (
    <div className="mb-6">
      <button onClick={() => setOpen(!open)}
        className="glass glow-hover flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm">
        <Video size={16} style={{ color: "var(--accent)" }} />
        {meetings.length} source{meetings.length === 1 ? "" : "s"} in this topic
      </button>

      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="glass rounded-2xl p-3 mt-2 space-y-1.5">
          {meetings.map((m) => (
            <button key={m.id} onClick={() => router.push(`/topics/${topicId}/meetings/${m.id}`)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm glow-hover text-left"
              style={{ background: "var(--surface-solid)" }}>
              <div className="flex-1 min-w-0">
                <p className="truncate">{m.title || "Untitled"}</p>
                <p className="text-[11px] font-mono truncate flex items-center gap-1 mt-0.5" style={{ color: "var(--text-muted)" }}>
                  <Clock size={10} /> {new Date(m.created_at).toLocaleDateString()}
                </p>
              </div>
              <ChevronRight size={14} style={{ color: "var(--cyan)", flexShrink: 0, marginLeft: 8 }} />
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}