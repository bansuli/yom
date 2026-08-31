/*
 * Avatars are a solid colour and an initial — no photo pulled from Google.
 *
 * The palette is shared by the server (which assigns one at signup) and the
 * client (which offers the same swatches to change it), so a colour chosen in
 * one place always means the same thing in the other.
 */

/** Deep enough that white text sits at 4.5:1 or better on every one. */
export const AVATAR_COLORS = [
  "#1F1F1F", // ink
  "#2F4A3C", // pine
  "#1E3A5F", // navy
  "#5B2333", // oxblood
  "#4A3B76", // iris
  "#7A4419", // amber
  "#2C5F5A", // teal
  "#6B2D5C", // plum
];

export function isAvatarColor(value) {
  return AVATAR_COLORS.includes(String(value || "").toUpperCase());
}

/**
 * A stable colour for someone who has not picked one. Same id always gives the
 * same colour, so an avatar does not change on them between sessions.
 */
export function defaultAvatarColor(seed) {
  const s = String(seed || "");
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** One letter, or two for a first and last name. */
export function initialsOf(name, fallback = "") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  const f = String(fallback || "").trim();
  return f ? f.slice(0, 1).toUpperCase() : "?";
}
