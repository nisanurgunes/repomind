"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import AppShell from "@/components/AppShell";

interface Snapshot {
  health_score: number;
  commit_count_90d: number;
  open_issues: number;
  contributor_count: number;
  avg_issue_response_hours: number;
  avg_pr_merge_hours: number;
  date: string;
}

interface RepoDetail {
  id: number;
  full_name: string;
  description: string;
  stars: number;
  forks: number;
  language: string;
  last_analyzed_at: string | null;
  latest_snapshot: Snapshot | null;
}

interface ReadmeInfo {
  summary: string | null;
  tech_stack: string[];
}

interface AnalyzeResult {
  health_score: number;
  breakdown: Record<string, number>;
  metrics: Record<string, number | boolean>;
  recommendations: { area: string; severity: string; message: string }[];
  readme?: ReadmeInfo;
}

interface CommitChartData { week: string; commits: number }
interface HistoryData { date: string; health_score: number }

interface ContributorData {
  login: string;
  commits: number;
  percent: number;
  avatar_url: string | null;
}
interface ContributorsAnalysis {
  contributors: ContributorData[];
  total_commits: number;
  pr_metrics: { total: number; merged: number; open: number; avg_merge_hours: number | null };
  commit_heatmap: {
    hourly: { hour: string; commits: number }[];
    daily: { day: string; commits: number }[];
  };
  hot_spots: { file: string; changes: number }[];
}

interface SavedFeature {
  id: number;
  repo_full_name: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  effort: "small" | "medium" | "large";
  status: "pending" | "in_progress" | "done";
  seen_in: string[];
}

const PRIORITY_COLORS: Record<string, string> = {
  high:   "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800",
  medium: "bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800",
  low:    "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
};
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:     { label: "Bekliyor",   color: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" },
  in_progress: { label: "Yapılıyor", color: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" },
  done:        { label: "Tamamlandı", color: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300" },
};
const EFFORT_ICONS: Record<string, string> = { small: "⚡", medium: "🔧", large: "🏗️" };

const BREAKDOWN_LABELS: Record<string, string> = {
  commit_score: "Commit",
  issue_score: "Issue",
  pr_score: "PR",
  contributor_score: "Contributor",
  docs_score: "Dokümantasyon",
};

const SEVERITY_COLORS: Record<string, string> = {
  high: "border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-red-800 dark:text-red-300",
  medium: "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/40 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300",
  low: "border-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-800 text-blue-800 dark:text-blue-300",
};
const SEVERITY_LABEL: Record<string, string> = { high: "Kritik", medium: "Orta", low: "Düşük" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function RepoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const owner = params.owner as string;
  const name = params.name as string;

  const [repo, setRepo] = useState<RepoDetail | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [commitChart, setCommitChart] = useState<CommitChartData[]>([]);
  const [history, setHistory] = useState<HistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<"genel" | "ekip" | "features">("genel");
  const [teamData, setTeamData] = useState<ContributorsAnalysis | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [savedFeatures, setSavedFeatures] = useState<SavedFeature[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("devpulse_token")) { router.push("/"); return; }
    fetchAll();
  }, [owner, name]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchRepo(), fetchHistory(), fetchCommitChart()]);
    setLoading(false);
  };

  const fetchRepo = async () => {
    try { setRepo(await api.getRepo(owner, name)); } catch { setRepo(null); }
  };

  const fetchHistory = async () => {
    try {
      const data = await api.getRepoHistory(owner, name);
      setHistory(data.history || []);
    } catch {}
  };

  const fetchCommitChart = async () => {
    try {
      const data = await api.getCommitChart(owner, name);
      setCommitChart(data.chart_data || []);
    } catch {}
  };

  const fetchTeamData = async () => {
    if (teamData) return;
    setTeamLoading(true);
    try {
      const BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/api";
      const token = localStorage.getItem("devpulse_token");
      const res = await fetch(`${BASE}/repos/${owner}/${name}/contributors-analysis`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTeamData(await res.json());
    } catch {}
    setTeamLoading(false);
  };

  const fetchFeatures = async () => {
    if (savedFeatures.length > 0) return;
    setFeaturesLoading(true);
    try {
      const data = await api.listFeatures();
      const repoName = `${owner}/${name}`;
      setSavedFeatures((data.features || []).filter((f: SavedFeature) => f.repo_full_name === repoName));
    } catch {}
    setFeaturesLoading(false);
  };

  const handleTabChange = (tab: "genel" | "ekip" | "features") => {
    setActiveTab(tab);
    if (tab === "ekip") fetchTeamData();
    if (tab === "features") fetchFeatures();
  };

  const updateFeatureStatus = async (id: number, status: string) => {
    await api.updateFeatureStatus(id, status).catch(() => {});
    setSavedFeatures((prev) => prev.map((f) => f.id === id ? { ...f, status: status as SavedFeature["status"] } : f));
  };

  const deleteFeature = async (id: number) => {
    await api.deleteFeature(id).catch(() => {});
    setSavedFeatures((prev) => prev.filter((f) => f.id !== id));
  };

  const analyzeNow = async () => {
    setAnalyzing(true);
    try {
      const data = await api.analyzeRepo(owner, name);
      setAnalyzeResult(data);
      await Promise.all([fetchRepo(), fetchHistory(), fetchCommitChart()]);
    } catch (err) {
      console.error("Analiz başarısız", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const scoreColor = (s: number) =>
    s >= 80 ? "text-green-600" : s >= 60 ? "text-yellow-500" : "text-red-500";

  const snapshot = repo?.latest_snapshot;
  const displayScore = analyzeResult?.health_score ?? snapshot?.health_score;
  const breakdown = analyzeResult?.breakdown;
  const recommendations = analyzeResult?.recommendations;
  const metrics = analyzeResult?.metrics;
  const lastAnalyzedAt = repo?.last_analyzed_at;

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 dark:text-gray-400">Yükleniyor...</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Tab navigasyonu */}
        <div className="flex gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-1">
          {([
            { key: "genel",    label: "📊 Genel Analiz" },
            { key: "ekip",     label: "👥 Ekip Analizi" },
            { key: "features", label: "✨ Feature Önerileri" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === key
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {label}
              {key === "features" && savedFeatures.filter(f => f.status === "pending").length > 0 && (
                <span className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded-full">
                  {savedFeatures.filter(f => f.status === "pending").length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Repo başlık — her iki tabda da göster */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{owner}/{name}</h2>
              {repo?.description && <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">{repo.description}</p>}
              <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                {repo?.language && <span>🔵 {repo.language}</span>}
                {repo?.stars != null && <span>⭐ {repo.stars.toLocaleString()}</span>}
                {repo?.forks != null && <span>🍴 {repo.forks.toLocaleString()}</span>}
              </div>
            </div>
            <button
              onClick={analyzeNow}
              disabled={analyzing}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shrink-0 transition-colors"
            >
              {analyzing ? "Analiz ediliyor..." : displayScore != null ? "Güncelle" : "Analiz Et"}
            </button>
          </div>
        </div>

        {/* ===== GENEL ANALİZ TABI ===== */}
        {activeTab === "genel" && (<>

        {/* Skor + breakdown */}
        {displayScore != null ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Sağlık Skoru</h3>
            <div className="flex items-center gap-6 mb-6">
              <span className={`text-6xl font-bold ${scoreColor(displayScore)}`}>
                {displayScore}
              </span>
              <div>
                {lastAnalyzedAt && (
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Son analiz: {formatDate(lastAnalyzedAt)}
                  </p>
                )}
                {!analyzeResult && (
                  <button
                    onClick={analyzeNow}
                    disabled={analyzing}
                    className="mt-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                  >
                    {analyzing ? "Güncelleniyor..." : "Güncel veri için yenile →"}
                  </button>
                )}
              </div>
            </div>

            {breakdown && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {Object.entries(breakdown).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{BREAKDOWN_LABELS[key] ?? key}</p>
                    <p className={`text-2xl font-bold ${scoreColor(value)}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Snapshot metrikleri (analiz yoksa snapshot'tan) */}
            <div className="grid grid-cols-3 gap-3">
              {(() => {
                const m = (metrics ?? snapshot) as any;
                if (!m) return null;
                return (
                  <>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{m.commit_count_90d}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Commits (90 gün)</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{m.open_issues}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Açık Issue</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{m.contributor_count}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Contributor</p>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Dokümantasyon rozetleri */}
            {metrics && (
              <div className="flex gap-2 flex-wrap mt-4">
                {[
                  { key: "has_readme", label: "README" },
                  { key: "has_license", label: "LICENSE" },
                  { key: "has_contributing", label: "CONTRIBUTING" },
                  { key: "has_issue_template", label: "Issue Template" },
                ].map(({ key, label }) => (
                  <span
                    key={key}
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      (metrics as any)[key]
                        ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 line-through"
                    }`}
                  >
                    {(metrics as any)[key] ? "✓" : "✗"} {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center text-gray-400 dark:text-gray-600">
            <p className="mb-4">Bu repo henüz analiz edilmemiş.</p>
            <button
              onClick={analyzeNow}
              disabled={analyzing}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {analyzing ? "Analiz ediliyor..." : "Analiz Et"}
            </button>
          </div>
        )}

        {/* Proje Hakkında */}
        {analyzeResult?.readme && (analyzeResult.readme.summary || analyzeResult.readme.tech_stack.length > 0) && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Proje Hakkında</h3>
            {analyzeResult.readme.summary && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                {analyzeResult.readme.summary}
              </p>
            )}
            {analyzeResult.readme.tech_stack.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-2">Teknolojiler</p>
                <div className="flex flex-wrap gap-2">
                  {analyzeResult.readme.tech_stack.map((tech) => (
                    <span key={tech} className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-medium">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">İyileştirme Önerileri</h3>
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div key={i} className={`border rounded-lg px-4 py-3 ${SEVERITY_COLORS[rec.severity]}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold">{rec.area}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full border font-semibold bg-white dark:bg-gray-900 border-current opacity-70">
                      {SEVERITY_LABEL[rec.severity]}
                    </span>
                  </div>
                  <p className="text-sm">{rec.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skor geçmişi */}
        {history.length > 1 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Skor Geçmişi</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "#f9fafb" }}
                  formatter={(v) => [v ?? 0, "Skor"]}
                />
                <Line type="monotone" dataKey="health_score" stroke="#6366F1" strokeWidth={2} dot={{ r: 4, fill: "#6366F1" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Commit aktivite grafiği */}
        {commitChart.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Commit Aktivitesi (Son 90 Gün)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={commitChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "#f9fafb" }}
                />
                <Area type="monotone" dataKey="commits" stroke="#6366F1" fill="#312e81" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        </>)}

        {/* ===== FEATURE ÖNERİLERİ TABI ===== */}
        {activeTab === "features" && (
          <div className="space-y-4">
            {featuresLoading ? (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
                <div className="text-3xl mb-3 animate-pulse">✨</div>
                <p className="text-gray-500 dark:text-gray-400">Yükleniyor...</p>
              </div>
            ) : savedFeatures.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center text-gray-400 dark:text-gray-600">
                <p className="text-3xl mb-3">✨</p>
                <p className="text-sm mb-4">Bu repo için henüz kaydedilmiş feature yok.</p>
                <a
                  href="/compare"
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Feature Gap / Proje Analizi yap →
                </a>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {savedFeatures.length} öneri · {savedFeatures.filter(f => f.status === "pending").length} bekliyor · {savedFeatures.filter(f => f.status === "done").length} tamamlandı
                  </p>
                  <a href="/compare" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">+ Yeni öneri ekle</a>
                </div>
                <div className="space-y-3">
                  {savedFeatures.map((f) => (
                    <div key={f.id} className={`border rounded-xl p-5 ${PRIORITY_COLORS[f.priority] || PRIORITY_COLORS.medium}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs">{EFFORT_ICONS[f.effort]} {f.effort === "small" ? "Küçük" : f.effort === "medium" ? "Orta" : "Büyük"} efor</span>
                          </div>
                          <h3 className="font-semibold text-base text-gray-900 dark:text-white mb-1">{f.title}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">{f.description}</p>
                          {f.seen_in?.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs text-gray-400">Görüldüğü projeler:</span>
                              {f.seen_in.map((r) => (
                                <a key={r} href={`https://github.com/${r}`} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">{r}</a>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <select
                            value={f.status}
                            onChange={(e) => updateFeatureStatus(f.id, e.target.value)}
                            className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${STATUS_CONFIG[f.status].color}`}
                          >
                            <option value="pending">Bekliyor</option>
                            <option value="in_progress">Yapılıyor</option>
                            <option value="done">Tamamlandı</option>
                          </select>
                          <button
                            onClick={() => deleteFeature(f.id)}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                          >Sil</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== EKİP ANALİZİ TABI ===== */}
        {activeTab === "ekip" && (
          <div className="space-y-6">
            {teamLoading ? (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
                <div className="text-3xl mb-3 animate-pulse">👥</div>
                <p className="text-gray-500 dark:text-gray-400">Ekip verileri çekiliyor...</p>
              </div>
            ) : !teamData ? (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center text-gray-400">
                <p>Veri yüklenemedi.</p>
              </div>
            ) : (
              <>
                {/* PR Metrikleri */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">PR & Review Süreci</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Toplam PR", value: teamData.pr_metrics.total },
                      { label: "Merge Edildi", value: teamData.pr_metrics.merged },
                      { label: "Açık PR", value: teamData.pr_metrics.open },
                      { label: "Ort. Merge Süresi", value: teamData.pr_metrics.avg_merge_hours != null ? `${Math.round(teamData.pr_metrics.avg_merge_hours)}s` : "—" },
                    ].map((m) => (
                      <div key={m.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{m.value}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contributor dağılımı */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Contributor Dağılımı</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Son 90 günde toplam {teamData.total_commits} commit</p>
                  <div className="space-y-3">
                    {teamData.contributors.slice(0, 10).map((c) => (
                      <div key={c.login} className="flex items-center gap-3">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt={c.login} className="w-7 h-7 rounded-full" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            {c.login[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.login}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0 ml-2">{c.commits} commit ({c.percent}%)</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${c.percent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Commit zaman dağılımı */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Commit Zaman Dağılımı</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide font-semibold">Güne Göre</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={teamData.commit_heatmap.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                      <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "#f9fafb" }} />
                      <Area type="monotone" dataKey="commits" stroke="#6366F1" fill="#312e81" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 mb-3 uppercase tracking-wide font-semibold">Saate Göre</p>
                  <ResponsiveContainer width="100%" height={100}>
                    <AreaChart data={teamData.commit_heatmap.hourly}>
                      <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#6b7280" }} interval={3} />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                      <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "#f9fafb" }} />
                      <Area type="monotone" dataKey="commits" stroke="#10b981" fill="#064e3b" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Hot spot dosyalar */}
                {teamData.hot_spots.length > 0 && (
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Hot Spot Dosyalar</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">En sık değişen dosyalar — teknik borç göstergesi</p>
                    <div className="space-y-2">
                      {teamData.hot_spots.map((h, i) => (
                        <div key={h.file} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                            <span className="text-sm font-mono text-gray-700 dark:text-gray-300 truncate">{h.file}</span>
                          </div>
                          <span className="text-xs shrink-0 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 font-semibold">
                            {h.changes} değişiklik
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </main>
    </AppShell>
  );
}
