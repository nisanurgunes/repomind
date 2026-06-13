"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function AnimatedScore({ target }: { target: number }) {
  const [score, setScore] = useState(0);
  useEffect(() => {
    let current = 0;
    const step = Math.ceil(target / 40);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      setScore(current);
      if (current >= target) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [target]);
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#ca8a04" : "#dc2626";
  return <span style={{ color }} className="tabular-nums">{score}</span>;
}

const FEATURES = [
  {
    icon: "📝",
    title: "Commit Aktivitesi",
    desc: "Son 90 günde ne kadar aktif? Düzenli commit'ler projenin canlı olduğunu gösterir.",
    weight: "%25",
  },
  {
    icon: "🐛",
    title: "Issue Yanıt Süresi",
    desc: "Açılan issue'lar ne kadar hızlı yanıtlanıyor? Topluluk sağlığının göstergesi.",
    weight: "%20",
  },
  {
    icon: "🔀",
    title: "PR Hızı",
    desc: "Pull request'ler ne kadar sürede merge ediliyor? Yavaş PR = bloke geliştirici.",
    weight: "%20",
  },
  {
    icon: "👥",
    title: "Contributor Sayısı",
    desc: "Tek kişilik proje mi, büyük topluluk mu? Bus factor riski hesaplanır.",
    weight: "%20",
  },
  {
    icon: "📄",
    title: "Dokümantasyon",
    desc: "README, LICENSE, CONTRIBUTING ve issue template varlığı kontrol edilir.",
    weight: "%15",
  },
  {
    icon: "🏷️",
    title: "Teknoloji Tespiti",
    desc: "README'den otomatik teknoloji yığını çıkarımı. Framework, dil, araçlar.",
    weight: "bonus",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "GitHub ile giriş yap", desc: "OAuth ile tek tıkla — şifre yok, form yok." },
  { step: "02", title: "Repo adını gir", desc: "owner/repo formatında. Örnek: facebook/react" },
  { step: "03", title: "Skoru gör", desc: "5 kategoride analiz, öneriler ve geçmiş trend." },
  { step: "04", title: "Takip et & paylaş", desc: "Watchlist'e ekle, badge oluştur, karşılaştır." },
];

const EXTRA_FEATURES = [
  {
    icon: "⚖️",
    title: "Repo Karşılaştırma",
    desc: "İki repoyu yan yana karşılaştır. Hangisi daha sağlıklı, tek bakışta gör.",
  },
  {
    icon: "📈",
    title: "GitHub Trending",
    desc: "Günün, haftanın veya ayın trend repolarını listele. Tek tıkla analiz et.",
  },
  {
    icon: "🔗",
    title: "Paylaşılabilir Skor Kartı",
    desc: "Her reponun public bir skor sayfası var. Login gerektirmez, doğrudan paylaş.",
  },
  {
    icon: "🛡️",
    title: "README Badge",
    desc: "Projenin README'sine eklenebilir SVG badge. Skor her zaman güncel görünür.",
  },
  {
    icon: "🔔",
    title: "Otomatik Yenileme",
    desc: "Watchlist'indeki repolar her gece otomatik analiz edilir. Hep güncel.",
  },
  {
    icon: "📊",
    title: "Skor Geçmişi",
    desc: "Repo sağlığı zamanla nasıl değişti? Trend grafiğiyle takip et.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">

      {/* Navbar */}
      <nav className="border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">DevPulse</span>
          <span className="hidden sm:inline text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">beta</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/trending" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors hidden sm:inline">
            Trending
          </a>
          <a
            href={`${API_URL}/api/auth/login`}
            className="bg-gray-900 dark:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 dark:hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub ile Giriş Yap
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <div className="inline-block bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-sm font-medium px-4 py-1.5 rounded-full mb-8 border border-indigo-100 dark:border-indigo-900">
          ✨ GitHub repo sağlık analizi
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold mb-6 leading-tight tracking-tight">
          Reponu analiz et,
          <br />
          <span className="text-indigo-600 dark:text-indigo-400">sağlığını ölç</span>
        </h1>
        <p className="text-xl text-gray-500 dark:text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          DevPulse, GitHub repolarını 5 kriterde analiz ederek 0–100 arası sağlık skoru üretir.
          Commit aktivitesi, issue hızı, PR süresi, contributor sayısı ve dokümantasyon kalitesi.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a
            href={`${API_URL}/api/auth/login`}
            className="bg-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Ücretsiz Başla
          </a>
          <a href="/trending" className="border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
            Trending'e Bak →
          </a>
        </div>
        <p className="mt-4 text-sm text-gray-400">Login gerektirmez · Trending ve skor kartları herkese açık</p>
      </section>

      {/* Demo skor kartı */}
      <section className="bg-gray-50 dark:bg-gray-900/50 border-y border-gray-100 dark:border-gray-800 py-16">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider mb-8">Örnek analiz sonucu</p>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">facebook/react</h3>
                <p className="text-sm text-gray-400 mt-0.5">Son analiz: bugün</p>
              </div>
              <div className="text-right">
                <p className="text-5xl font-bold"><AnimatedScore target={82} /></p>
                <p className="text-xs text-gray-400 mt-1">/ 100</p>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2 mb-5">
              {[
                { label: "Commit", score: 85, color: "#16a34a" },
                { label: "Issue", score: 55, color: "#ca8a04" },
                { label: "PR", score: 95, color: "#16a34a" },
                { label: "Contributor", score: 100, color: "#16a34a" },
                { label: "Docs", score: 75, color: "#16a34a" },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                  <p className="text-xl font-bold" style={{ color: item.color }}>{item.score}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {[
                { label: "Commit (85/100)", width: 85, color: "#16a34a" },
                { label: "Issue (55/100)", width: 55, color: "#ca8a04" },
                { label: "PR (95/100)", width: 95, color: "#16a34a" },
              ].map((bar) => (
                <div key={bar.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-28 shrink-0">{bar.label}</span>
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${bar.width}%`, backgroundColor: bar.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Nasıl çalışır */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Nasıl çalışır?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="relative">
              <div className="text-4xl font-black text-gray-100 dark:text-gray-800 mb-3">{item.step}</div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-1">{item.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ne analiz ediliyor */}
      <section className="bg-gray-50 dark:bg-gray-900/50 border-y border-gray-100 dark:border-gray-800 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">5 kriterde kapsamlı analiz</h2>
            <p className="text-gray-500 dark:text-gray-400">Her kriter ağırlıklı olarak final skora katkıda bulunur</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{f.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{f.title}</h3>
                    <span className="text-xs text-indigo-500 font-medium">{f.weight}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ekstra özellikler */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Daha fazlası</h2>
          <p className="text-gray-500 dark:text-gray-400">Analiz ötesinde repo yönetimi için ihtiyacın olan her şey</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXTRA_FEATURES.map((f) => (
            <div key={f.title} className="group rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-all">
              <div className="text-2xl mb-2">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-600 dark:bg-indigo-700 py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Reponu hemen analiz et</h2>
          <p className="text-indigo-200 mb-8">GitHub hesabınla giriş yap, repo adını gir, skoru gör. Ücretsiz.</p>
          <a
            href={`${API_URL}/api/auth/login`}
            className="bg-white text-indigo-600 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-indigo-50 transition-colors inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub ile Giriş Yap
          </a>
        </div>
      </section>

      <footer className="border-t border-gray-200 dark:border-gray-800 px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-600">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <p className="font-semibold text-gray-600 dark:text-gray-400">DevPulse</p>
          <div className="flex gap-6">
            <a href="/trending" className="hover:text-gray-600 dark:hover:text-gray-400 transition-colors">Trending</a>
            <a href={`${API_URL}/api/auth/login`} className="hover:text-gray-600 dark:hover:text-gray-400 transition-colors">Giriş Yap</a>
          </div>
          <p>GitHub repo sağlık analizi · 2025</p>
        </div>
      </footer>
    </div>
  );
}
