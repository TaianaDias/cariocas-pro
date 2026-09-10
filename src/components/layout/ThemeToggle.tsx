"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const storageKey = "cariocas-pro-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    const nextTheme: Theme = stored === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    window.localStorage.setItem(storageKey, nextTheme);
    applyTheme(nextTheme);
  }

  const nextLabel = theme === "light" ? "Ativar modo escuro" : "Ativar modo claro";

  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={nextLabel} title={nextLabel}>
      <span className="theme-toggle__sun" aria-hidden="true">☀</span>
      <span className="theme-toggle__moon" aria-hidden="true">☾</span>
    </button>
  );
}
