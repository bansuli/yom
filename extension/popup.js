const CLOTHING = "https://www.thereformation.com/clothing";
const GREEN = "https://www.thereformation.com/search?q=green%20dress";

const authOut = document.getElementById("auth-out");
const authIn = document.getElementById("auth-in");
const who = document.getElementById("who");
const errEl = document.getElementById("auth-err");
const form = document.getElementById("login-form");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const logoutBtn = document.getElementById("logout");

let signup = false;

function showErr(msg) {
  if (!msg) {
    errEl.hidden = true;
    errEl.textContent = "";
    return;
  }
  errEl.hidden = false;
  errEl.textContent = msg;
}

function renderAuth(session) {
  const loggedIn = Boolean(session?.access_token && session?.profile);
  authOut.hidden = loggedIn;
  authIn.hidden = !loggedIn;
  if (loggedIn) {
    const name = session.profile.name || session.user?.email || "";
    who.textContent = `shopping as ${name}`;
  }
}

function send(type, extra = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...extra }, (res) => {
      if (chrome.runtime.lastError) resolve({ ok: false, error: "extension isn't ready." });
      else resolve(res || { ok: false });
    });
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showErr("");
  loginBtn.disabled = true;
  const body = { email: emailEl.value.trim(), password: passwordEl.value };
  const res = await send(signup ? "YOM_SIGNUP" : "YOM_LOGIN", { body });
  loginBtn.disabled = false;
  if (res.fallback) {
    showErr("live login isn't on yet. shop as the demo for now.");
    return;
  }
  if (!res.ok) {
    showErr(res.error || (signup ? "could not create the account." : "could not log in."));
    return;
  }
  if (!res.access_token) {
    signup = false;
    loginBtn.textContent = "log in";
    signupBtn.textContent = "create account";
    showErr("account created. log in.");
    return;
  }
  passwordEl.value = "";
  renderAuth(res.session);
});

signupBtn.addEventListener("click", () => {
  signup = !signup;
  loginBtn.textContent = signup ? "create account" : "log in";
  signupBtn.textContent = signup ? "already have an account? log in" : "create account";
  showErr("");
});

logoutBtn.addEventListener("click", async () => {
  await send("YOM_LOGOUT");
  renderAuth(null);
});

document.getElementById("launch").addEventListener("click", () => {
  chrome.tabs.create({ url: CLOTHING });
  window.close();
});

document.getElementById("launch-green").addEventListener("click", () => {
  chrome.tabs.create({ url: GREEN });
  window.close();
});

document.getElementById("launch-tab").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id || !tab.url) return;
    let host = "";
    try {
      host = new URL(tab.url).hostname;
    } catch {
      return;
    }
    chrome.runtime.sendMessage({ type: "YOM_FORCE_HOST", host }, () => {
      chrome.tabs.reload(tab.id);
      window.close();
    });
  });
});

send("YOM_ME").then((res) => renderAuth(res.session));
