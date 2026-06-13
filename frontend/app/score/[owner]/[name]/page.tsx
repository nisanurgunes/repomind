"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface ScoreCard {
  full_name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  health_score: number;
  commit_count_90d: number;
  open_issues: number;
  contributor_count: number;
  avg_issue_response_hours: number;
  avg_pr_merge_hours: number;
  analyzed_at: string | null;
}

function formatHours(h: number) {
  if (h < 1) return "< 1 saat";
  if (h < 24) return `${Math.round(h)} saat`;
  return `${Math.round(h / 24)} gün`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#ca8a04" : "#dc2626";
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute" width="144" height="144" viewBox="0 0 144 144">
        <circle cx="72" cy="72" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="72" cy="72" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 72 72)"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="text-center">
        <p className="text-4xl font-bold" style={{ color }}>{score}</p>
        <p className="text-xs text-gray-400">/ 100</p>
      </div>
    </div>
  );
}

export default function ScoreCardPage() {
  const params = useParams();
  const router = useRouter();
  const owner = params.owner as string;
  const name = params.name as string;

  const [data, setData] = useState<ScoreCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/repos/${owner}/${name}/scorecard`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setError("Bu repo analiz edilmemiş veya bulunamadı."))
      .finally(() => setLoading(false));
  }, [owner, name]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scoreLabel = data
    ? data.health_score >= 80 ? "Sağlıklı" : data.health_score >= 60 ? "Orta" : "Riskli"
    : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Yükleniyor...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
        <button onClick={() => router.push("/")} className="text-sm text-indigo-600 hover:underline">
          Ana sayfaya dön
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center justify-between">
        <button onClick={() => router.push("/")} className="text-lg font-bold text-gray-900 dark:text-white">
          DevPulse
        </button>
        <button
          onClick={() => router.push("/")}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Sen de analiz et →
        </button>
      </nav>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">

          {/* Kart */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">

            {/* Üst bant */}
            <div className={`h-2 w-full ${data.health_score >= 80 ? "bg-green-500" : data.health_score >= 60 ? "bg-yellow-500" : "bg-red-500"}`} />

            <div className="p-8">
              {/* Repo başlık */}
              <div className="mb-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">{data.full_name}</h1>
                    {data.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{data.description}</p>
                    )}
                    <div className="flex gap-3 mt-2 text-sm text-gray-400 dark:text-gray-500">
                      {data.language && <span>🔵 {data.language}</span>}
                      <span>⭐ {data.stars.toLocaleString()}</span>
                      <span>🍴 {data.forks.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Skor ring + etiket */}
              <div className="flex items-center gap-8 mb-8">
                <ScoreRing score={data.health_score} />
                <div>
                  <p className={`text-2xl font-bold mb-1 ${data.health_score >= 80 ? "text-green-600" : data.health_score >= 60 ? "text-yellow-500" : "text-red-500"}`}>
                    {scoreLabel}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">DevPulse Sağlık Skoru</p>
                  {data.analyzed_at && (
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{formatDate(data.analyzed_at)}</p>
                  )}
                </div>
              </div>

              {/* Metrikler grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { label: "Commits (90 gün)", value: data.commit_count_90d },
                  { label: "Açık Issue", value: data.open_issues },
                  { label: "Contributors", value: data.contributor_count },
                  { label: "Ort. Issue Yanıt", value: formatHours(data.avg_issue_response_hours) },
                  { label: "Ort. PR Merge", value: formatHours(data.avg_pr_merge_hours) },
                  { label: "Stars", value: data.stars.toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>

              {/* Aksiyon butonları */}
              <div className="flex gap-3">
                <button
                  onClick={copyLink}
                  className="flex-1 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {copied ? "✓ Kopyalandı!" : "🔗 Linki Kopyala"}
                </button>
                <button
                  onClick={() => router.push("/")}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Reponu Analiz Et
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">
            DevPulse ile oluşturuldu · devpulse.app
          </p>
        </div>
      </main>
    </div>
  );
}
