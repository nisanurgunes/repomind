"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface WatchlistItem {
  id: number;
  repo: {
    id: number;
    full_name: string;
    description: string;
    stars: number;
    language: string;
    last_analyzed_at: string;
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export default function WatchlistSidebar() {
  const router = useRouter();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [featureCounts, setFeatureCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getWatchlist()
      .then((data) => setWatchlist(data.watchlist || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    api.getFeatureCounts().then((data) => setFeatureCounts(data.counts || {})).catch(() => {});
  }, []);

  const handleRemove = async (repoId: number) => {
    await api.removeFromWatchlist(repoId).catch(() => {});
    setWatchlist((prev) => prev.filter((i) => i.repo.id !== repoId));
  };

  return (
    <div className="px-4 pt-5 pb-3">
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
        Takip Listesi
      </p>
      {loading ? (
        <ul className="space-y-1">
          {[0, 1, 2].map((i) => (
            <li key={i} className="px-3 py-2.5">
              <div className="h-3.5 w-2/3 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
              <div className="h-2.5 w-1/3 rounded bg-gray-100 dark:bg-gray-800 animate-pulse mt-2" />
            </li>
          ))}
        </ul>
      ) : watchlist.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400 dark:text-gray-600">Henüz repo yok.</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Analiz et ve kaydet.</p>
        </div>
      ) : (
        <ul className="space-y-1">
          {watchlist.map((item) => {
            const pendingCount = featureCounts[item.repo.full_name] ?? 0;
            return (
              <li key={item.id} className="group flex items-start gap-1">
                <button
                  onClick={() => router.push(`/repo/${item.repo.full_name}`)}
                  className="flex-1 text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-w-0"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                      {item.repo.full_name}
                    </span>
                    {pendingCount > 0 && (
                      <span
                        onClick={(e) => { e.stopPropagation(); router.push(`/features?repo=${encodeURIComponent(item.repo.full_name)}`); }}
                        className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors cursor-pointer"
                        title={`${pendingCount} bekleyen feature önerisi`}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.repo.language && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{item.repo.language}</span>
                    )}
                    <span className="text-xs text-gray-400 dark:text-gray-500">⭐ {item.repo.stars?.toLocaleString()}</span>
                  </div>
                  {item.repo.last_analyzed_at && (
                    <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">{formatDate(item.repo.last_analyzed_at)}</p>
                  )}
                </button>
                <button
                  onClick={() => handleRemove(item.repo.id)}
                  className="mt-2.5 p-1 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all shrink-0"
                  title="Listeden kaldır"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
