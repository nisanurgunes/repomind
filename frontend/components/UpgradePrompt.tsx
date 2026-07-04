"use client";

import { useRouter } from "next/navigation";
import { QuotaExceededError } from "@/lib/api";

const FEATURE_LABELS: Record<string, string> = {
  generation: "AI analiz/rapor üretimi",
  chat_message: "Danışman mesajı",
};

export default function UpgradePrompt({
  error,
  onClose,
}: {
  error: QuotaExceededError;
  onClose: () => void;
}) {
  const router = useRouter();
  const featureLabel = FEATURE_LABELS[error.feature] ?? error.feature;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 max-w-sm w-full shadow-xl">
        <div className="text-3xl mb-3">✨</div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Aylık kullanım limitine ulaştın
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {featureLabel} için aylık {error.limit} kullanım hakkını doldurdun.
          Sınırsız kullanım için Pro'ya geç.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Kapat
          </button>
          <button
            onClick={() => router.push(error.upgradeUrl || "/pricing")}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            Pro'ya Geç
          </button>
        </div>
      </div>
    </div>
  );
}
