const TOKEN_KEY = "mklens.client.token";
const SESSION_KEY = "mklens.client.session";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_e) {
    return null;
  }
}

export function isLoggedIn() {
  return !!getToken();
}

export function setSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(user || {}));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export async function api(path, options) {
  const opts = options || {};
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    opts.headers || {}
  );
  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;
  try {
    const locale = localStorage.getItem("mklens.locale");
    if (locale) headers["Accept-Language"] = locale;
  } catch (_e) {
    /* ignore */
  }
  const res = await fetch("/api" + path, {
    method: opts.method || "GET",
    headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || "Error de API");
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

export async function apiFile(path, options) {
  const opts = options || {};
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    opts.headers || {}
  );
  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;
  try {
    const locale = localStorage.getItem("mklens.locale");
    if (locale) headers["Accept-Language"] = locale;
  } catch (_e) {
    /* ignore */
  }
  const res = await fetch("/api" + path, {
    method: opts.method || "GET",
    headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || "Error de API");
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  return {
    blob: await res.blob(),
    filename: match ? match[1] : "precios.xlsx",
  };
}

export function loginRequest(email, password) {
  return api("/auth/login", { method: "POST", body: { email, password } });
}

export function logoutRequest() {
  return api("/auth/logout", { method: "POST" }).catch(() => {});
}
