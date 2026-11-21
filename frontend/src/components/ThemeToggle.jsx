import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || "light"
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("theme", theme); } catch { /* abaikan */ }
  }, [theme]);

  const dark = theme === "dark";
  return (
    <button
      className="btn ghost"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
    >
      {dark ? "☀ Terang" : "☾ Gelap"}
    </button>
  );
}