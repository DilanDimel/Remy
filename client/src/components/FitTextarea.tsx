import { useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/** A text box that grows to show everything in it, so long resume lines aren't cut off (worst on phones).
 *  Re-fits whenever the text changes (typing, picking another wording, undo) and when the screen turns or unfolds. */
export function FitTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + 2 + "px";
  };
  useLayoutEffect(() => { fit(); }, [props.value]);
  useEffect(() => {
    window.addEventListener("resize", fit);
    document.fonts?.ready.then(fit); // the web font changes where lines wrap
    return () => { window.removeEventListener("resize", fit); };
  }, []);
  return <textarea ref={ref} {...props} />;
}
