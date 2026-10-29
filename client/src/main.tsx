import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { reportClientError } from "./components/ErrorBoundary";
import { startRouter } from "./lib/router";

window.addEventListener("error", (e) => reportClientError("window", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => reportClientError("promise", e.reason));

startRouter();

createRoot(document.getElementById("root")!).render(<App />);
