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

guardDomAgainstTranslators();
startRouter();
startNative().catch((e) => reportClientError("native", e));

createRoot(document.getElementById("root")!).render(<App />);
// Never leave the loading screen over a crash or a hung request; the app's own "getting things ready" shows under it.
setTimeout(hideSplash, 10000);
