import { NAME_CHECK, nameUnsure } from "@shared/names";
import { useStore } from "../lib/store";

/** Owners (Nov 23 live test: the letter ended "Sincerely," with no name and the file was "Student-Alcon-Resume"):
 *  while "Which name should Remy use?" is open, ask it right here, where the name is needed. */
export function NameChoice() {
  const { ws, save } = useStore();
  const w = ws!;
  if (!nameUnsure(w)) return null;
  const onResume = w.resume!.doc.contact.name.trim(), account = w.profile.name.trim();
  const pick = async (name: string) => {
    if (name !== account) await save("profile", { ...w.profile, name }); // a new name answers the question on the server
    else await save("tasks", w.tasks.map((t) => (t.source === NAME_CHECK && !t.done ? { ...t, done: true } : t)));
  };
  return (
    <div className="card card-pad row-between" data-testid="name-choice">
      <span className="small"><b>Which name goes on your letter and files?</b> Your resume says “{onResume}”{account ? `, your account says “${account}”` : ""}. Until you pick, Remy leaves it off.</span>
      <span className="row" style={{ gap: 6 }}>
        <button className="btn btn-primary btn-sm" onClick={() => pick(onResume)} data-testid="button-name-resume">{onResume}</button>
        {account && <button className="btn btn-secondary btn-sm" onClick={() => pick(account)} data-testid="button-name-account">{account}</button>}
      </span>
    </div>
  );
}
