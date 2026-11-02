import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import type { Workspace } from "@shared/types";
import { api, useStore } from "../lib/store";
import { Spinner } from "./common";

/** The student's photo (theirs, else Google's), or their initials. */
export function Avatar({ initials }: { initials: string }) {
  const { ws, me } = useStore();
  const src = ws?.photoAt ? `/api/profile/photo?v=${encodeURIComponent(ws.photoAt)}` : me?.picture;
  return <div className="avatar">{src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : initials}</div>;
}

// Center-crops to a square and shrinks to 256 px JPEG in the browser, so uploads are small and EXIF data is dropped.
async function squareJpeg(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  c.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("Couldn't read that photo."))), "image/jpeg", 0.85));
}

/** Upload, change or remove the profile photo (Account → Profile). */
export function ProfilePhoto({ initials }: { initials: string }) {
  const { ws, setWs, run } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    await run(async () => {
      const fd = new FormData();
      fd.append("file", await squareJpeg(file), "photo.jpg");
      setWs(await api<Workspace>("POST", "/api/profile/photo", fd));
    }, "Photo updated");
    setBusy(false);
    if (input.current) input.current.value = "";
  };
  const remove = async () => { const r = await run(() => api<Workspace>("DELETE", "/api/profile/photo"), "Photo removed"); if (r) setWs(r); };
  return (
    <div className="row" style={{ gap: 14, alignItems: "center" }} data-testid="profile-photo">
      <div className="photo-lg"><Avatar initials={initials} /></div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} aria-label="Choose a profile photo" />
      <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => input.current?.click()} data-testid="button-photo-upload">{busy ? <Spinner /> : <Camera size={14} />} {ws?.photoAt ? "Change photo" : "Add a photo"}</button>
      {ws?.photoAt && <button className="btn btn-ghost btn-sm" onClick={remove} data-testid="button-photo-remove"><Trash2 size={14} /> Remove</button>}
    </div>
  );
}
