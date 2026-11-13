const sessionKey = "mutirao-supabase-session:" + supabaseConfig?.url;
let session;
let refreshInFlight;

async function supabaseRequest(path, { method = "GET", body, token, representation = false } = {}) {
  const headers = { apikey: supabaseConfig.key };
  if (token) headers.Authorization = "Bearer " + token;
  if (body) headers["Content-Type"] = "application/json";
  if (representation) headers.Prefer = "return=representation";
  const response = await fetch(supabaseConfig.url + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error("O Supabase não concluiu a operação.");
    error.status = response.status;
    error.code = result?.error_code ?? result?.code;
    throw error;
  }
  return result;
}

function discardLegacySignInRedirect() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.has("access_token") || params.has("error_code")) {
    history.replaceState(history.state, "", location.pathname + location.search + "#visao");
  }
}

function storeSession(result) {
  if (!result?.access_token || !result.refresh_token) throw new Error("O Supabase não retornou uma sessão.");
  session = { access_token: result.access_token, refresh_token: result.refresh_token,
    expires_at: result.expires_at ?? Math.floor(Date.now() / 1000) + result.expires_in };
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
}

function restoreSession() {
  try { session = JSON.parse(sessionStorage.getItem(sessionKey) || "null"); }
  catch { clearSession(); }
  return !!session;
}

function clearSession() {
  session = null;
  sessionStorage.removeItem(sessionKey);
}

async function accessToken() {
  if (!session) throw new Error("Entre para acessar o painel.");
  if (session.expires_at > Date.now() / 1000 + 30) return session.access_token;
  if (!refreshInFlight) {
    const refreshToken = session.refresh_token;
    refreshInFlight = supabaseRequest("/auth/v1/token?grant_type=refresh_token", {
      method: "POST", body: { refresh_token: refreshToken },
    }).then((result) => {
      if (session?.refresh_token === refreshToken) storeSession(result);
    }).finally(() => { refreshInFlight = null; });
  }
  await refreshInFlight;
  if (!session) throw new Error("Entre para acessar o painel.");
  return session.access_token;
}

async function signInWithPassword(email, password) {
  storeSession(await supabaseRequest("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } }));
}

async function signOut() {
  try {
    await supabaseRequest("/auth/v1/logout?scope=local", { method: "POST", token: await accessToken() });
  } finally {
    clearSession();
  }
}

const dashboardRoute = "/rest/v1/mutirao_mentoria_dashboard?id=eq.1";

async function loadSharedDashboard() {
  const rows = await supabaseRequest(dashboardRoute + "&select=revision,data", { token: await accessToken() });
  if (!rows?.length) {
    const error = new Error("Sua conta ainda não tem acesso ao painel. Solicite a liberação ao responsável.");
    error.status = 403;
    throw error;
  }
  return rows[0];
}

async function saveSharedDashboard(revision, data) {
  const rows = await supabaseRequest(dashboardRoute + "&revision=eq." + revision + "&select=revision", {
    method: "PATCH", body: { revision: revision + 1, data }, token: await accessToken(), representation: true,
  });
  if (!rows?.length) {
    await loadSharedDashboard();
    const error = new Error("O painel foi atualizado por outra pessoa. Reabra o formulário e tente novamente.");
    error.conflict = true;
    throw error;
  }
  return rows[0].revision;
}
