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
  if (!h) return "—";
  if (h < 24) return `${Math.round(h)}s`;
  return `${Math.round(h / 24)}g`;
}

function scoreColor(s: number) {
  return s >= 80 ? "#16a34a" : s >= 60 ? "#ca8a04" : "#dc2626";
}

function ScoreBar({ value }: { value: number }) {
  const color = scoreColor(value);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold w-6 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

export default function PublicComparePage() {
  const params = useParams();
  const router = useRouter();
  const ownerA = params.ownerA as string;
  const nameA  = params.nameA  as string;
  const ownerB = params.ownerB as string;
  const nameB  = params.nameB  as string;

  const [cards, setCards] = useState<[ScoreCard, ScoreCard] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const base = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/repos`;
    Promise.all([
      fetch(`${base}/${ownerA}/${nameA}/scorecard`).then((r) => r.ok ? r.json() : Promise.reject()),
      fetch(`${base}/${ownerB}/${nameB}/scorecard`).then((r) => r.ok ? r.json() : Promise.reject()),
    ])
      .then(([a, b]) => setCards([a, b]))
      .catch(() => setError("Bir veya her iki repo analiz edilmemiş."))
      .finally(() => setLoading(false));
  }, [ownerA, nameA, ownerB, nameB]);

  const winner = cards
    ? cards[0].health_score > cards[1].health_score ? 0
    : cards[1].health_score > cards[0].health_score ? 1
    : -1
    : null;

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Karşılaştırma yükleniyor...</p>
      </div>
    );
  }

  if (error || !cards) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">{error}</p>
        <button onClick={() => router.push("/")} className="text-sm text-indigo-600 hover:underline">Ana sayfaya dön</button>
      </div>
    );
  }

  const METRICS = [
    { label: "Stars",          fn: (c: ScoreCard) => c.stars.toLocaleString() },
    { label: "Commits (90g)", fn: (c: ScoreCard) => c.commit_count_90d },
    { label: "Açık Issue",    fn: (c: ScoreCard) => c.open_issues },
    { label: "Contributors",  fn: (c: ScoreCard) => c.contributor_count },
    { label: "Issue Yanıt",   fn: (c: ScoreCard) => formatHours(c.avg_issue_response_hours) },
    { label: "PR Merge",      fn: (c: ScoreCard) => formatHours(c.avg_pr_merge_hours) },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center justify-between">
        <button onClick={() => router.push("/")} className="text-lg font-bold text-gray-900 dark:text-white">DevPulse</button>
        <button onClick={() => router.push("/")} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          Sen de analiz et →
        </button>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Repo Karşılaştırma</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">DevPulse sağlık skoru karşılaştırması</p>
        </div>

        {/* Kazanan banner */}
        {winner !== -1 && winner !== null && (
          <div className="bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-xl px-6 py-4 text-center">
            <p className="text-indigo-700 dark:text-indigo-300 font-semibold">
              🏆 <span className="font-bold">{cards[winner].full_name}</span> daha sağlıklı
              <span className="text-sm font-normal ml-2 opacity-70">
                ({cards[winner].health_score} vs {cards[1 - winner].health_score})
              </span>
            </p>
          </div>
        )}

        {/* Skor kartları */}
        <div className="grid grid-cols-2 gap-4">
          {cards.map((card, i) => (
            <div
              key={card.full_name}
              className={`bg-white dark:bg-gray-900 rounded-xl border p-5 text-center ${
                winner === i ? "border-indigo-300 dark:border-indigo-700" : "border-gray-200 dark:border-gray-800"
              }`}
            >
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 truncate">{card.full_name}</p>
              {card.language && <p className="text-xs text-gray-400 mb-3">{card.language}</p>}
              <p className="text-5xl font-bold mb-1" style={{ color: scoreColor(card.health_score) }}>{card.health_score}</p>
              <p className="text-xs text-gray-400">/ 100</p>
              {winner === i && <p className="text-xs text-indigo-500 font-semibold mt-2">🏆 Kazanan</p>}
            </div>
          ))}
        </div>

        {/* Skor barları */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="space-y-4">
            {METRICS.map(({ label, fn }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-2">{label}</p>
                <div className="grid grid-cols-2 gap-4">
                  {cards.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5 shrink-0">{i === 0 ? "A" : "B"}</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{fn(c)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
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

        <p className="text-center text-xs text-gray-400 dark:text-gray-600">
          DevPulse ile oluşturuldu · devpulse.app
        </p>
      </main>
    </div>
  );
}
