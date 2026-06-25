"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brain, LogOut } from "lucide-react";
import { clearToken } from "@/lib/auth";

export default function TopBar() {
  const router = useRouter();
  function handleLogout() {
    clearToken();
    router.push("/login");
  }
  return (
    <div className="glass sticky top-0 z-50 flex items-center justify-between px-6 py-3 mb-8"
         style={{ borderLeft: "none", borderRight: "none", borderTop: "none" }}>
      <Link href="/library" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
             style={{ background: "linear-gradient(135deg, var(--accent), #6366f1)" }}>
          <Brain size={16} color="white" />
        </div>
        <span className="font-display text-lg shimmer">Recall</span>
      </Link>
      <button onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm glow-hover"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
        <LogOut size={15} /> Logout
      </button>
    </div>
  );
}