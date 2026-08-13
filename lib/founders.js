import { PROFILES } from "../src/profiles.js";

const EMAILS = {
  "mal@youryom.com": "mal",
  "ban@youryom.com": "ban",
};

export function founderIdFor(email) {
  return EMAILS[String(email || "").trim().toLowerCase()] || null;
}

export function founderSeed(email) {
  const id = founderIdFor(email);
  return id ? PROFILES[id] : null;
}

export function sizesPayload(profile) {
  const display = profile.sizes || [];
  const map = { display };
  for (const row of display) {
    const label = String(row.label || "");
    if (/dress|top|usual/i.test(label)) map.us = row.value;
    else if (/denim/i.test(label)) map.denim = row.value;
    else if (/shoe/i.test(label)) map.shoes = row.value;
  }
  return map;
}
