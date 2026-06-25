import type { Metadata } from "next";
import { Inter, Lora, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const lora = Lora({ variable: "--font-lora", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Recall — Your AI Learning Memory",
  description: "A persistent AI memory system for everything you watch or listen to.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${lora.variable} ${jetbrainsMono.variable}`}>
        <div className="bg-layer">
          <div className="bg-aura bg-aura-1" />
          <div className="bg-aura bg-aura-2" />
          <div className="bg-aura bg-aura-3" />
          <div className="bg-grid" />
        </div>
        <div className="content-layer">{children}</div>
      </body>
    </html>
  );
}