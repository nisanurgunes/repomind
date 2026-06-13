const BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/api";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("devpulse_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Hata oluştu" }));
    throw new Error(err.detail ?? "Hata oluştu");
  }
  return res.json();
}

export const api = {
  analyzeRepo: (owner: string, name: string) =>
    request<any>(`/repos/analyze?owner=${owner}&name=${name}`, { method: "POST" }),

  getRepo: (owner: string, name: string) =>
    request<any>(`/repos/${owner}/${name}`),

  getRepoHistory: (owner: string, name: string) =>
    request<any>(`/repos/${owner}/${name}/history`),

  getCommitChart: (owner: string, name: string) =>
    request<any>(`/repos/chart/${owner}/${name}/commits`),

  getWatchlist: () =>
    request<any>(`/users/watchlist`),

  addToWatchlist: (repoId: number) =>
    request<any>(`/users/watchlist/${repoId}`, { method: "POST" }),

  removeFromWatchlist: (repoId: number) =>
    request<any>(`/users/watchlist/${repoId}`, { method: "DELETE" }),

  getNotifications: () =>
    request<any>(`/notifications/`),

  markNotificationsRead: () =>
    request<any>(`/notifications/mark-read`, { method: "POST" }),

  checkNotifications: () =>
    request<any>(`/notifications/check`, { method: "POST" }),

  getFeatureGap: (owner: string, name: string) =>
    request<any>(`/repos/${owner}/${name}/feature-gap`),

  getProjectAnalysis: (owner: string, name: string) =>
    request<any>(`/repos/${owner}/${name}/project-analysis`),

  advisorChat: (owner: string, name: string, messages: {role: string; content: string}[], repoContext: object) =>
    request<any>(`/repos/${owner}/${name}/advisor-chat`, {
      method: "POST",
      body: JSON.stringify({ messages, repo_context: repoContext }),
    }),

  getMyRepos: () => request<any>(`/users/my-repos`),
  syncMyRepos: () => request<any>(`/users/sync-repos`, { method: "POST" }),

  // Features
  saveFeature: (body: {
    repo_full_name: string; title: string; description: string;
    priority: string; effort: string; seen_in: string[];
  }) => request<any>(`/features/`, { method: "POST", body: JSON.stringify(body) }),

  listFeatures: () => request<any>(`/features/`),

  getFeatureCounts: () => request<any>(`/features/counts`),

  updateFeatureStatus: (id: number, status: string) =>
    request<any>(`/features/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  deleteFeature: (id: number) =>
    request<any>(`/features/${id}`, { method: "DELETE" }),

  // Orgs
  createOrg: (name: string, description?: string) =>
    request<any>(`/orgs/`, { method: "POST", body: JSON.stringify({ name, description }) }),

  listMyOrgs: () =>
    request<any>(`/orgs/`),

  getOrg: (slug: string) =>
    request<any>(`/orgs/${slug}`),

  inviteMember: (slug: string, email: string) =>
    request<any>(`/orgs/${slug}/invite`, { method: "POST", body: JSON.stringify({ email }) }),

  joinOrg: (token: string) =>
    request<any>(`/orgs/join/${token}`),

  removeMember: (slug: string, userId: number) =>
    request<any>(`/orgs/${slug}/members/${userId}`, { method: "DELETE" }),

  updateMemberRole: (slug: string, userId: number, role: string) =>
    request<any>(`/orgs/${slug}/members/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
};
