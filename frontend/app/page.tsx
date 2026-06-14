"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const GH_ICON = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

function AnimatedScore({ target }: { target: number }) {
  const [score, setScore] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setScore((c) => {
        const next = Math.min(c + Math.ceil(target / 40), target);
        if (next >= target) clearInterval(timer);
        return next;
      });
    }, 28);
    return () => clearInterval(timer);
  }, [target]);
  const color = score >= 80 ? "#4ade80" : score >= 60 ? "#facc15" : "#f87171";
  return <span style={{ color }} className="tabular-nums">{score}</span>;
}

function AnimatedBar({ width, color, delay = 0 }: { width: number; color: string; delay?: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(width), delay + 300);
    return () => clearTimeout(t);
  }, [width, delay]);
  return (
    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${w}%`, backgroundColor: color }} />
    </div>
  );
}

const SCORE_BARS = [
  { label: "Commit Aktivitesi", score: 85, color: "#4ade80" },
  { label: "Issue Yanıt Hızı",  score: 55, color: "#facc15" },
  { label: "PR Birleşme Süresi",score: 95, color: "#4ade80" },
  { label: "Contributor Sayısı",score: 100, color: "#4ade80" },
  { label: "Dokümantasyon",     score: 75, color: "#4ade80" },
];

const FEATURES_GRID = [
  {
    icon: "🏥",
    tag: "Analiz",
    title: "Repo Sağlık Skoru",
    desc: "5 kriterde 0–100 arası bileşik skor. Commit, issue, PR, contributor ve dokümantasyon ağırlıklı değerlendirme.",
  },
  {
    icon: "🤖",
    tag: "AI",
    title: "Danışman (Advisor)",
    desc: "Repo'yu analiz ettikten sonra başlayan AI sohbeti. Projeyi bilerek konuşur — 'ne yapıyor?' diye sormaz.",
  },
  {
    icon: "🔍",
    tag: "AI",
    title: "Feature Gap Analizi",
    desc: "Benzer GitHub projelerini tarayıp 'orada var, sende yok' önerilerini öncelik ve efor etiketiyle listeler.",
  },
  {
    icon: "💡",
    tag: "AI",
    title: "Kendi Projeyi Analiz Et",
    desc: "Commit geçmişin, dosya yapın ve issue'larına bakarak kişiselleştirilmiş geliştirme önerileri üretir.",
  },
  {
    icon: "👥",
    tag: "Ekip",
    title: "Ekip Analizi",
    desc: "Contributor commit dağılımı, çalışma saati heatmap'i, hot-spot dosyalar ve PR birleşme süreleri.",
  },
  {
    icon: "📌",
    tag: "Yönetim",
    title: "Feature Backlog",
    desc: "AI önerilerini kaydet, pending → in-progress → done statüleriyle mini proje yönetimi yap.",
  },
  {
    icon: "🏢",
    tag: "Takım",
    title: "Organizasyonlar",
    desc: "Takım oluştur, e-posta ile üye davet et, ortak repo dashboardu ve skor takibi.",
  },
  {
    icon: "🔔",
    tag: "İzleme",
    title: "Bildirim Sistemi",
    desc: "Watchlist'indeki repolar otomatik izlenir. Yeni commit, skor düşüşü veya PR'da anında bildir.",
  },
  {
    icon: "📄",
    tag: "Dokümantasyon",
    title: "Teknik Doküman Üretici",
    desc: "Her feature için Türkçe Word dokümanı oluştur. Nasıl çalışır, hangi teknolojiler, API endpoint'leri.",
  },
  {
    icon: "📈",
    tag: "Keşif",
    title: "GitHub Trending",
    desc: "Günün, haftanın veya ayın trend repolarını listele. Tek tıkla analiz et.",
  },
  {
    icon: "🏅",
    tag: "Paylaş",
    title: "Skor Kartı & Badge",
    desc: "Her repo için public skor sayfası ve README'ye eklenebilir SVG badge. Login gerektirmez.",
  },
  {
    icon: "⚖️",
    tag: "Karşılaştır",
    title: "Repo Karşılaştırma",
    desc: "İki repoyu yan yana karşılaştır. Skor farkı, kategori kırılımı, öne çıkan güçlü yanlar.",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "GitHub ile giriş yap", desc: "OAuth ile tek tıkla — şifre yok, form yok.", icon: "🔐" },
  { step: "02", title: "Repo seç veya gir", desc: "Kendi repolarından seç ya da owner/repo formatında gir.", icon: "📂" },
  { step: "03", title: "AI analizi başlat", desc: "Sağlık skoru, feature gap, danışman — tek tıkla.", icon: "⚡" },
  { step: "04", title: "Takip et & geliştir", desc: "Backlog oluştur, watchlist'e ekle, badge paylaş.", icon: "🚀" },
];

const TAG_COLORS: Record<string, string> = {
  "AI": "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "Analiz": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Ekip": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Yönetim": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Takım": "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "İzleme": "bg-red-500/20 text-red-300 border-red-500/30",
  "Dokümantasyon": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "Keşif": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Paylaş": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "Karşılaştır": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080b14] text-white">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-white/8 bg-[#080b14]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold">R</div>
            <span className="text-lg font-bold tracking-tight">RepoMind</span>
            <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full font-medium uppercase tracking-wider">beta</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="/trending" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:inline">Trending</a>
            <a href="/docs" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:inline">Docs</a>
            <a
              href={`${API_URL}/api/auth/login`}
              className="flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-100 transition-colors px-4 py-2 rounded-lg text-sm font-semibold"
            >
              {GH_ICON}
              GitHub ile Giriş Yap
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Glow bg */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/15 rounded-full blur-3xl" />
          <div className="absolute top-20 left-1/3 w-[400px] h-[300px] bg-indigo-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 pt-28 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
            AI destekli GitHub repo analizi
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold mb-6 leading-[1.08] tracking-tight">
            Reponun nabzını<br />
            <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              AI ile ölç
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            RepoMind, GitHub repolarını analiz eder, rakiplerle karşılaştırır ve
            yapay zeka danışmanı ile projeyi büyütmek için aksiyon önerileri sunar.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href={`${API_URL}/api/auth/login`}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 transition-colors text-white px-7 py-3.5 rounded-xl text-base font-semibold shadow-lg shadow-violet-600/25"
            >
              {GH_ICON}
              Ücretsiz Başla
            </a>
            <a href="/trending" className="flex items-center gap-2 border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all text-gray-300 px-7 py-3.5 rounded-xl text-base font-semibold">
              Trending'e Bak
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </a>
          </div>
          <p className="mt-5 text-xs text-gray-600">Login gerektirmez · Trending ve skor kartları herkese açık</p>
        </div>
      </section>

      {/* ── Demo skor kartı ── */}
      <section className="pb-24">
        <div className="max-w-lg mx-auto px-6">
          <p className="text-center text-xs font-semibold text-gray-600 uppercase tracking-widest mb-6">Örnek analiz</p>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-2xl shadow-black/40">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs">⚛</div>
                  <span className="text-sm font-mono text-gray-300">facebook/react</span>
                </div>
                <p className="text-xs text-gray-600">Son analiz: bugün · JavaScript</p>
              </div>
              <div className="text-right">
                <div className="text-5xl font-black leading-none"><AnimatedScore target={82} /></div>
                <div className="text-xs text-gray-600 mt-1">/ 100</div>
              </div>
            </div>

            {/* Score ring visual */}
            <div className="space-y-2.5 mb-5">
              {SCORE_BARS.map((b, i) => (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-36 shrink-0">{b.label}</span>
                  <AnimatedBar width={b.score} color={b.color} delay={i * 100} />
                  <span className="text-xs font-mono w-8 text-right shrink-0" style={{ color: b.color }}>{b.score}</span>
                </div>
              ))}
            </div>

            {/* Recommendation pill */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-300">
              💡 <span className="font-medium">Öneri:</span> Issue yanıt süresi 48 saatin üzerinde — haftalık triage toplantısı ekle.
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-white/8 bg-white/2 py-12">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {[
              { value: "12+", label: "AI destekli özellik" },
              { value: "5",   label: "Analiz kriteri" },
              { value: "0–100", label: "Normalize skor" },
              { value: "Ücretsiz", label: "Her zaman" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-black bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent mb-1">{s.value}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Her şey tek platformda</h2>
          <p className="text-gray-400 max-w-xl mx-auto">Skor analizinden AI danışmanlığa, ekip metriklerinden doküman üretimine — repo yönetiminin tüm katmanları.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES_GRID.map((f) => (
            <div
              key={f.title}
              className="group relative bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/15 rounded-xl p-5 transition-all duration-200 cursor-default"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{f.icon}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${TAG_COLORS[f.tag] || "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}>
                  {f.tag}
                </span>
              </div>
              <h3 className="font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Nasıl çalışır ── */}
      <section className="border-y border-white/8 bg-white/2 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-14">4 adımda başla</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((item, i) => (
              <div key={item.step} className="relative">
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:block absolute top-5 left-full w-full h-px bg-gradient-to-r from-white/10 to-transparent z-0" />
                )}
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-lg mb-4">{item.icon}</div>
                  <div className="text-xs font-mono text-violet-400 mb-1">{item.step}</div>
                  <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Advisor highlight ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="relative bg-gradient-to-br from-violet-500/10 to-indigo-500/5 border border-violet-500/20 rounded-2xl p-8 sm:p-12 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full mb-6">
              ✨ AI Danışman
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 max-w-xl">
              Projeyi analiz eder,<br />
              <span className="text-violet-400">sonra konuşur</span>
            </h2>
            <p className="text-gray-400 max-w-lg mb-8 leading-relaxed">
              Danışman önce commit geçmişini, dosya yapını ve issue'larını inceler. Sohbete başladığında
              "Projen ne yapıyor?" diye sormaz — zaten bilir. Direkt geliştirme önerisi verir.
            </p>

            {/* Mock chat */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-4 max-w-md space-y-3">
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full bg-violet-500/30 border border-violet-500/40 flex items-center justify-center text-xs shrink-0 mt-0.5">R</div>
                <div className="bg-violet-500/15 border border-violet-500/20 rounded-xl rounded-tl-sm px-3 py-2 text-sm text-gray-200 leading-relaxed">
                  Projeyi inceledim. API authentication katmanında test coverage %12 — bu kritik bir risk.
                  JWT refresh token implementasyonu da eksik görünüyor.
                </div>
              </div>
              <div className="flex gap-2.5 justify-end">
                <div className="bg-white/8 border border-white/10 rounded-xl rounded-tr-sm px-3 py-2 text-sm text-gray-300 leading-relaxed">
                  Önceliklendirme için ne önerirsin?
                </div>
                <div className="w-6 h-6 rounded-full bg-gray-600 border border-gray-500 flex items-center justify-center text-xs shrink-0 mt-0.5">S</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/12 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-4">Reponu hemen analiz et</h2>
          <p className="text-gray-400 mb-8">GitHub hesabınla giriş yap, repo seç, AI analizini başlat. Ücretsiz.</p>
          <a
            href={`${API_URL}/api/auth/login`}
            className="inline-flex items-center gap-2.5 bg-violet-600 hover:bg-violet-500 transition-colors text-white px-8 py-4 rounded-xl text-base font-semibold shadow-lg shadow-violet-600/30"
          >
            {GH_ICON}
            GitHub ile Giriş Yap
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-[9px] font-bold text-white">R</div>
            <span className="font-semibold text-gray-400">RepoMind</span>
          </div>
          <div className="flex gap-6">
            <a href="/trending" className="hover:text-gray-300 transition-colors">Trending</a>
            <a href="/docs" className="hover:text-gray-300 transition-colors">Dokümanlar</a>
            <a href={`${API_URL}/api/auth/login`} className="hover:text-gray-300 transition-colors">Giriş Yap</a>
          </div>
          <p>GitHub repo analizi · 2025</p>
        </div>
      </footer>
    </div>
  );
}
