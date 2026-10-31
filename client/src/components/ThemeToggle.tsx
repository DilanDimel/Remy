import { Monitor, Moon, Sun } from "lucide-react";
import { useStore, type Theme } from "../lib/store";

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Theme, string> = { system: "Match my device", light: "Light", dark: "Dark" };

/** One button that cycles Match device → Light → Dark; works signed out too. */
export function ThemeToggle({ className = "icon-btn" }: { className?: string }) {
  const { theme, setTheme } = useStore();
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <button type="button" className={className} onClick={() => setTheme(NEXT[theme])} title={`Theme: ${LABEL[theme]} (click to change)`}
      aria-label={`Theme: ${LABEL[theme]}. Change to ${LABEL[NEXT[theme]]}`} data-testid="button-theme-toggle">
      <Icon size={17} />
    </button>
  );
}

/** The three choices side by side, for settings pages. */
export function ThemeChoice() {
  const { theme, setTheme } = useStore();
  return (
    <div className="seg" role="group" aria-label="Theme">
      {(["system", "light", "dark"] as const).map((t) => (
        <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)} data-testid={`button-theme-${t}`}>{LABEL[t]}</button>
      ))}
    </div>
  );
}
