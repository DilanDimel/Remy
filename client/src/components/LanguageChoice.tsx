// Remy in the student's language (Nov 27, Dilan approved the plan and mockups). Owners first: the `languages` switch.
// "Match my device" is the default: Remy talks in the device's language until the student picks one.
import { useState } from "react";
import { hasScreens, langOf, LANGUAGES, translate } from "@shared/i18n";
import { useStore } from "../lib/store";
import { myDevice, useLang, useT } from "../lib/i18n";
import { useAccess } from "./ComingSoon";
import { Modal, Remy } from "./common";

/** The Language card in Account → Settings. */
export function LanguageCard() {
  const { ws, save } = useStore();
  const t = useT();
  const code = useLang();
  const device = myDevice();
  if (useAccess()("languages") !== "open") return null;
  const s = ws!.settings;
  const lang = langOf(code);
  return (
    <div className="card card-pad stack-sm" data-testid="card-language">
      <h3>{t("Language")}</h3>
      <div className="ac-set">
        <div><div><b>{t("Remy talks to you in")}</b><small>{t("Screens, chat and interview tips")}</small></div>
          <select className="select ac-select" value={s.language || "auto"} onChange={(e) => save("settings", { language: e.target.value })} aria-label={t("Remy talks to you in")} data-testid="select-language">
            <option value="auto">{t("Match my device ({name})", { name: langOf(device).name })}</option>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}{l.name !== l.english ? ` (${l.english})` : ""}</option>)}
          </select></div>
      </div>
      <p className="xs muted" style={{ margin: 0 }} data-testid="text-language-note">
        {code !== "en" && !hasScreens(code)
          ? `Screens stay in English for now. Remy's chat and interview tips come in ${lang.english}.`
          : t("Your resume, letters and emails to employers stay in English, which US employers expect. Interview practice stays in English, like the real interview.")}
      </p>
    </div>
  );
}

/** First visit with the feature open and a device in another language: one question, then never again. */
export function FirstLanguage() {
  const { ws, save } = useStore();
  const open = useAccess()("languages") === "open";
  const device = myDevice();
  const [other, setOther] = useState(false);
  if (!open || !ws || ws.settings.language || device === "en") return null;
  const l = langOf(device);
  const tt = (x: string, v?: Record<string, string>) => translate(hasScreens(device) ? device : "en", x, v);
  const pick = (code: string) => save("settings", { language: code });
  return (
    <Modal title={hasScreens(device) ? "Elige tu idioma · Pick your language" : `Pick your language · ${l.name}`} onClose={() => pick("auto")}>
      <div className="stack-sm lang-first" data-testid="modal-first-language">
        <div className="row" style={{ gap: 12 }}><Remy size={44} mood="wave" /><p className="small" style={{ margin: 0 }}>{tt("Your device is in {name}, so Remy can talk to you in it. Your resume stays in English for US employers. Change it anytime in Account.", { name: l.name })}</p></div>
        {!other ? (
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => pick(device)} data-testid="button-language-device">{l.name}</button>
            <button className="btn btn-secondary" onClick={() => pick("en")} data-testid="button-language-english">English</button>
            <button className="btn btn-ghost" onClick={() => setOther(true)} data-testid="button-language-other">{tt("Another language")}</button>
          </div>
        ) : (
          <div className="lang-grid">
            {LANGUAGES.map((x) => <button key={x.code} className="btn btn-secondary" onClick={() => pick(x.code)} data-testid={`button-language-${x.code}`}><b>{x.name}</b>{x.name !== x.english && <small>{x.english}</small>}</button>)}
          </div>
        )}
      </div>
    </Modal>
  );
}
