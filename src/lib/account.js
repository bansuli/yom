/**
 * A yom belongs to a person, not to a browser. The account key is the secret
 * that proves it: minted on this device, sent with every write, and the thing
 * a transfer link hands to her next device. Typing an email is not proof of
 * anything, so the key — never the email — is what the server trusts.
 */

const ACCOUNT_KEY = "yom_account_key";

function newKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `yom_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/** This device's key, minting one the first time it is asked for. */
export function getAccountKey() {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(ACCOUNT_KEY);
    if (existing) return existing;
    const key = newKey();
    localStorage.setItem(ACCOUNT_KEY, key);
    return key;
  } catch {
    return "";
  }
}

/** Adopt an account from a transfer link. Returns false if the key looks wrong. */
export function adoptAccountKey(key) {
  const next = String(key || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(next) && !/^yom_[a-z0-9_]{8,}$/i.test(next)) return false;
  try {
    localStorage.setItem(ACCOUNT_KEY, next);
    return true;
  } catch {
    return false;
  }
}

/**
 * Let go of the account on this device. Nothing on the server changes — the key
 * is the only way back in, which is why /me makes her copy her link first.
 */
export function clearAccountKey() {
  try {
    localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* ignore */
  }
}

export function hasAccountKey() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(localStorage.getItem(ACCOUNT_KEY));
  } catch {
    return false;
  }
}
