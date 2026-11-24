import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useStore, type Theme } from "../lib/store";

const LABEL: Record<Theme, string> = { system: "Match my device", light: "Light", dark: "Dark" };

// What the page shows right now (the store sets it on <html>, including when "Match my device" follows the device).
const subscribe = (cb: () => void) => { const o = new MutationObserver(cb); o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); return () => o.disconnect(); };
const shown = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** Quick switch: flips between light and dark. "Match my device" lives in Account settings; works signed out too. */
export function ThemeToggle({ className = "icon-btn", label = false }: { className?: string; label?: boolean }) {
  const { setTheme } = useStore();
  const now = useSyncExternalStore(subscribe, shown, () => "light" as const);
  const next = now === "dark" ? "light" : "dark";
  const Icon = now === "dark" ? Moon : Sun;
  return (
    <button type="button" className={className} onClick={() => setTheme(next)} title={`Switch to ${next} mode`}
      aria-label={`${LABEL[now]} mode. Switch to ${next} mode`} data-testid="button-theme-toggle">
      <Icon size={17} />{label && ` Theme: ${LABEL[now]}`}
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
