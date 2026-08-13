const SESSION = "yom-beta";

async function parseRes(res) {
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: null };
  }
}

async function post(path, body, token) {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body || {}),
    });
    const parsed = await parseRes(res);
    if (parsed.status === 404 || parsed.status === 503 || !parsed.data) {
      return { fallback: true, error: parsed.data?.error };
    }
    return { status: parsed.status, ...parsed.data };
  } catch {
    return { fallback: true };
  }
}

async function get(path, token) {
  try {
    const res = await fetch(path, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    const parsed = await parseRes(res);
    if (parsed.status === 404 || parsed.status === 503 || !parsed.data) {
      return { fallback: true, error: parsed.data?.error };
    }
    return { status: parsed.status, ...parsed.data };
  } catch {
    return { fallback: true };
  }
}

export function loadBetaSession() {
  try {
    const raw = sessionStorage.getItem(SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveBetaSession(session) {
  sessionStorage.setItem(SESSION, JSON.stringify(session));
}

export function clearBetaSession() {
  sessionStorage.removeItem(SESSION);
}

export function yomLogin(email, password) {
  return post("/api/login", { email, password });
}

export function yomSignup(email, password, name) {
  return post("/api/signup", { email, password, name });
}

export function yomMe(token) {
  return get("/api/me", token);
}
