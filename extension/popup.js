const ONBOARDING = "https://youryom.com/onboarding?from=extension";
const SIGNIN = "https://youryom.com/signin?from=extension";
const SCAN = "https://youryom.com/scan";

function open(url) {
  chrome.tabs.create({ url });
}

function showSignedIn(session) {
  const name = session?.profile?.name || session?.user?.email || "you";
  document.getElementById("auth-out")?.classList.add("hidden");
  document.getElementById("auth-in")?.classList.remove("hidden");
  const who = document.getElementById("who");
  if (who) who.textContent = `signed in as ${name}`;
}

function showSignedOut() {
  document.getElementById("auth-out")?.classList.remove("hidden");
  document.getElementById("auth-in")?.classList.add("hidden");
}

document.getElementById("create-yom")?.addEventListener("click", () => open(ONBOARDING));
document.getElementById("login-yom")?.addEventListener("click", () => open(SIGNIN));
document.getElementById("open-scan")?.addEventListener("click", () => open(SCAN));
document.getElementById("logout-yom")?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "YOM_LOGOUT" }, () => showSignedOut());
});
document.querySelector(".brand")?.addEventListener("click", () => open(SCAN));

chrome.runtime.sendMessage({ type: "YOM_ME" }, (res) => {
  if (chrome.runtime.lastError) return;
  if (res?.ok && res.session) showSignedIn(res.session);
  else showSignedOut();
});
