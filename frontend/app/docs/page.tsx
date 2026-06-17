"use client";

import { useState } from "react";

const FEATURES = [
  { key: "repo-saglik-skoru",       label: "Repo Sağlık Skoru",                 icon: "🏥", desc: "0–100 arası ağırlıklı puan motoru" },
  { key: "feature-gap-analizi",     label: "Feature Gap Analizi",               icon: "🔍", desc: "Benzer projelerle karşılaştırma, eksik özellik tespiti" },
  { key: "kendi-projeyi-analiz-et", label: "Kendi Projeyi Analiz Et",           icon: "🤖", desc: "AI destekli kişiselleştirilmiş geliştirme önerileri" },
  { key: "danisman-advisor-chat",   label: "Danışman (Advisor Chat)",           icon: "💬", desc: "Repo bağlamını bilen AI ile serbest danışmanlık" },
  { key: "ekip-analizi",            label: "Ekip Analizi",                       icon: "👥", desc: "Contributor aktivitesi, commit heatmap, PR metrikleri" },
  { key: "kaydedilen-feature-onerileri", label: "Kaydedilen Feature Önerileri", icon: "📌", desc: "Önerileri backlog olarak yönet, statü takibi" },
  { key: "bildirim-sistemi",        label: "Bildirim Sistemi",                   icon: "🔔", desc: "Commit, skor düşüşü ve PR bildirimleri" },
  { key: "organizasyon-yonetimi",   label: "Organizasyon Yönetimi",             icon: "🏢", desc: "Takım oluştur, üye davet et, ortak dashboard" },
  { key: "github-oauth",            label: "GitHub OAuth ve Kimlik Doğrulama",  icon: "🔐", desc: "OAuth 2.0 akışı, JWT yönetimi, UUID kullanıcı kimlikleri" },
  { key: "paylasilabilir-skor-karti", label: "Paylaşılabilir Skor Kartı & Badge", icon: "🏅", desc: "Public link ve SVG badge üretimi" },
];

export default function DocsPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);

  const allSelected = selected.size === FEATURES.length;

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(FEATURES.map(f => f.key)));
  }

  async function download(featureKey: string | "all") {
    setLoading(featureKey);
    try {
      const url = `/api/docs/generate?feature=${featureKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("İndirme başarısız");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const isZip = blob.type === "application/zip";
      const safeName = featureKey.includes(',') ? 'secili' : featureKey;
      a.download = isZip ? `devpulse-${safeName}-docs.zip` : `devpulse-${featureKey}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setLoading(null);
    }
  }

  async function downloadSelected() {
    if (selected.size === 0) return;
    const keys = [...selected].join(',');
    await download(keys);
  }

  const isLoading = loading !== null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            📄 Teknik Dokümantasyon
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Her feature için Türkçe Word dokümanı oluştur ve indir. Nasıl çalıştığı, kullanılan teknolojiler ve API endpoint'leri dahil.
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => download("all")}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            {loading === "all" ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : "⬇️"}
            Tüm Dokümanlar (ZIP)
          </button>

          {selected.size > 0 && (
            <button
              onClick={downloadSelected}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : "⬇️"}
              Seçilileri İndir ({selected.size})
            </button>
          )}
        </div>

        {/* Feature list */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Select all row */}
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Tümünü Seç
              </span>
            </label>
            <span className="text-xs text-gray-400">{FEATURES.length} özellik</span>
          </div>

          {FEATURES.map((f, i) => (
            <div
              key={f.key}
              className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                i < FEATURES.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : ""
              } ${selected.has(f.key) ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"}`}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selected.has(f.key)}
                onChange={() => toggle(f.key)}
                className="w-4 h-4 rounded accent-blue-600 shrink-0"
              />

              {/* Icon + text */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-2xl shrink-0">{f.icon}</span>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    {f.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {f.desc}
                  </div>
                </div>
              </div>

              {/* Individual download button */}
              <button
                onClick={() => download(f.key)}
                disabled={isLoading}
                title="Bu dokümanı indir"
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
              >
                {loading === f.key ? (
                  <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                )}
                .docx
              </button>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-gray-400 dark:text-gray-600 text-center">
          Dokümanlar Microsoft Word, Google Docs ve LibreOffice ile açılabilir.
        </p>
      </div>
    </div>
  );
}
