"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

interface TrendingRepo {
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  html_url: string;
}

type Period = "daily" | "weekly" | "monthly";

const PERIOD_CONFIG: Record<Period, { label: string; days: number }> = {
  daily:   { label: "Bugün",   days: 1 },
  weekly:  { label: "Bu Hafta", days: 7 },
  monthly: { label: "Bu Ay",   days: 30 },
};

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5",
  Go: "#00ADD8", Rust: "#dea584", Java: "#b07219", "C++": "#f34b7d",
  C: "#555555", Ruby: "#701516", Swift: "#F05138", Kotlin: "#A97BFF",
};

export default function TrendingPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("weekly");
  const [language, setLanguage] = useState("");
  const [repos, setRepos] = useState<TrendingRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("devpulse_token"));
    fetchTrending("weekly", "");
  }, []);

  const fetchTrending = async (p: Period, lang: string) => {
    setLoading(true);
    setRepos([]);
    try {
      const days = PERIOD_CONFIG[p].days;
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const langQuery = lang ? `+language:${encodeURIComponent(lang)}` : "";
      const url = `https://api.github.com/search/repositories?q=created:>${since}${langQuery}&sort=stars&order=desc&per_page=25`;
      const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
      const data = await res.json();
      setRepos(data.items || []);
    } catch {
      setRepos([]);
    } finally {
      setLoading(false);
    }
  };

  const apply = () => fetchTrending(period, language);

  const content = (
    <div className="max-w-3xl mx-auto w-full px-6 py-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Trending Repolar</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">GitHub&apos;da öne çıkan repolar</p>

      {/* Filtreler */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-6 flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          {(Object.keys(PERIOD_CONFIG) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => { setPeriod(p); fetchTrending(p, language); }}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                period === p
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {PERIOD_CONFIG[p].label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          placeholder="Dil (örn: TypeScript)"
          className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 w-44"
        />

        <button
          onClick={apply}
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Yükleniyor..." : "Filtrele"}
        </button>
      </div>

      {/* Repo listesi */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-3xl mb-3 animate-pulse">📡</div>
          <p>GitHub&apos;dan çekiliyor...</p>
        </div>
      ) : repos.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <p className="text-4xl mb-3">📭</p>
          <p>Sonuç bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {repos.map((repo, i) => (
            <div
              key={repo.full_name}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-bold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate"
                    >
                      {repo.full_name}
                    </a>
                  </div>
                  {repo.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{repo.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-400 dark:text-gray-500">
                    {repo.language && (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full inline-block"
                          style={{ backgroundColor: LANG_COLORS[repo.language] ?? "#8b8b8b" }}
                        />
                        {repo.language}
                      </span>
                    )}
                    <span>⭐ {repo.stargazers_count.toLocaleString()}</span>
                    <span>🍴 {repo.forks_count.toLocaleString()}</span>
                  </div>
                </div>
                {isLoggedIn && (
                  <button
                    onClick={() => {
                      const [owner, name] = repo.full_name.split("/");
                      router.push(`/repo/${owner}/${name}`);
                    }}
                    className="shrink-0 text-xs border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors font-medium"
                  >
                    Analiz Et →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Giriş yapmış kullanıcılar için AppShell (sidebar ile birlikte)
  if (isLoggedIn) {
    return <AppShell>{content}</AppShell>;
  }

  // Giriş yapılmamış kullanıcılar için minimal layout
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="text-lg font-bold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          RepoMind
        </button>
        <button
          onClick={() => router.push("/")}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          ← Anasayfaya Dön
        </button>
      </nav>
      <main>{content}</main>
    </div>
  );
}
