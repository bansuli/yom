const CLOTHING = "https://www.thereformation.com/clothing";
const GREEN = "https://www.thereformation.com/search?q=green%20dress";

const launch = document.getElementById("launch");
const launchGreen = document.getElementById("launch-green");
const launchTab = document.getElementById("launch-tab");
const saveKey = document.getElementById("save-key");
const clearKey = document.getElementById("clear-key");
const keyInput = document.getElementById("api-key");
const statusEl = document.getElementById("key-status");
const providerEl = document.getElementById("provider");

let provider = "anthropic";

function setProvider(next) {
  provider = next;
  providerEl.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.provider === provider);
  });
}

function setStatus(text) {
  statusEl.textContent = text;
}

providerEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-provider]");
  if (!btn) return;
  setProvider(btn.dataset.provider);
});

launch.addEventListener("click", () => {
  chrome.tabs.create({ url: CLOTHING });
  window.close();
});

launchGreen.addEventListener("click", () => {
  chrome.tabs.create({ url: GREEN });
  window.close();
});

launchTab.addEventListener("click", () => {
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

saveKey.addEventListener("click", () => {
  const key = keyInput.value.trim();
  if (key.length < 8) {
    setStatus("that doesn’t look like a key.");
    return;
  }
  chrome.runtime.sendMessage({ type: "YOM_SET_API", provider, key }, (res) => {
    if (res?.ok) {
      keyInput.value = "";
      setStatus(`override on · ${provider} · ••••${key.slice(-4)}`);
    } else {
      setStatus("couldn’t save.");
    }
  });
});

clearKey.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "YOM_CLEAR_API" }, () => {
    keyInput.value = "";
    setStatus("cleared. back to the shared brain.");
  });
});

chrome.runtime.sendMessage({ type: "YOM_GET_API" }, (res) => {
  if (!res?.ok) return;
  setProvider(res.provider || "anthropic");
  if (res.hasKey) setStatus(`override on · ${res.provider} · ••••${res.tail}`);
  else setStatus("shared brain is on. every user gets it.");
});
