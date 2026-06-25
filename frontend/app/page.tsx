"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import Spinner from "@/components/Spinner";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.push(isLoggedIn() ? "/library" : "/login");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size={28} />
    </div>
  );
}