import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { reportClientError } from "./components/ErrorBoundary";

window.addEventListener("error", (e) => reportClientError("window", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => reportClientError("promise", e.reason));

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
