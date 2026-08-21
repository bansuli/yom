/** Recent in-store scans for /join users (local memory until beta account). */

const HISTORY_KEY = "yom_scan_history";
const MAX_ITEMS = 8;

export function loadScanHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendScanHistory(entry = {}) {
  const product = entry.product && typeof entry.product === "object" ? entry.product : {};
  const verdict = entry.verdict && typeof entry.verdict === "object" ? entry.verdict : {};
  const row = {
    at: entry.at || Date.now(),
    brand: String(product.brand || "").trim(),
    name: String(product.name || product.guess || "").trim(),
    decision: String(entry.decision || "").trim(),
    verdict_title: String(verdict.title || "").trim(),
    round: String(entry.round || "").trim(),
  };
  if (!row.name && !row.brand) return;
  try {
    const prev = loadScanHistory().filter(
      (item) =>
        `${item.brand}|${item.name}|${item.decision}` !== `${row.brand}|${row.name}|${row.decision}`
    );
    const next = [row, ...prev].slice(0, MAX_ITEMS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

export function formatScanHistoryForPrompt(items = loadScanHistory()) {
  const list = Array.isArray(items) ? items.filter((i) => i?.name || i?.brand) : [];
  if (!list.length) return "";
  return list
    .slice(0, 6)
    .map((item) => {
      const label = [item.brand, item.name].filter(Boolean).join(" ");
      const parts = [label];
      if (item.decision) parts.push(item.decision);
      if (item.verdict_title) parts.push(`"${item.verdict_title}"`);
      if (item.round) parts.push(`for ${String(item.round).replaceAll("_", " ")}`);
      return parts.join(" · ");
    })
    .join("; ");
}
