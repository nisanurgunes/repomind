"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import AppShell from "@/components/AppShell";

interface Member {
  user_id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

interface OrgData {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  owner_id: number;
  my_role: "owner" | "admin" | "member";
  members: Member[];
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Üye",
};

const ROLE_COLOR: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  member: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function OrgDashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ link?: string; error?: string } | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    api.getOrg(slug)
      .then(setOrg)
      .catch(() => router.push("/dashboard"))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const res = await api.inviteMember(slug, inviteEmail.trim());
      setInviteResult({ link: res.invite_link });
      setInviteEmail("");
    } catch (err: any) {
      setInviteResult({ error: err.message });
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: number) => {
    if (!confirm("Bu üyeyi çıkarmak istediğine emin misin?")) return;
    try {
      await api.removeMember(slug, userId);
      setOrg((prev) => prev ? { ...prev, members: prev.members.filter((m) => m.user_id !== userId) } : prev);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!org) return null;

  const canManage = org.my_role === "owner" || org.my_role === "admin";

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {org.name[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{org.name}</h1>
              {org.description && (
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{org.description}</p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">/{org.slug} · {org.members.length} üye</p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={() => setShowInvite((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Üye Davet Et
            </button>
          )}
        </div>

        {/* Invite form */}
        {showInvite && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Üye Davet Et</h2>
            <form onSubmit={handleInvite} className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="ornek@sirket.com"
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                required
              />
              <button
                type="submit"
                disabled={inviting}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {inviting ? "Gönderiliyor..." : "Davet Gönder"}
              </button>
            </form>

            {inviteResult?.link && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 rounded-xl">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium mb-2">Davet linki oluşturuldu:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-800 text-gray-700 dark:text-gray-300 flex-1 truncate">
                    {inviteResult.link}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(inviteResult.link!)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                  >
                    Kopyala
                  </button>
                </div>
              </div>
            )}
            {inviteResult?.error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{inviteResult.error}</p>
            )}
          </div>
        )}

        {/* Members */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">Takım Üyeleri</h2>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {org.members.map((member) => (
              <div key={member.user_id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.name} className="w-9 h-9 rounded-full shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300 shrink-0">
                      {member.name[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{member.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLOR[member.role]}`}>
                    {ROLE_LABEL[member.role]}
                  </span>
                  {canManage && member.role !== "owner" && (
                    <button
                      onClick={() => handleRemove(member.user_id)}
                      className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                    >
                      Çıkar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
