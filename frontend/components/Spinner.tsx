"use client";

import { motion } from "framer-motion";

export default function Spinner({ size = 20 }: { size?: number }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
      style={{
        width: size,
        height: size,
        border: `2px solid var(--border)`,
        borderTopColor: "var(--accent)",
        borderRadius: "50%",
      }}
    />
  );
}