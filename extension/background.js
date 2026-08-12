chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "OPEN_REFORMATION") {
    const url = msg.url || "https://www.thereformation.com/clothing";
    chrome.tabs.create({ url });
    sendResponse({ ok: true });
  }
  return true;
});
