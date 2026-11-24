// Before the app loads: set light or dark so the page never flashes white (a file, because the CSP blocks inline scripts).
try { var t = localStorage.getItem("remy.theme"); document.documentElement.dataset.theme = t === "dark" || t === "light" ? t : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch (e) {}
// Loading screen (index.html #splash): a different one of the three on each load, never the same twice in a row.
try { var s = ["a", "b", "c"].filter(function (k) { return k !== localStorage.getItem("remy.splash"); }), p = s[Math.floor(Math.random() * s.length)]; document.documentElement.dataset.splash = p; localStorage.setItem("remy.splash", p); } catch (e) {}
