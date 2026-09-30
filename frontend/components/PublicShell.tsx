"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";

// Public sayfalar (skor kartı, karşılaştırma, trending) için: giriş yapmış
// kullanıcı normal navbar + sidebar'ı görür, ziyaretçi minimal bir header görür.
export default function PublicShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("devpulse_token"));
  }, []);

  if (isLoggedIn) return <AppShell>{children}</AppShell>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
        <button
          onClick={() => router.push("/")}
          className="text-lg font-bold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          RepoMind
        </button>
        <button
          onClick={() => router.push("/")}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Sen de analiz et →
        </button>
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  );
}
