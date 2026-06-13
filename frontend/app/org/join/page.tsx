"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function JoinOrgContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [orgSlug, setOrgSlug] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Geçersiz davet linki");
      return;
    }
    api.joinOrg(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.message);
        setOrgSlug(res.org_slug);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message || "Davet kabul edilemedi");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {status === "loading" && (
          <div className="space-y-3">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 dark:text-gray-400">Davete katılınıyor...</p>
          </div>
        )}
        {status === "success" && (
          <div className="space-y-4">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Hoş Geldin! 🎉</h2>
            <p className="text-gray-500 dark:text-gray-400">{message}</p>
            <button
              onClick={() => router.push(`/org/${orgSlug}`)}
              className="mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              Organizasyona Git
            </button>
          </div>
        )}
        {status === "error" && (
          <div className="space-y-4">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Hata</h2>
            <p className="text-gray-500 dark:text-gray-400">{message}</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-2 px-6 py-2.5 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-xl transition-colors text-sm"
            >
              Dashboard'a Dön
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JoinOrgPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>}>
      <JoinOrgContent />
    </Suspense>
  );
}
