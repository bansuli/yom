/*
 * Avatars are a solid colour and an initial — no photo pulled from Google.
 *
 * The palette is shared by the server (which assigns one at signup) and the
 * client (which offers the same swatches to change it), so a colour chosen in
 * one place always means the same thing in the other.
 */

/*
 * Bright, flat, Pantone-chip colours. Nothing is written on an avatar any
 * more, so these do not have to carry white text — they only have to be
 * distinct from one another at 38px.
 */
export const AVATAR_COLORS = [
  "#E63946", // red
  "#F26419", // orange
  "#F4A300", // amber
  "#FFD400", // yellow
  "#7CB518", // lime
  "#2FA84F", // green
  "#1B998B", // teal
  "#2EC4B6", // turquoise
  "#2D7DD2", // blue
  "#3D348B", // indigo
  "#8E44AD", // violet
  "#E5387E", // pink
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
