import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { reportClientError } from "./components/ErrorBoundary";
import { startRouter } from "./lib/router";
import { guardDomAgainstTranslators } from "./lib/domGuard";
import { startNative } from "./lib/native";

window.addEventListener("error", (e) => reportClientError("window", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => reportClientError("promise", e.reason));

guardDomAgainstTranslators();
startRouter();
startNative().catch((e) => reportClientError("native", e));

createRoot(document.getElementById("root")!).render(<App />);
