"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { consumeOauthState, exchangeGithubCode } from "@/lib/githubLogin";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const handled = useRef(false);

  useEffect(() => {
    // Dev'deki StrictMode çift çalıştırması code'u iki kez harcamasın (GitHub code tek kullanımlık)
    if (handled.current) return;
    handled.current = true;

    const token = searchParams.get("token");
    const code = searchParams.get("code");

    if (token) {
      // Eski akış: backend GitHub'dan dönüp token'ı URL ile gönderiyor
      localStorage.setItem("devpulse_token", token);
      router.replace("/dashboard");
      return;
    }

    if (code) {
      if (!consumeOauthState(searchParams.get("state"))) {
        setError("Giriş oturumu doğrulanamadı. Lütfen tekrar giriş yap.");
        return;
      }
      exchangeGithubCode(code)
        .then((jwt) => {
          localStorage.setItem("devpulse_token", jwt);
          router.replace("/dashboard");
        })
        .catch((err: Error) => setError(err.message || "Giriş başarısız."));
      return;
    }

    router.replace("/");
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
        <p className="text-gray-700 dark:text-gray-300">{error}</p>
        <button
          onClick={() => router.replace("/")}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
        >
          Ana sayfaya dön
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-500">Giriş yapılıyor...</p>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Yükleniyor...</p>
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  );
}
