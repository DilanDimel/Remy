import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../lib/store";
import { Spinner } from "./common";

/** The student's Word file drawn with its real layout (borders, lines, fonts, tabs). It's built in this page and
 * shown in a sandboxed frame with no scripts, so nothing inside an uploaded file can run. */
export function WordPreview({ version }: { version: string }) {
  const [doc, setDoc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // The frame runs no scripts, so the page is scaled to the frame's width from out here.
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setZoom(Math.min(1, (el.clientWidth - 28) / 816));
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [{ renderAsync }, r] = await Promise.all([import("docx-preview"), fetch(`${API_BASE}/api/resume/original`, { credentials: "include" })]);
        if (!r.ok) throw new Error(String(r.status));
        const body = document.createElement("div"), styles = document.createElement("div");
        await renderAsync(await r.blob(), body, styles, { inWrapper: true, ignoreLastRenderedPageBreak: false, renderHeaders: true, renderFooters: true, useBase64URL: true, experimental: true });
        const fit = "<style>html,body{margin:0;background:#e9e7ee;overflow-x:hidden}.docx-wrapper{background:#e9e7ee!important;padding:12px!important}.docx-wrapper>section.docx{box-shadow:0 1px 6px rgba(0,0,0,.15)!important;margin-bottom:12px!important}</style>";
        if (live) setDoc(`<!doctype html><html><head><meta charset="utf-8">${styles.innerHTML}${fit}</head><body>${body.innerHTML}</body></html>`);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => { live = false; };
  }, [version]);
  // If the layout can't be drawn, fall back to the plain text preview from the server.
  if (failed) return <iframe className="pdf-preview" sandbox="" src={`${API_BASE}/api/resume/original?view=html&v=${encodeURIComponent(version)}`} title="Your original resume" data-testid="pdf-preview" />;
  if (!doc) return <div className="pdf-preview row" style={{ justifyContent: "center" }}><Spinner /> Drawing your resume…</div>;
  return <div ref={box}><iframe className="pdf-preview" sandbox="" srcDoc={doc.replace("</head>", `<style>body{zoom:${zoom.toFixed(3)}}</style></head>`)} title="Your original resume" data-testid="pdf-preview" /></div>;
}
