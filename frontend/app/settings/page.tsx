"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import AppShell from "@/components/AppShell";

interface BillingStatus {
  owner_type: "user" | "org";
  org_name: string | null;
  org_slug: string | null;
  plan: "free" | "pro" | "enterprise";
  generations_used: number;
  generations_limit: number | null;
  chat_messages_used: number;
  chat_messages_limit: number | null;
  subscription: {
    status: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
  } | null;
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-gray-600 dark:text-gray-300">{label}</span>
        <span className="text-gray-400 dark:text-gray-500">
          {used} / {limit ?? "∞"}
        </span>
      </div>
      {limit !== null && (
        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-indigo-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("devpulse_token")) { router.push("/"); return; }
    api.getBillingStatus()
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  async function managePlan() {
    setPortalLoading(true);
    try {
      const { portal_url } = await api.createPortalSession(status?.owner_type === "org" ? status.org_slug ?? undefined : undefined);
      window.location.href = portal_url;
    } catch {
      setPortalLoading(false);
    }
  }

  const isPro = status?.plan === "pro" || status?.plan === "enterprise";

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Ayarlar</h1>

          {loading ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 animate-pulse h-48" />
          ) : !status ? (
            <p className="text-sm text-gray-400">Plan bilgisi alınamadı.</p>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    {status.owner_type === "org" ? status.org_name : "Kişisel Plan"}
                  </p>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                    {isPro ? "Pro" : "Free"}
                  </h2>
                </div>
                {isPro ? (
                  <button
                    onClick={managePlan}
                    disabled={portalLoading}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {portalLoading ? "Yönlendiriliyor..." : "Faturalamayı Yönet"}
                  </button>
                ) : (
                  <button
                    onClick={() => router.push("/pricing")}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                  >
                    Pro'ya Yükselt
                  </button>
                )}
              </div>

              {status.subscription?.cancel_at_period_end && (
                <p className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 px-3 py-2 rounded-lg">
                  Aboneliğiniz {new Date(status.subscription.current_period_end).toLocaleDateString("tr-TR")} tarihinde sona erecek.
                </p>
              )}

              <div className="space-y-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Bu Ayki Kullanım</p>
                <UsageBar label="AI analiz/rapor üretimi" used={status.generations_used} limit={status.generations_limit} />
                <UsageBar label="Danışman mesajı" used={status.chat_messages_used} limit={status.chat_messages_limit} />
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
