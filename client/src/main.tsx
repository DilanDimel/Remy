import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { reportClientError } from "./components/ErrorBoundary";
import { startRouter } from "./lib/router";
import { guardDomAgainstTranslators } from "./lib/domGuard";
import { startNative } from "./lib/native";
import { hideSplash } from "./lib/splash";

window.addEventListener("error", (e) => reportClientError("window", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => reportClientError("promise", e.reason));

// Big monitors (1700px+ wide) zoom the app up so pages fill the screen, but only as far as the window's height allows:
// the layout always keeps the ~940px a 1440x800 laptop gets at 85%, so every page still fits with no scrolling. Keying
// on width alone (Nov 26) zoomed a 1920x1023 window to 1.15, leaving 890px and a scrolling Home. Laptops keep .85 (CSS).
const fitZoom = () => {
  const z = innerWidth < 1700 ? 0 : Math.max(1, Math.min(1.5, Math.floor((innerHeight / 940) * 20) / 20, Math.floor((innerWidth / 1450) * 20) / 20));
  if (z) document.documentElement.style.setProperty("--app-zoom", String(z)); else document.documentElement.style.removeProperty("--app-zoom");
};
fitZoom();
window.addEventListener("resize", fitZoom);

guardDomAgainstTranslators();
startRouter();
startNative().catch((e) => reportClientError("native", e));

createRoot(document.getElementById("root")!).render(<App />);
// Never leave the loading screen over a crash or a hung request; the app's own "getting things ready" shows under it.
setTimeout(hideSplash, 10000);
