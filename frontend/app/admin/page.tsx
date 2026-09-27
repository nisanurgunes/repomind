"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import AppShell from "@/components/AppShell";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  plan: string;
  is_admin: boolean;
  created_at: string | null;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("devpulse_token")) {
      router.push("/");
      return;
    }
    api.getMe()
      .then((me) => {
        if (!me.is_admin) {
          router.push("/dashboard");
          return;
        }
        api.listAllUsers()
          .then((data) => setUsers(data.users || []))
          .catch((err) => setError(err.message || "Kullanıcılar yüklenemedi."))
          .finally(() => setLoading(false));
      })
      .catch(() => router.push("/"));
  }, [router]);

  async function switchToUser(user: AdminUser) {
    setSwitchingId(user.id);
    try {
      const { token } = await api.impersonateUser(user.id);
      const ownToken = localStorage.getItem("devpulse_token");
      if (ownToken && !localStorage.getItem("devpulse_admin_token")) {
        localStorage.setItem("devpulse_admin_token", ownToken);
      }
      localStorage.setItem("devpulse_token", token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Geçiş başarısız.");
      setSwitchingId(null);
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Kullanıcılar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Bir kullanıcı olarak oturum açmak için "Bu kullanıcı olarak gir" butonuna tıkla.
          </p>

          {error && (
            <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-4 py-2.5 rounded-xl">
              {error}
            </p>
          )}

          {loading ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 animate-pulse h-64" />
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              {users.map((u, i) => (
                <div
                  key={u.id}
                  className={`flex items-center gap-4 px-5 py-4 ${
                    i < users.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : ""
                  }`}
                >
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-full shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white text-sm truncate">{u.name}</span>
                      {u.is_admin && (
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                      <span className="text-xs text-gray-400 uppercase">{u.plan}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                  </div>
                  <button
                    onClick={() => switchToUser(u)}
                    disabled={switchingId !== null}
                    className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
                  >
                    {switchingId === u.id ? "Geçiliyor..." : "Bu kullanıcı olarak gir"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
