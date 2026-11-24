// Removes the loading screen in index.html (#splash) once the app has something to show. It fades out if it had
// appeared (loads over 0.3 s); otherwise it was never visible and just goes.
export function hideSplash() {
  const el = document.getElementById("splash");
  if (!el) return;
  const shown = getComputedStyle(el).opacity;
  if (shown === "0") return el.remove();
  el.style.opacity = shown;
  el.style.animation = "none";
  el.style.transition = "opacity .2s";
  void el.offsetWidth; // apply the pinned opacity before fading
  el.style.opacity = "0";
  setTimeout(() => el.remove(), 250);
}
