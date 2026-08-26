/** Production API — native apps load UI locally but call youryom.com. */
export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "https://www.youryom.com";

export function isNativeApp() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

export function nativePlatform() {
  if (typeof window === "undefined") return "web";
  try {
    return window.Capacitor?.getPlatform?.() || "web";
  } catch {
    return "web";
  }
}

export function apiUrl(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (isNativeApp()) return `${API_ORIGIN}${normalized}`;
  return normalized;
}
