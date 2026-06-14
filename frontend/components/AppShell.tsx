"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import NotificationBell from "@/components/NotificationBell";
import WatchlistSidebar from "@/components/WatchlistSidebar";

function ThemeToggle() {
  const toggle = () => {
    const html = document.documentElement;
    html.classList.toggle("dark");
    localStorage.setItem("theme", html.classList.contains("dark") ? "dark" : "light");
  };
  return (
    <button
      onClick={toggle}
      className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      title="Tema değiştir"
    >
      <svg className="w-5 h-5 block dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
      <svg className="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    </button>
  );
}

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Anasayfa",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    href: "/compare",
    label: "Karşılaştır",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    href: "/trending",
    label: "Trending",
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  },
  {
    href: "/org/new",
    label: "Organizasyon",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
  {
    href: "/docs",
    label: "Dokümanlar",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
];

interface AppShellProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
}

export default function AppShell({ children, hideSidebar }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Mount öncesi sidebar render edilmez — flash önlenir
  useEffect(() => {
    const saved = localStorage.getItem("devpulse_sidebar");
    setSidebarOpen(saved === null ? true : saved === "true");
    setMounted(true);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem("devpulse_sidebar", String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          {/* Sidebar toggle */}
          {!hideSidebar && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Sidebar'ı aç/kapat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          {/* Logo */}
          <button
            onClick={() => router.push("/dashboard")}
            className="text-lg font-bold text-gray-900 dark:text-white mr-3 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            DevPulse
          </button>

          {/* Nav items */}
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          <ThemeToggle />
          <button
            onClick={() => {
              localStorage.removeItem("devpulse_token");
              router.push("/");
            }}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Çıkış yap
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {!hideSidebar && mounted && (
          <aside
            className={`shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-hidden transition-all duration-300 ease-in-out ${
              sidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0"
            }`}
          >
            <div className="w-64 overflow-y-auto h-full">
              <WatchlistSidebar />
            </div>
          </aside>
        )}

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
