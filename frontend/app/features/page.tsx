"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { api } from "@/lib/api";
import AppShell from "@/components/AppShell";

interface SavedFeature {
  id: number;
  repo_full_name: string;
  title: string;
  description: string;
  priority: string;
  effort: string;
  status: "pending" | "in_progress" | "done";
  seen_in: string[];
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  high:   "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800",
  medium: "bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800",
  low:    "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
};

const STATUS_CONFIG = {
  pending:     { label: "Bekliyor",    color: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" },
  in_progress: { label: "Yapılıyor",   color: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" },
  done:        { label: "Tamamlandı",  color: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300" },
};

const EFFORT_ICONS: Record<string, string> = { small: "⚡", medium: "🔧", large: "🏗️" };

function FeaturesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const repoFilter = searchParams.get("repo") || "";

  const [features, setFeatures] = useState<SavedFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(repoFilter);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!localStorage.getItem("devpulse_token")) { router.push("/"); return; }
    api.listFeatures()
      .then((d) => setFeatures(d.features || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const updateStatus = async (id: number, status: string) => {
    await api.updateFeatureStatus(id, status).catch(() => {});
    setFeatures((prev) => prev.map((f) => f.id === id ? { ...f, status: status as SavedFeature["status"] } : f));
  };

  const deleteFeature = async (id: number) => {
    await api.deleteFeature(id).catch(() => {});
    setFeatures((prev) => prev.filter((f) => f.id !== id));
  };

  const repos = [...new Set(features.map((f) => f.repo_full_name))];

  const filtered = features.filter((f) => {
    const repoMatch = !filter || f.repo_full_name === filter;
    const statusMatch = statusFilter === "all" || f.status === statusFilter;
    return repoMatch && statusMatch;
  });

  const counts = {
    all: features.length,
    pending: features.filter((f) => f.status === "pending").length,
    in_progress: features.filter((f) => f.status === "in_progress").length,
    done: features.filter((f) => f.status === "done").length,
  };

  return (
    <AppShell>
      <div className="px-8 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Feature Listesi</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Kaydedilen feature önerileri</p>
          </div>

          {/* Filtreler */}
          <div className="flex flex-wrap gap-3 mb-6">
            {/* Status filtre */}
            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              {(["all", "pending", "in_progress", "done"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-indigo-600 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {s === "all" ? "Tümü" : STATUS_CONFIG[s].label}
                  <span className="ml-1.5 text-xs opacity-70">
                    {counts[s]}
                  </span>
                </button>
              ))}
            </div>

            {/* Repo filtre */}
            {repos.length > 1 && (
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Tüm repolar</option>
                {repos.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
          </div>

          {/* Liste */}
          {loading ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-3xl mb-3 animate-pulse">📋</div>
              <p>Yükleniyor...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-600">
              <p className="text-4xl mb-3">✨</p>
              <p className="text-sm">
                {features.length === 0
                  ? "Henüz kaydedilmiş feature yok. Karşılaştır sayfasından önerileri kaydet."
                  : "Bu filtre için sonuç yok."}
              </p>
              {features.length === 0 && (
                <button
                  onClick={() => router.push("/compare")}
                  className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Feature Gap Analizi yap →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((f) => (
                <div
                  key={f.id}
                  className={`border rounded-xl p-5 ${PRIORITY_COLORS[f.priority] || PRIORITY_COLORS.medium}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{f.repo_full_name}</span>
                        <span className="text-xs opacity-50">•</span>
                        <span className="text-xs">{EFFORT_ICONS[f.effort]} {f.effort === "small" ? "Küçük" : f.effort === "medium" ? "Orta" : "Büyük"} efor</span>
                      </div>
                      <h3 className="font-semibold text-base text-gray-900 dark:text-white mb-1">{f.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">{f.description}</p>
                      {f.seen_in.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-gray-400">Görüldüğü projeler:</span>
                          {f.seen_in.map((r) => (
                            <a key={r} href={`https://github.com/${r}`} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                            >{r}</a>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Sağ taraf: status + sil */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <select
                        value={f.status}
                        onChange={(e) => updateStatus(f.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${STATUS_CONFIG[f.status].color}`}
                      >
                        <option value="pending">Bekliyor</option>
                        <option value="in_progress">Yapılıyor</option>
                        <option value="done">Tamamlandı</option>
                      </select>
                      <button
                        onClick={() => deleteFeature(f.id)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                        title="Sil"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function FeaturesPage() {
  return (
    <Suspense>
      <FeaturesContent />
    </Suspense>
  );
}
