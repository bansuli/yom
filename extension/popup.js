const CLOTHING = "https://www.thereformation.com/clothing";
const GREEN = "https://www.thereformation.com/search?q=green%20dress";

document.getElementById("launch").addEventListener("click", () => {
  chrome.tabs.create({ url: CLOTHING });
  window.close();
});

document.getElementById("launch-green").addEventListener("click", () => {
  chrome.tabs.create({ url: GREEN });
  window.close();
});
