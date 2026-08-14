const CLOTHING = "https://www.thereformation.com/clothing";

document.querySelector(".brand")?.addEventListener("click", () => {
  chrome.tabs.create({ url: CLOTHING });
});
