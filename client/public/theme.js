// Before the app loads: set light or dark so the page never flashes white (a file, because the CSP blocks inline scripts).
try { var t = localStorage.getItem("remy.theme"); document.documentElement.dataset.theme = t === "dark" || t === "light" ? t : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch (e) {}
