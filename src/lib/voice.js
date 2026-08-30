/** Strip AI-telltale dashes from takes she actually reads. */
export function humanizeTake(text) {
  return String(text || "")
    .replace(/\s+[—–−‒―]\s+/g, ". ")
    .replace(/(\w)[—―](\w)/g, "$1. $2")
    .replace(/\s+-{2,}\s+/g, ". ")
    .replace(/(\w)\s+-\s+(\w)/g, "$1. $2")
    .replace(/\s*;\s+/g, ". ")
    .replace(/\.\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,.]\s*/, "")
    .trim();
}
