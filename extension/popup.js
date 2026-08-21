document.querySelector(".brand")?.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://youryom.com/scan" });
});
