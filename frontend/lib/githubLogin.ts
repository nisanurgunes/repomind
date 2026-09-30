const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const STATE_KEY = "oauth_state";

interface GithubConfig {
  client_id: string;
  redirect_uri: string;
  scope: string;
}

let configPromise: Promise<GithubConfig> | null = null;

// Landing açılınca önceden çağrılır: hem config hazır olur hem de uykudaki
// (Render free) backend kullanıcı butona basmadan uyanmış olur.
export function loadGithubConfig(): Promise<GithubConfig> {
  if (!configPromise) {
    configPromise = fetch(`${API_URL}/api/auth/github/config`)
      .then((res) => {
        if (!res.ok) throw new Error("Giriş ayarları alınamadı");
        return res.json();
      })
      .catch((err) => {
        configPromise = null;
        throw err;
      });
  }
  return configPromise;
}

export async function startGithubLogin(): Promise<void> {
  const config = await loadGithubConfig();
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: config.client_id,
    redirect_uri: config.redirect_uri,
    scope: config.scope,
    state,
  });
  window.location.href = `https://github.com/login/oauth/authorize?${params}`;
}

// Başka bir sitenin kullanıcıyı kendi GitHub hesabıyla oturum açtırmasını
// (login CSRF) engeller: dönen state, bu tarayıcıda başlatılan girişle eşleşmeli.
export function consumeOauthState(returned: string | null): boolean {
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return !!expected && expected === returned;
}

export async function exchangeGithubCode(code: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/github/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Giriş başarısız" }));
    throw new Error(err.detail ?? "Giriş başarısız");
  }
  const data = await res.json();
  return data.token;
}
