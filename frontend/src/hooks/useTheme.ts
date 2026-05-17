import { useState, useCallback, useEffect } from "react";

export type Theme = "dark" | "light" | "purple";

const THEME_KEY = "craneo:theme";

function loadTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const raw = window.localStorage.getItem(THEME_KEY);
  return raw === "light" || raw === "purple" || raw === "dark" ? raw : "dark";
}

/**
 * Owns the active theme: persists the choice and applies it as the
 * `data-theme` attribute on <html> (the CSS variable selector in index.css).
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(loadTheme);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_KEY, t);
    }
  }, []);

  // Apply the persisted theme on mount.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return { theme, setTheme };
}
