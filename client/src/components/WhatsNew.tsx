import { useState } from "react";
import { Megaphone } from "lucide-react";
import { NEWS, latestNewsId, unseenNews } from "@shared/news";
import { useStore } from "../lib/store";
import { Modal } from "./common";

const KIND: Record<string, string> = { New: "chip-live", Improved: "chip-student", Fixed: "chip-plain", Changed: "chip-demo" };
const fmt = (d: string) => new Date(d + "T12:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** A quiet "What's new" button: a count only when there's something unseen, the list only when opened. */
export function WhatsNew({ className = "nav-item", label = true }: { className?: string; label?: boolean }) {
  const { ws, me, save } = useStore();
  const [open, setOpen] = useState(false);
  const owner = !!me?.owner;
  const unseen = unseenNews(ws?.settings.newsSeen, owner).length;
  const show = () => {
    setOpen(true);
    if (unseen && ws) save("settings", { newsSeen: latestNewsId() });
  };
  const items = NEWS.filter((n) => owner || !n.owners).sort((a, b) => (a.id < b.id ? 1 : -1));
  const days = [...new Set(items.map((n) => n.date))];
  return (
    <>
      <button className={className} onClick={show} title="What's new" data-testid="button-whats-new">
        <Megaphone size={19} />
        {label && <span className="nav-label">What's new</span>}
        {unseen > 0 && <span className="count" aria-label={`${unseen} new`}>{unseen}</span>}
      </button>
      {open && (
        <Modal title="What's new in Remy" onClose={() => setOpen(false)}>
          <div className="stack" data-testid="whats-new-list">
            {days.map((d) => (
              <section key={d} className="stack-sm">
                <h3 className="xs muted" style={{ textTransform: "none" }}>{fmt(d)}</h3>
                {items.filter((n) => n.date === d).map((n) => (
                  <div key={n.id} className="stack-sm" style={{ gap: 4 }}>
                    <div className="row" style={{ gap: 8 }}><span className={"chip " + KIND[n.kind]}>{n.kind}</span><b className="small">{n.title}</b>{n.owners && <span className="xs muted">Owners only</span>}</div>
                    <p className="small muted">{n.body}</p>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
