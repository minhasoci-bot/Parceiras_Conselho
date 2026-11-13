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
    const errorMsg = result?.msg || result?.message || result?.error_description || "O Supabase não concluiu a operação.";
    const error = new Error(errorMsg);
    error.status = response.status;
    error.code = result?.error_code ?? result?.code;
    throw error;
  }
  return result;
}

let recoveryToken = (function () {
  try { return sessionStorage.getItem("mutirao_recovery_token") || null; }
  catch { return null; }
})();

function clearRecoveryToken() {
  recoveryToken = null;
  try { sessionStorage.removeItem("mutirao_recovery_token"); } catch {}
}

function decodeJwt(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return {};
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(base64))));
  } catch {
    return {};
  }
}

async function checkAuthRedirect() {
  const hash = location.hash.slice(1);
  const search = location.search.slice(1);
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(search);

  // 1. Token no hash (#access_token=...&type=recovery)
  if (hashParams.get("type") === "recovery" && hashParams.has("access_token")) {
    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token") || "";
    recoveryToken = access_token;
    try { sessionStorage.setItem("mutirao_recovery_token", access_token); } catch {}
    storeSession({ access_token, refresh_token, expires_in: 3600 });
    history.replaceState(history.state, "", location.pathname + (location.search || "") + "#visao");
    return "recovery";
  }

  if (hashParams.get("type") === "signup" && hashParams.has("access_token")) {
    history.replaceState(history.state, "", location.pathname + "#visao");
    return "signup-confirmed";
  }

  // 2. Token hash na query ou hash (?token_hash=...&type=recovery)
  const tokenHash = searchParams.get("token_hash") || hashParams.get("token_hash");
  const type = searchParams.get("type") || hashParams.get("type");
  if (tokenHash && type === "recovery") {
    try {
      const result = await supabaseRequest("/auth/v1/verify", {
        method: "POST",
        body: { token_hash: tokenHash, type: "recovery" },
      });
      if (result?.access_token) {
        recoveryToken = result.access_token;
        try { sessionStorage.setItem("mutirao_recovery_token", result.access_token); } catch {}
        storeSession(result);
        history.replaceState(history.state, "", location.pathname + "#visao");
        return "recovery";
      }
    } catch {}
  }

  // 3. Authorization code na query (?code=...)
  const code = searchParams.get("code");
  if (code) {
    try {
      const result = await supabaseRequest("/auth/v1/token?grant_type=pkce", {
        method: "POST",
        body: { auth_code: code },
      }).catch(() => supabaseRequest("/auth/v1/token?grant_type=authorization_code", {
        method: "POST",
        body: { code },
      }));
      if (result?.access_token) {
        storeSession(result);
        history.replaceState(history.state, "", location.pathname + "#visao");
        if (searchParams.get("type") === "recovery" || type === "recovery") {
          recoveryToken = result.access_token;
          try { sessionStorage.setItem("mutirao_recovery_token", result.access_token); } catch {}
          return "recovery";
        }
      }
    } catch {}
  }

  // 4. Se já há recoveryToken ativo na sessão
  if (recoveryToken) {
    return "recovery";
  }

  if (hashParams.has("access_token") || hashParams.has("error_code")) {
    history.replaceState(history.state, "", location.pathname + location.search + "#visao");
    if (hashParams.has("error_code")) return "invalid-link";
  }
  return null;
}

function storeSession(result) {
  if (!result?.access_token) throw new Error("O Supabase não retornou uma sessão.");
  const payload = decodeJwt(result.access_token);
  const email = result.user?.email || payload.email || session?.user?.email || "";
  const id = result.user?.id || payload.sub || session?.user?.id || "";
  session = {
    access_token: result.access_token,
    refresh_token: result.refresh_token || session?.refresh_token || "",
    expires_at: result.expires_at ?? Math.floor(Date.now() / 1000) + (result.expires_in || 3600),
    user: { id, email },
  };
  try { localStorage.setItem(sessionKey, JSON.stringify(session)); } catch {}
  try { sessionStorage.setItem(sessionKey, JSON.stringify(session)); } catch {}
}

function currentSessionUser() {
  if (!session) return null;
  if (!session.user?.email && session.access_token) {
    const payload = decodeJwt(session.access_token);
    session.user = { id: payload.sub || "", email: payload.email || "" };
  }
  return session.user || null;
}

function restoreSession() {
  try {
    const raw = localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey);
    session = JSON.parse(raw || "null");
    if (session?.access_token && !session?.user?.email) {
      const payload = decodeJwt(session.access_token);
      session.user = { id: payload.sub || "", email: payload.email || "" };
    }
  } catch {
    clearSession();
  }
  return !!session;
}

function clearSession() {
  if (globalThis.__isRecovering && recoveryToken) return;
  session = null;
  try { localStorage.removeItem(sessionKey); } catch {}
  try { sessionStorage.removeItem(sessionKey); } catch {}
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

async function createAccount(email, password) {
  const redirectTo = location.origin + location.pathname;
  const result = await supabaseRequest("/auth/v1/signup?redirect_to=" + encodeURIComponent(redirectTo), {
    method: "POST", body: { email, password },
  });
  if (!result?.access_token) return false;
  storeSession(result);
  return true;
}

async function sendPasswordReset(email) {
  const redirectTo = location.origin + location.pathname;
  return supabaseRequest("/auth/v1/recover?redirect_to=" + encodeURIComponent(redirectTo), {
    method: "POST", body: { email },
  });
}

async function updatePassword(password) {
  let token = recoveryToken;
  if (!token && session?.access_token) {
    token = session.access_token;
  }
  if (!token) {
    try { token = await accessToken(); }
    catch { token = recoveryToken; }
  }
  if (!token) {
    throw new Error("O link de recuperação expirou ou é inválido. Solicite um novo link em 'Esqueci minha senha'.");
  }

  const result = await supabaseRequest("/auth/v1/user", {
    method: "PUT", body: { password }, token,
  });

  clearRecoveryToken();
  if (result) {
    if (result.access_token) storeSession(result);
    else if (session) storeSession({ ...session, user: result });
  }
  return result;
}

async function getAccessRole() {
  const token = await accessToken();
  const [members, admins] = await Promise.all([
    supabaseRequest("/rest/v1/mutirao_mentoria_members?select=user_id&limit=1", { token }),
    supabaseRequest("/rest/v1/mutirao_mentoria_admins?select=user_id&limit=1", { token }),
  ]);
  if (admins.length) return "admin";
  return members.length ? "member" : "pending";
}

async function requestDashboardAccess() {
  await supabaseRequest("/rest/v1/rpc/mutirao_mentoria_request_access", { method: "POST", body: {}, token: await accessToken() });
}

async function listAccessRequests() {
  return supabaseRequest("/rest/v1/mutirao_mentoria_access_requests?select=user_id,email,requested_at&approved_at=is.null&order=requested_at.asc", { token: await accessToken() });
}

async function approveDashboardAccess(userId) {
  return supabaseRequest("/rest/v1/rpc/mutirao_mentoria_approve_access", {
    method: "POST", body: { applicant_id: userId }, token: await accessToken(),
  });
}

async function rejectDashboardAccess(userId) {
  return supabaseRequest("/rest/v1/rpc/mutirao_mentoria_reject_access", {
    method: "POST", body: { applicant_id: userId }, token: await accessToken(),
  });
}

async function listMembers() {
  return supabaseRequest("/rest/v1/rpc/mutirao_mentoria_list_members", {
    method: "POST", body: {}, token: await accessToken(),
  });
}

async function setMemberPosition(userId, position) {
  return supabaseRequest("/rest/v1/rpc/mutirao_mentoria_set_member_position", {
    method: "POST", body: { target_user_id: userId, new_position: position }, token: await accessToken(),
  });
}

async function removeMember(userId) {
  return supabaseRequest("/rest/v1/rpc/mutirao_mentoria_remove_member", {
    method: "POST", body: { target_user_id: userId }, token: await accessToken(),
  });
}

async function loadPublicDashboardSummary() {
  return supabaseRequest("/rest/v1/rpc/mutirao_mentoria_dashboard_summary");
}

async function loadSharedScenario(scenarioId) {
  return supabaseRequest("/rest/v1/rpc/mutirao_mentoria_shared_scenario", {
    method: "POST", body: { scenario_id: scenarioId },
  });
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
