export const VOTER_NAME_KEY = "yom_voter_name";

export function loadVoterName() {
  try {
    return localStorage.getItem(VOTER_NAME_KEY) || "";
  } catch {
    return "";
  }
}

export function saveVoterName(name) {
  try {
    localStorage.setItem(VOTER_NAME_KEY, String(name || "").trim());
  } catch {
    /* ignore */
  }
}

export function voterDisplayName(vote = {}) {
  const name = String(vote.voter_name || "").trim();
  if (name) return name.split(/\s+/)[0];
  const email = String(vote.voter_email || "");
  if (email.includes("@")) return email.split("@")[0];
  return "someone";
}
