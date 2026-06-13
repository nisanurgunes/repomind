"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import AppShell from "@/components/AppShell";

interface ReadmeInfo {
  summary: string | null;
  tech_stack: string[];
}

interface AnalysisResult {
  id: number;
  repo: string;
  health_score: number;
  analyzed_at?: string;
  readme?: ReadmeInfo;
  breakdown: Record<string, number>;
  metrics: {
    commit_count_90d: number;
    open_issues: number;
    contributor_count: number;
    stars: number;
    forks: number;
    has_readme: boolean;
    has_license: boolean;
    has_contributing: boolean;
    has_issue_template: boolean;
  };
  recommendations: { area: string; severity: string; message: string }[];
}

const SEVERITY_COLORS: Record<string, string> = {
  high: "border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-red-800 dark:text-red-300",
  medium: "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/40 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300",
  low: "border-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-800 text-blue-800 dark:text-blue-300",
};
const SEVERITY_LABEL: Record<string, string> = { high: "Kritik", medium: "Orta", low: "Düşük" };
const BREAKDOWN_LABELS: Record<string, string> = {
  commit_score: "Commit",
  issue_score: "Issue",
  pr_score: "PR",
  contributor_score: "Contributor",
  docs_score: "Dokümantasyon",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

const scoreColor = (s: number) =>
  s >= 80 ? "text-green-600" : s >= 60 ? "text-yellow-500" : "text-red-500";

const scoreBg = (s: number) =>
  s >= 80
    ? "border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800"
    : s >= 60
    ? "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800"
    : "border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800";

export default function Dashboard() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [scoreHistory, setScoreHistory] = useState<{ date: string; score: number }[]>([]);

  const loadHistory = () => {
    try {
      const saved = localStorage.getItem("devpulse_history");
      setHistory(saved ? JSON.parse(saved) : []);
    } catch { setHistory([]); }
  };

  const saveToHistory = (repo: string) => {
    try {
      const saved = localStorage.getItem("devpulse_history");
      const prev: string[] = saved ? JSON.parse(saved) : [];
      const updated = [repo, ...prev.filter((r) => r !== repo)].slice(0, 8);
      localStorage.setItem("devpulse_history", JSON.stringify(updated));
      setHistory(updated);
    } catch {}
  };

  useEffect(() => {
    if (!localStorage.getItem("devpulse_token")) { router.push("/"); return; }
    loadHistory();
  }, [router]);

  const analyzeRepo = async (forceRefresh = false) => {
    setError("");
    if (!forceRefresh) setResult(null);
    const parts = input.trim().split("/");
    if (parts.length !== 2) {
      setError("'owner/repo' formatında gir. Örnek: facebook/react");
      return;
    }
    const [owner, name] = parts;
    setLoading(true);
    try {
      const data = await api.analyzeRepo(owner, name);
      setResult({ ...data, analyzed_at: new Date().toISOString() });
      saveToHistory(`${owner}/${name}`);
      api.getRepoHistory(owner, name).then((h) => {
        setScoreHistory((h.snapshots || []).map((s: any) => ({ date: s.date?.slice(0, 10) ?? "", score: s.health_score })).reverse());
      }).catch(() => {});
    } catch {
      setError("Repo analiz edilemedi. Repo adını kontrol et.");
    } finally {
      setLoading(false);
    }
  };

  const saveToWatchlist = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await api.addToWatchlist(result.id);
      setError("");
    } catch (e: any) {
      setError(e.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="px-8 py-8">
        <div className="max-w-2xl mx-auto">

          {/* Sayfa başlığı — analiz yoksa göster */}
          {!result && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">GitHub Repo Analizi</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Bir GitHub reposunu analiz ederek 0–100 arası sağlık skoru üret. Commit aktivitesi, issue yanıt süresi, PR hızı, contributor sayısı ve dokümantasyon kalitesi değerlendirilir.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: "📝", label: "Commit Aktivitesi", desc: "Son 90 günde kaç commit atıldı?" },
                  { icon: "🐛", label: "Issue Yanıt Süresi", desc: "Issue'lar ortalama kaç saatte kapanıyor?" },
                  { icon: "🔀", label: "PR Hızı", desc: "PR'lar ne kadar hızlı merge ediliyor?" },
                  { icon: "👥", label: "Contributor", desc: "Kaç farklı kişi katkı sağlıyor?" },
                  { icon: "📄", label: "Dokümantasyon", desc: "README, LICENSE, CONTRIBUTING var mı?" },
                  { icon: "🏷️", label: "Teknoloji Tespiti", desc: "README'den teknoloji yığını çıkarılır." },
                ].map((item) => (
                  <div key={item.label} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{item.icon}</span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{item.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Arama */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Repo adı</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && analyzeRepo()}
                placeholder="facebook/react"
                className="flex-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <button
                onClick={() => analyzeRepo()}
                disabled={loading}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Analiz ediliyor..." : "Analiz Et"}
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            {history.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {history.map((repo) => (
                  <button
                    key={repo}
                    onClick={() => setInput(repo)}
                    className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    {repo}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Analiz sonucu */}
          {result && (
            <>
              {/* Skor kartı */}
              <div className={`bg-white dark:bg-gray-900 rounded-xl border p-5 mb-4 ${scoreBg(result.health_score)}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{result.repo}</h3>
                    {result.analyzed_at && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Son analiz: {formatDate(result.analyzed_at)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-4xl font-bold ${scoreColor(result.health_score)}`}>{result.health_score}</span>
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => analyzeRepo(true)} disabled={loading} className="text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors">
                        {loading ? "..." : "Güncelle"}
                      </button>
                      <button onClick={saveToWatchlist} disabled={saving} className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {saving ? "..." : "Kaydet"}
                      </button>
                      <button
                        onClick={() => {
                          const [owner, name] = result.repo.split("/");
                          navigator.clipboard.writeText(`${window.location.origin}/score/${owner}/${name}`);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        {copied ? "✓ Kopyalandı" : "🔗 Paylaş"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {Object.entries(result.breakdown).map(([key, value]) => (
                    <div key={key} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3 text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{BREAKDOWN_LABELS[key] ?? key}</p>
                      <p className={`text-xl font-bold ${scoreColor(value)}`}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { value: result.metrics.stars.toLocaleString(), label: "Stars" },
                    { value: result.metrics.commit_count_90d, label: "Commits (90g)" },
                    { value: result.metrics.contributor_count, label: "Contributors" },
                  ].map(({ value, label }) => (
                    <div key={label} className="text-center">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: "has_readme", label: "README" },
                    { key: "has_license", label: "LICENSE" },
                    { key: "has_contributing", label: "CONTRIBUTING" },
                    { key: "has_issue_template", label: "Issue Template" },
                  ].map(({ key, label }) => (
                    <span key={key} className={`text-xs px-2 py-1 rounded-full font-medium ${
                      result.metrics[key as keyof typeof result.metrics]
                        ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 line-through"
                    }`}>
                      {result.metrics[key as keyof typeof result.metrics] ? "✓" : "✗"} {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Proje Hakkında */}
              {result.readme && (result.readme.summary || result.readme.tech_stack.length > 0) && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Proje Hakkında</h3>
                  {result.readme.summary && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">{result.readme.summary}</p>
                  )}
                  {result.readme.tech_stack.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {result.readme.tech_stack.map((tech) => (
                        <span key={tech} className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-medium">
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Öneriler */}
              {result.recommendations?.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">İyileştirme Önerileri</h3>
                  <div className="space-y-2">
                    {result.recommendations.map((rec, i) => (
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

              {/* Badge Generator */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">README Badge</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Projenin README dosyasına ekleyebileceğin badge kodu:</p>
                {(() => {
                  const [owner, name] = result.repo.split("/");
                  const badgeUrl = `http://localhost:8000/api/repos/${owner}/${name}/badge`;
                  const scoreUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/score/${owner}/${name}`;
                  const markdown = `[![DevPulse Score](${badgeUrl})](${scoreUrl})`;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <img src={badgeUrl} alt="DevPulse badge" />
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-nowrap">
                          {markdown}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(markdown)}
                          className="shrink-0 text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          Kopyala
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Skor Geçmişi */}
              {scoreHistory.length > 1 && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Skor Geçmişi</h3>
                    <span className="text-xs text-gray-400">{scoreHistory.length} analiz</span>
                  </div>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={scoreHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <Tooltip
                        contentStyle={{ background: "var(--background)", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => [v, "Skor"]}
                        labelFormatter={(l) => l}
                      />
                      <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex justify-between mt-2 text-xs text-gray-400">
                    <span>{scoreHistory[0]?.date}</span>
                    <span>{scoreHistory[scoreHistory.length - 1]?.date}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
