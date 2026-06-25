"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, GitCompareArrows, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";

interface Flag {
  id: string;
  concept_name: string | null;
  description: string;
}

export default function KnowledgeFlags({ topicId }: { topicId: string }) {
  const [gaps, setGaps] = useState<Flag[]>([]);
  const [contradictions, setContradictions] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.getKnowledgeFlags(topicId)
      .then((res) => {
        setGaps(res.gaps || []);
        setContradictions(res.contradictions || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [topicId]);

  if (loading) return null;
  if (gaps.length === 0 && contradictions.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {contradictions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)" }}>
          <p className="flex items-center gap-2 font-medium mb-3" style={{ color: "var(--danger)" }}>
            <GitCompareArrows size={16} />
            {contradictions.length} {contradictions.length === 1 ? "contradiction" : "contradictions"} found across sources
          </p>
          <div className="space-y-2">
            {contradictions.map((c) => (
              <div key={c.id}>
                <button
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--surface-solid)" }}
                >
                  <span className="line-clamp-1">{c.concept_name || "Conflicting claims"}</span>
                  <ChevronDown size={14} style={{
                    transform: expanded === c.id ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                    color: "var(--text-muted)",
                    flexShrink: 0,
                  }} />
                </button>
                <AnimatePresence>
                  {expanded === c.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <p className="text-sm px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>
                        {c.description}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {gaps.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl p-4" style={{ background: "var(--warning-bg)", border: "1px solid var(--warning)" }}>
          <p className="flex items-center gap-2 font-medium mb-3" style={{ color: "var(--warning)" }}>
            <AlertTriangle size={16} />
            {gaps.length} knowledge gap{gaps.length === 1 ? "" : "s"} detected
          </p>
          <div className="space-y-2">
            {gaps.map((g) => (
              <div key={g.id}>
                <button
                  onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                  className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--surface-solid)" }}
                >
                  <span className="line-clamp-1">{g.concept_name || "Unexplained concept"}</span>
                  <ChevronDown size={14} style={{
                    transform: expanded === g.id ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                    color: "var(--text-muted)",
                    flexShrink: 0,
                  }} />
                </button>
                <AnimatePresence>
                  {expanded === g.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <p className="text-sm px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>
                        {g.description}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}