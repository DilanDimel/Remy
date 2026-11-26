import { useState } from "react";
import { logoSrc } from "@shared/logos";
import { orgInitials } from "../lib/jobs";
import { useOwnerView } from "../lib/store";

/** A company's tile on opening cards: its logo for owners (redesign), its initials for students, until the logo loads,
 *  and whenever there's none. `url` is the posting link, used when the company isn't one Remy already knows. */
export function OrgLogo({ company, url, className = "job-mono", text }: { company: string; url?: string; className?: string; text?: string }) {
  const owner = useOwnerView();
  const { src, sure } = owner ? logoSrc(company, url) : { src: "", sure: false };
  const [size, setSize] = useState(0); // the loaded image's width; -1 = no logo
  const show = !!src && size > 0;
  return (
    <span className={className + (show ? " org-logo" + (size < 32 ? " org-logo-sm" : "") : "")} aria-hidden="true">
      {!show && (text ?? orgInitials(company || "?"))}
      {src && size >= 0 && <img src={src} alt="" hidden={!show} decoding="async" referrerPolicy="no-referrer"
        onLoad={(e) => { const w = e.currentTarget.naturalWidth; setSize(w > 16 || (sure && w) ? w : -1); }} onError={() => setSize(-1)} />}
    </span>
  );
}
