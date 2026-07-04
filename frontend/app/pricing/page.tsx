"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import AppShell from "@/components/AppShell";

interface OrgSummary {
  id: number;
  name: string;
  slug: string;
}

export default function PricingPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [selectedOrgSlug, setSelectedOrgSlug] = useState("");
  const [loadingPlan, setLoadingPlan] = useState<"personal_pro" | "org_pro" | null>(null);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const loggedIn = !!localStorage.getItem("devpulse_token");
    setIsLoggedIn(loggedIn);
    if (!loggedIn) return;
    api.listMyOrgs()
      .then((data: OrgSummary[]) => {
        setOrgs(data || []);
        if (data?.length === 1) setSelectedOrgSlug(data[0].slug);
      })
      .catch(() => {});
  }, []);

  async function upgrade(plan: "personal_pro" | "org_pro") {
    if (!isLoggedIn) {
      router.push("/");
      return;
    }
    if (plan === "org_pro" && !selectedOrgSlug) return;

    setError("");
    setLoadingPlan(plan);
    try {
      const { checkout_url } = await api.createCheckoutSession(plan, plan === "org_pro" ? selectedOrgSlug : undefined);
      window.location.href = checkout_url;
    } catch (err: any) {
      setError(err.message || "Ödeme başlatılamadı.");
      setLoadingPlan(null);
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Planlar</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Ücretsiz başla, ihtiyacın olduğunda Pro'ya geç.
            </p>
          </div>

          {error && (
            <p className="max-w-md mx-auto mb-6 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-4 py-2.5 rounded-xl text-center">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Free</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Bireysel kullanım için başlangıç</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mb-6">₺0</p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300 mb-8 flex-1">
                <li>• Ayda 10 AI analiz/rapor üretimi</li>
                <li>• Ayda 20 danışman mesajı</li>
                <li>• Sınırsız repo takibi</li>
              </ul>
              <button
                disabled
                className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 text-sm font-medium cursor-default"
              >
                Mevcut Plan
              </button>
            </div>

            {/* Personal Pro */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-indigo-500 p-6 flex flex-col relative">
              <span className="absolute -top-3 left-6 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Popüler
              </span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Kişisel Pro</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Bağımsız geliştiriciler için</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mb-6">₺X<span className="text-base font-normal text-gray-400">/ay</span></p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300 mb-8 flex-1">
                <li>• Ayda 500 AI analiz/rapor üretimi</li>
                <li>• Ayda 1000 danışman mesajı</li>
                <li>• Öncelikli işlem sırası</li>
              </ul>
              <button
                onClick={() => upgrade("personal_pro")}
                disabled={loadingPlan === "personal_pro"}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {loadingPlan === "personal_pro" ? "Yönlendiriliyor..." : "Kişisel Pro'ya Geç"}
              </button>
            </div>

            {/* Org Pro */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Organizasyon Pro</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Takımlar ve şirketler için</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mb-6">₺Y<span className="text-base font-normal text-gray-400">/ay</span></p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300 mb-8 flex-1">
                <li>• Üyeler arası paylaşılan 200 üretim/ay havuzu</li>
                <li>• Paylaşılan 500 danışman mesajı/ay</li>
                <li>• Kullanım denetim görünürlüğü</li>
                <li>• Öncelikli destek</li>
              </ul>

              {isLoggedIn && orgs.length > 1 && (
                <select
                  value={selectedOrgSlug}
                  onChange={(e) => setSelectedOrgSlug(e.target.value)}
                  className="w-full mb-3 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Organizasyon seç...</option>
                  {orgs.map((o) => (
                    <option key={o.slug} value={o.slug}>{o.name}</option>
                  ))}
                </select>
              )}

              {isLoggedIn && orgs.length === 0 ? (
                <button
                  onClick={() => router.push("/org/new")}
                  className="w-full py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Önce Organizasyon Oluştur
                </button>
              ) : (
                <button
                  onClick={() => upgrade("org_pro")}
                  disabled={loadingPlan === "org_pro" || (isLoggedIn && orgs.length > 1 && !selectedOrgSlug)}
                  className="w-full py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {loadingPlan === "org_pro" ? "Yönlendiriliyor..." : "Organizasyon Pro'ya Geç"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
