"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, QuotaExceededError } from "@/lib/api";
import AppShell from "@/components/AppShell";
import UpgradePrompt from "@/components/UpgradePrompt";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Suggestion {
  title: string;
  description: string;
  seen_in: string[];
  priority: "high" | "medium" | "low";
  effort: "small" | "medium" | "large";
}

interface FeatureGapResult {
  similar_repos: { full_name: string; stars: number; description: string }[];
  suggestions: Suggestion[];
  summary: string;
}

interface ProjectSuggestion {
  title: string;
  description: string;
  rationale: string;
  priority: "high" | "medium" | "low";
  effort: "small" | "medium" | "large";
  category: string;
}

interface ProjectAnalysisResult {
  project_stage: "early" | "growing" | "mature";
  project_summary: string;
  suggestions: ProjectSuggestion[];
  focus_areas: string[];
}

interface MyRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  is_private: boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  high:   { label: "Yüksek", color: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300" },
  medium: { label: "Orta",   color: "bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300" },
  low:    { label: "Düşük",  color: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" },
};

const EFFORT_CONFIG = {
  small:  { label: "Küçük efor",  icon: "⚡" },
  medium: { label: "Orta efor",   icon: "🔧" },
  large:  { label: "Büyük efor",  icon: "🏗️" },
};

const CATEGORY_CONFIG: Record<string, { icon: string; label: string }> = {
  feature:  { icon: "✨", label: "Feature" },
  refactor: { icon: "♻️", label: "Refactor" },
  devops:   { icon: "🚀", label: "DevOps" },
  testing:  { icon: "🧪", label: "Test" },
  docs:     { icon: "📄", label: "Docs" },
  security: { icon: "🔒", label: "Güvenlik" },
};

const STAGE_CONFIG = {
  early:   { label: "Başlangıç Aşaması",  color: "text-orange-600 dark:text-orange-400", icon: "🌱" },
  growing: { label: "Gelişme Aşaması",    color: "text-blue-600 dark:text-blue-400",    icon: "📈" },
  mature:  { label: "Olgun Proje",         color: "text-green-600 dark:text-green-400",  icon: "🌳" },
};

// ─── Pagination ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 5;

function Pagination({ total, page, onChange }: { total: number; page: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-xs text-gray-400">
        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total} öneri
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
        >
          ← Önceki
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              p === page
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
        >
          Sonraki →
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const router = useRouter();
  const [tab, setTab] = useState<"compare" | "analyze" | "advisor">("compare");

  useEffect(() => {
    if (!localStorage.getItem("devpulse_token")) { router.push("/"); }
  }, [router]);

  return (
    <AppShell>
      <div className="px-8 py-8">
        <div className="max-w-3xl mx-auto">

          {/* Başlık */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Karşılaştır & Analiz</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Projenle benzer repoları karşılaştır veya kendi projenin gelişim sürecini AI ile analiz et.
            </p>
          </div>

          {/* Tab seçici */}
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-8 w-fit">
            <button
              onClick={() => setTab("compare")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === "compare"
                  ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              🔍 Benzer Proje Karşılaştır
            </button>
            <button
              onClick={() => setTab("analyze")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === "analyze"
                  ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              🤖 Kendi Projemi Analiz Et
            </button>
            <button
              onClick={() => setTab("advisor")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === "advisor"
                  ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              💬 Danışman
            </button>
          </div>

          {tab === "compare" && <CompareTab />}
          {tab === "analyze" && <AnalyzeTab />}
          {tab === "advisor" && <AdvisorTab />}
        </div>
      </div>
    </AppShell>
  );
}

// ─── Tab 1: Benzer Proje Karşılaştırması ─────────────────────────────────────

function CompareTab() {
  const [watchlist, setWatchlist] = useState<{ id: number; repo: { full_name: string; language: string } }[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [customRepo, setCustomRepo] = useState("");
  const [result, setResult] = useState<FeatureGapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"idle" | "finding" | "reading" | "analyzing">("idle");
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [quotaError, setQuotaError] = useState<QuotaExceededError | null>(null);

  useEffect(() => {
    api.getWatchlist().then((d) => setWatchlist(d.watchlist || [])).catch(() => {});
  }, []);

  const repo = selectedRepo || customRepo.trim();

  const saveFeature = async (s: Suggestion, index: number) => {
    if (!repo) return;
    setSaving(index);
    try {
      await api.saveFeature({
        repo_full_name: repo,
        title: s.title,
        description: s.description,
        priority: s.priority,
        effort: s.effort,
        seen_in: s.seen_in,
      });
      setSaved((prev) => new Set([...prev, index]));
    } catch {}
    setSaving(null);
  };

  const analyze = async () => {
    if (!repo) return;
    const [owner, name] = repo.split("/");
    if (!owner || !name) { setError("Geçerli bir repo gir (örn: facebook/react)"); return; }
    setError(""); setResult(null); setLoading(true); setStep("finding"); setPage(1);
    const t1 = setTimeout(() => setStep("reading"), 3000);
    const t2 = setTimeout(() => setStep("analyzing"), 7000);
    try {
      const data = await api.getFeatureGap(owner, name);
      setResult(data);
    } catch (e: any) {
      if (e instanceof QuotaExceededError) setQuotaError(e);
      else setError(e.message || "Analiz sırasında hata oluştu.");
    } finally {
      clearTimeout(t1); clearTimeout(t2);
      setLoading(false); setStep("idle");
    }
  };

  const stepLabels = {
    finding: "Benzer projeler aranıyor...",
    reading: "README'ler okunuyor...",
    analyzing: "Feature gap analizi yapılıyor...",
    idle: "",
  };

  return (
    <div>
      {quotaError && <UpgradePrompt error={quotaError} onClose={() => setQuotaError(null)} />}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">
          Karşılaştırılacak repo
        </p>
        {watchlist.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">Takip listenden seç:</p>
            <div className="flex flex-wrap gap-2">
              {watchlist.map((item) => {
                const isSelected = selectedRepo === item.repo.full_name;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedRepo(isSelected ? "" : item.repo.full_name); setCustomRepo(""); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      isSelected ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700"
                    }`}
                  >
                    {item.repo.full_name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <input
            type="text"
            value={selectedRepo || customRepo}
            onChange={(e) => { setCustomRepo(e.target.value); setSelectedRepo(""); }}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            placeholder="owner/repo-adı"
            disabled={!!selectedRepo}
            className="flex-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 disabled:opacity-60"
          />
          <button
            onClick={analyze}
            disabled={!repo || loading}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {loading ? "Analiz ediliyor..." : "Karşılaştır"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>

      {loading && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center">
          <div className="text-4xl mb-4 animate-pulse">
            {step === "finding" ? "🔍" : step === "reading" ? "📖" : "🤖"}
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">{stepLabels[step]}</p>
          <div className="mt-4 flex justify-center gap-2">
            {(["finding", "reading", "analyzing"] as const).map((s) => (
              <div key={s} className={`h-1.5 w-12 rounded-full transition-all duration-500 ${
                step === s ? "bg-indigo-600" :
                (["finding","reading","analyzing"].indexOf(step) > ["finding","reading","analyzing"].indexOf(s)) ? "bg-indigo-300" : "bg-gray-200 dark:bg-gray-700"
              }`} />
            ))}
          </div>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-5">
          <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2">Genel Değerlendirme</p>
            <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">{result.summary}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Karşılaştırılan Projeler</p>
            <div className="flex flex-wrap gap-2">
              {result.similar_repos.map((r) => (
                <a key={r.full_name} href={`https://github.com/${r.full_name}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                >
                  <span className="font-medium">{r.full_name}</span>
                  <span className="text-gray-400 text-xs">⭐ {r.stars.toLocaleString()}</span>
                </a>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{result.suggestions.length} Feature Önerisi</p>
            <div className="space-y-3">
              {result.suggestions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((s, i) => {
                const globalIndex = (page - 1) * PAGE_SIZE + i;
                return (
                <div key={globalIndex} className={`border rounded-xl p-5 ${PRIORITY_CONFIG[s.priority].color}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-base">{s.title}</h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium opacity-70">{EFFORT_CONFIG[s.effort].icon} {EFFORT_CONFIG[s.effort].label}</span>
                      <button
                        onClick={() => saveFeature(s, globalIndex)}
                        disabled={saved.has(globalIndex) || saving === globalIndex}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                          saved.has(globalIndex) ? "bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300" : "bg-white/60 dark:bg-gray-900/60 border-current opacity-70 hover:opacity-100"
                        }`}
                      >
                        {saved.has(globalIndex) ? "✓ Kaydedildi" : saving === globalIndex ? "..." : "+ Kaydet"}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed opacity-90 mb-3">{s.description}</p>
                  {s.seen_in.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs opacity-60">Görüldüğü projeler:</span>
                      {s.seen_in.map((r) => (
                        <a key={r} href={`https://github.com/${r}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
                        >{r}</a>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
            <Pagination total={result.suggestions.length} page={page} onChange={setPage} />
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <p className="text-4xl mb-4">🔭</p>
          <p className="text-sm">Repo seç veya gir — AI benzer projeleri bulup<br/>eksik feature önerileri sunsun.</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Kendi Projeni Analiz Et ──────────────────────────────────────────

function AnalyzeTab() {
  const [myRepos, setMyRepos] = useState<MyRepo[]>([]);
  const [watchlist, setWatchlist] = useState<{ id: number; repo: { full_name: string; language: string } }[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [customRepo, setCustomRepo] = useState("");
  const [result, setResult] = useState<ProjectAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"idle" | "reading" | "commits" | "analyzing">("idle");
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState<number | null>(null);
  const [repoSource, setRepoSource] = useState<"mine" | "watchlist">("mine");
  const [quotaError, setQuotaError] = useState<QuotaExceededError | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.getMyRepos().then((d) => setMyRepos(d.repos || [])).catch(() => {});
    api.getWatchlist().then((d) => setWatchlist(d.watchlist || [])).catch(() => {});
  }, []);

  const syncRepos = async () => {
    setSyncing(true);
    try {
      await api.syncMyRepos();
      const d = await api.getMyRepos();
      setMyRepos(d.repos || []);
    } catch (e: any) {
      setError(e.message || "Repolar yenilenemedi.");
    } finally {
      setSyncing(false);
    }
  };

  const repo = selectedRepo || customRepo.trim();

  const saveFeature = async (s: ProjectSuggestion, index: number) => {
    if (!repo) return;
    setSaving(index);
    try {
      await api.saveFeature({
        repo_full_name: repo,
        title: s.title,
        description: s.description,
        priority: s.priority,
        effort: s.effort,
        seen_in: [],
      });
      setSaved((prev) => new Set([...prev, index]));
    } catch {}
    setSaving(null);
  };

  const analyze = async () => {
    if (!repo) return;
    const [owner, name] = repo.split("/");
    if (!owner || !name) { setError("Geçerli bir repo gir (örn: owner/repo)"); return; }
    setError(""); setResult(null); setLoading(true); setStep("reading"); setPage(1);
    const t1 = setTimeout(() => setStep("commits"), 4000);
    const t2 = setTimeout(() => setStep("analyzing"), 8000);
    try {
      const data = await api.getProjectAnalysis(owner, name);
      setResult(data);
    } catch (e: any) {
      if (e instanceof QuotaExceededError) setQuotaError(e);
      else setError(e.message || "Analiz sırasında hata oluştu.");
    } finally {
      clearTimeout(t1); clearTimeout(t2);
      setLoading(false); setStep("idle");
    }
  };

  const stepLabels = {
    reading:   "Kod yapısı ve README okunuyor...",
    commits:   "Commit geçmişi ve issue'lar analiz ediliyor...",
    analyzing: "AI önerileri oluşturuluyor...",
    idle: "",
  };

  const displayRepos = repoSource === "mine"
    ? myRepos
    : watchlist.map((w) => ({
        id: w.id, full_name: w.repo.full_name, name: w.repo.full_name.split("/")[1],
        description: null, language: w.repo.language, stars: 0, is_private: false,
      }));

  return (
    <div>
      {quotaError && <UpgradePrompt error={quotaError} onClose={() => setQuotaError(null)} />}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">
          Analiz edilecek proje
        </p>

        {/* Kaynak seçici */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => { setRepoSource("mine"); setSelectedRepo(""); }}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
              repoSource === "mine"
                ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
            }`}
          >
            📁 Kendi Repolarım {myRepos.length > 0 && `(${myRepos.length})`}
          </button>
          <button
            onClick={() => { setRepoSource("watchlist"); setSelectedRepo(""); }}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
              repoSource === "watchlist"
                ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
            }`}
          >
            👁️ Takip Listesi
          </button>
          {repoSource === "mine" && (
            <button
              onClick={syncRepos}
              disabled={syncing}
              className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 transition-all disabled:opacity-40 flex items-center gap-1.5"
              title="GitHub'dan repoları yenile"
            >
              <span className={syncing ? "animate-spin" : ""}>↻</span>
              {syncing ? "Yenileniyor..." : "Yenile"}
            </button>
          )}
        </div>

        {/* Repo listesi */}
        {displayRepos.length > 0 ? (
          <div className="mb-4 max-h-48 overflow-y-auto space-y-1 pr-1">
            {displayRepos.map((r) => {
              const isSelected = selectedRepo === r.full_name;
              return (
                <button
                  key={r.full_name}
                  onClick={() => { setSelectedRepo(isSelected ? "" : r.full_name); setCustomRepo(""); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                    isSelected
                      ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700"
                      : "border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-200"}`}>
                      {r.full_name}
                      {r.is_private && <span className="ml-1.5 text-xs text-gray-400">🔒</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      {r.language && <span className="text-xs text-gray-400">{r.language}</span>}
                      {r.stars > 0 && <span className="text-xs text-gray-400">⭐ {r.stars}</span>}
                    </div>
                  </div>
                  {r.description && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{r.description}</p>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-4">
            {repoSource === "mine"
              ? "Repoların görünmesi için tekrar giriş yap (login'de otomatik çekilir)."
              : "Takip listende henüz repo yok."}
          </p>
        )}

        {/* Manuel giriş */}
        <div className="flex gap-3">
          <input
            type="text"
            value={selectedRepo || customRepo}
            onChange={(e) => { setCustomRepo(e.target.value); setSelectedRepo(""); }}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            placeholder="owner/repo-adı (manuel gir)"
            disabled={!!selectedRepo}
            className="flex-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 disabled:opacity-60"
          />
          <button
            onClick={analyze}
            disabled={!repo || loading}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {loading ? "Analiz ediliyor..." : "Analiz Et"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>

      {loading && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center">
          <div className="text-4xl mb-4 animate-pulse">
            {step === "reading" ? "📂" : step === "commits" ? "📋" : "🤖"}
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">{stepLabels[step]}</p>
          <div className="mt-4 flex justify-center gap-2">
            {(["reading", "commits", "analyzing"] as const).map((s) => (
              <div key={s} className={`h-1.5 w-12 rounded-full transition-all duration-500 ${
                step === s ? "bg-indigo-600" :
                (["reading","commits","analyzing"].indexOf(step) > ["reading","commits","analyzing"].indexOf(s)) ? "bg-indigo-300" : "bg-gray-200 dark:bg-gray-700"
              }`} />
            ))}
          </div>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-5">
          {/* Proje özeti */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{STAGE_CONFIG[result.project_stage]?.icon}</span>
              <div>
                <p className={`text-sm font-semibold ${STAGE_CONFIG[result.project_stage]?.color}`}>
                  {STAGE_CONFIG[result.project_stage]?.label}
                </p>
                <p className="text-xs text-gray-400">Proje aşaması</p>
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-3">{result.project_summary}</p>
            {result.focus_areas?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.focus_areas.map((area) => (
                  <span key={area} className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {area}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Öneriler */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              {result.suggestions.length} Geliştirme Önerisi
            </p>
            <div className="space-y-3">
              {result.suggestions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((s, i) => {
                const globalIndex = (page - 1) * PAGE_SIZE + i;
                return (
                <div key={globalIndex} className={`border rounded-xl p-5 ${PRIORITY_CONFIG[s.priority].color}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{CATEGORY_CONFIG[s.category]?.icon || "💡"}</span>
                      <h3 className="font-semibold text-base">{s.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium opacity-70">{EFFORT_CONFIG[s.effort].icon} {EFFORT_CONFIG[s.effort].label}</span>
                      <button
                        onClick={() => saveFeature(s, globalIndex)}
                        disabled={saved.has(globalIndex) || saving === globalIndex}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                          saved.has(globalIndex) ? "bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300" : "bg-white/60 dark:bg-gray-900/60 border-current opacity-70 hover:opacity-100"
                        }`}
                      >
                        {saved.has(globalIndex) ? "✓ Kaydedildi" : saving === globalIndex ? "..." : "+ Kaydet"}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed opacity-90 mb-2">{s.description}</p>
                  {s.rationale && (
                    <p className="text-xs opacity-60 italic border-t border-current/20 pt-2 mt-2">
                      💡 {s.rationale}
                    </p>
                  )}
                  <div className="mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/40 dark:bg-black/20 font-medium">
                      {CATEGORY_CONFIG[s.category]?.label || s.category}
                    </span>
                  </div>
                </div>
                );
              })}
            </div>
            <Pagination total={result.suggestions.length} page={page} onChange={setPage} />
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <p className="text-4xl mb-4">🤖</p>
          <p className="text-sm">Projeyi seç — AI commit geçmişini ve kod yapısını okuyup<br/>sana özel geliştirme önerileri sunsun.</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Danışman Chat ─────────────────────────────────────────────────────

interface ChatMessage { role: "user" | "assistant"; content: string }

function AdvisorTab() {
  const [myRepos, setMyRepos] = useState<MyRepo[]>([]);
  const [watchlist, setWatchlist] = useState<{ id: number; repo: { full_name: string; language: string } }[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [repoContext, setRepoContext] = useState<object | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [repoSource, setRepoSource] = useState<"mine" | "watchlist">("mine");
  const bottomRef = useState<HTMLDivElement | null>(null);
  const [quotaError, setQuotaError] = useState<QuotaExceededError | null>(null);
  // Session içi analiz cache — geri gelince tekrar analiz yapma
  const analysisCache = useRef<Record<string, { context: object; messages: ChatMessage[] }>>({});

  useEffect(() => {
    api.getMyRepos().then((d) => setMyRepos(d.repos || [])).catch(() => {});
    api.getWatchlist().then((d) => setWatchlist(d.watchlist || [])).catch(() => {});
  }, []);

  const selectRepo = async (fullName: string) => {
    if (selectedRepo === fullName) return;
    setSelectedRepo(fullName);

    // Session cache: bu repo daha önce analiz edildiyse direkt yükle
    if (analysisCache.current[fullName]) {
      const { context, messages: cachedMessages } = analysisCache.current[fullName];
      setRepoContext(context);
      setMessages(cachedMessages);
      return;
    }

    setMessages([]);
    setRepoContext(null);
    setLoadingContext(true);
    try {
      const [owner, name] = fullName.split("/");

      // Son commit SHA'sını çek — cache geçerliliği buna göre belirlenir
      const [repoData, commitRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${fullName}`).then(r => r.json()),
        fetch(`https://api.github.com/repos/${fullName}/commits?per_page=1`).then(r => r.json()).catch(() => []),
      ]);
      const latestSha = Array.isArray(commitRes) && commitRes[0]?.sha ? commitRes[0].sha.slice(0, 8) : "";

      // Cache: aynı commit SHA'ya sahip analiz varsa tekrar çağırma
      const cacheKey = `advisor_analysis_${fullName}`;
      let analysis: any = null;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, sha } = JSON.parse(cached);
          if (sha === latestSha) analysis = data;
        }
      } catch {}

      // Gerekirse derin analiz yap
      if (!analysis) {
        analysis = await api.getProjectAnalysis(owner, name).catch(() => null);
        if (analysis && latestSha) {
          try { localStorage.setItem(cacheKey, JSON.stringify({ data: analysis, sha: latestSha })); } catch {}
        }
      }

      const ctx = {
        description: repoData.description || "",
        language: repoData.language || "",
        topics: repoData.topics || [],
        project_stage: analysis?.project_stage || "",
        project_summary: analysis?.project_summary || "",
        focus_areas: analysis?.focus_areas || [],
        top_suggestions: (analysis?.suggestions || []).slice(0, 3).map((s: any) => s.title),
      };
      setRepoContext(ctx);

      // İlk mesaj: analiz özeti
      let firstMessage: ChatMessage;
      if (analysis) {
        const stageLabel = { early: "başlangıç", growing: "gelişme", mature: "olgunluk" }[analysis.project_stage as string] || "";
        const suggestions = (analysis.suggestions || []).slice(0, 3);
        const suggestionList = suggestions.map((s: any) => `• **${s.title}**`).join("\n");

        firstMessage = {
          role: "assistant",
          content: `**${fullName}** projesini inceledim.\n\n${analysis.project_summary}\n\nProje şu an **${stageLabel} aşamasında**. Öne çıkan geliştirme alanları:\n${suggestionList}\n\nBu önerilerden birini derinlemesine konuşmak ister misin, yoksa farklı bir konu mu var aklında?`,
        };
      } else {
        firstMessage = {
          role: "assistant",
          content: `**${fullName}** projesine baktım.${repoData.description ? ` "${repoData.description}"` : ""} Ne konuşmak istersin?`,
        };
      }
      setMessages([firstMessage]);
      // Session cache'e kaydet
      analysisCache.current[fullName] = { context: ctx, messages: [firstMessage] };
    } catch {
      setRepoContext({});
    }
    setLoadingContext(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedRepo || sending) return;
    const [owner, name] = selectedRepo.split("/");
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setSending(true);
    try {
      const data = await api.advisorChat(
        owner, name,
        newMessages.map(m => ({ role: m.role, content: m.content })),
        repoContext || {}
      );
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      if (e instanceof QuotaExceededError) setQuotaError(e);
      else setMessages(prev => [...prev, { role: "assistant", content: "Bir hata oluştu. Tekrar deneyin." }]);
    }
    setSending(false);
  };

  const displayRepos = repoSource === "mine"
    ? myRepos
    : watchlist.map(w => ({
        id: w.id, full_name: w.repo.full_name, name: w.repo.full_name.split("/")[1],
        description: null, language: w.repo.language, stars: 0, is_private: false,
      }));

  if (!selectedRepo) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">
            Hangi proje hakkında konuşalım?
          </p>
          <div className="flex gap-2 mb-4">
            {(["mine", "watchlist"] as const).map(src => (
              <button key={src} onClick={() => setRepoSource(src)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                  repoSource === src
                    ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                    : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                }`}
              >
                {src === "mine" ? `📁 Kendi Repolarım ${myRepos.length > 0 ? `(${myRepos.length})` : ""}` : "👁️ Takip Listesi"}
              </button>
            ))}
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {displayRepos.map(r => (
              <button key={r.full_name} onClick={() => selectRepo(r.full_name)}
                className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{r.full_name}</span>
                  {r.language && <span className="text-xs text-gray-400">{r.language}</span>}
                </div>
                {r.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{r.description}</p>}
              </button>
            ))}
            {displayRepos.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">Repo bulunamadı.</p>
            )}
          </div>
        </div>
        <div className="text-center py-8 text-gray-400 dark:text-gray-600">
          <p className="text-3xl mb-3">💬</p>
          <p className="text-sm">Projeyi seç ve fikirlerini benimle tartış.<br/>Ürün, özellik, farklılaşma — her şey açık.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}>
      {quotaError && <UpgradePrompt error={quotaError} onClose={() => setQuotaError(null)} />}
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => { setSelectedRepo(""); setMessages([]); }}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >← Geri</button>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{selectedRepo}</span>
          {loadingContext && <span className="text-xs text-gray-400 animate-pulse">Proje okunuyor...</span>}
        </div>
        <button onClick={() => { setMessages([]); if (repoContext) setMessages([{
          role: "assistant",
          content: `Konuşmayı sıfırladım. **${selectedRepo}** hakkında başka ne konuşmak istersin?`
        }]); }}
          className="text-xs text-gray-400 hover:text-red-400 transition-colors"
        >Sıfırla</button>
      </div>

      {/* Mesajlar */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {messages.length === 0 && loadingContext && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-3xl mb-3 animate-pulse">🔍</div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Proje analiz ediliyor...</p>
            <p className="text-xs mt-1">Kod yapısı, commit geçmişi ve issue'lar inceleniyor.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              m.role === "user"
                ? "bg-indigo-600 text-white rounded-br-sm"
                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm"
            }`}>
              {m.content.split("\n").map((line, j) => (
                <span key={j}>
                  {line.replace(/\*\*(.*?)\*\*/g, "$1")}
                  {j < m.content.split("\n").length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1.5 items-center h-4">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hızlı sorular */}
      {messages.length <= 1 && !sending && repoContext && (
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            "Hangi özellikleri öncelikli eklemeliyim?",
            "Rakiplerden nasıl farklılaşabilirim?",
            "Bu projeyi büyütmek için ne yapmalıyım?",
            "En büyük teknik riskler neler?",
          ].map(q => (
            <button key={q} onClick={() => { setInput(q); }}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Bir fikrin mi var? Sor..."
          disabled={!repoContext || loadingContext || sending}
          className="flex-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || !repoContext || loadingContext || sending}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors shrink-0"
        >
          Gönder
        </button>
      </div>
    </div>
  );
}
