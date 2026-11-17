export const THEME_STORAGE_KEY = "atmos-theme";

export function getInitialTheme() {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "light"
    ? "light" : "dark";
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Keep the toggle usable when browser storage is unavailable.
  }
}
