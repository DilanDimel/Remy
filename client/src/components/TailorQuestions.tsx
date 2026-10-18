import { useState } from "react";
import { Check } from "lucide-react";
import type { Application, Job, Workspace } from "@shared/types";
import { api, useStore } from "../lib/store";
import { clearAnswers, getAnswers, setAnswer, useAnswers } from "../lib/tailorDraft";
import { Remy, Spinner } from "./common";

/** What Remy asks before writing a letter, so it doesn't need placeholders. */
export const preQuestions = (job: Job) => [
  { key: "why", q: `What draws you to ${job.company}?` },
  { key: "learn", q: "What do you most want to do or learn in this role?" },
  { key: "extra", q: `Anything else ${job.company} should know? (availability, someone you talked to, a project you're proud of)` },
];
export const preAnswers = (appId: string, job: Job) => {
  const d = getAnswers(appId);
  return preQuestions(job).map((x) => ({ q: x.q, a: (d[x.key] || "").trim() })).filter((x) => x.a);
};

/** Remy's questions for one application: before tailoring (why this company, …) and
 * after (each [PERSONALIZE] gap in the letter). Answers fill the letter for the student. */
export function TailorQuestions({ a, job, busy, compact }: { a: Application; job: Job; busy?: boolean; compact?: boolean }) {
  const { setWs, run } = useStore();
  const answers = useAnswers(a.id);
  const [sending, setSending] = useState(false);
  const open = a.personalize.filter((p) => !p.done);
  const before = !a.generatedAt;
  const qs = before ? preQuestions(job) : open.map((p) => ({ key: p.id, q: p.text }));
  if (!before && !qs.length)
    return (
      <div className="tq tq-done" data-testid="tailor-questions-done">
        <Remy size={compact ? 30 : 36} mood="happy" />
        <p className="small"><b>Remy:</b> I have everything I need for your {job.company} letter. Review it, then approve and export.</p>
      </div>
    );
  const send = async () => {
    setSending(true);
    const r = await run(
      () => api<{ workspace: Workspace }>("POST", `/api/applications/${a.id}/answers`, { answers: qs.map((x) => ({ pid: x.key, q: x.q, a: answers[x.key] || "" })) }),
      "Remy added your answers to the letter",
    );
    if (r) { setWs(r.workspace); clearAnswers(a.id); }
    setSending(false);
  };
  const filled = qs.filter((x) => (answers[x.key] || "").trim()).length;
  return (
    <div className="tq" data-testid="tailor-questions">
      <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 10 }}>
        <Remy size={compact ? 30 : 36} mood={busy || sending ? "think" : "wave"} />
        <p className="small">
          <b>Remy:</b>{" "}
          {before
            ? busy ? `I'm tailoring for ${job.company} — answer these meanwhile and I'll use them in your letter.` : `Before I write your ${job.company} letter, a few quick questions so it sounds like you.`
            : `Your ${job.company} letter has ${qs.length} spot${qs.length > 1 ? "s" : ""} only you can fill. Answer here and I'll write ${qs.length > 1 ? "them" : "it"} in.`}
        </p>
      </div>
      {qs.map((x) => (
        <label key={x.key} className="field">
          <span className="small">{x.q}</span>
          <textarea className="textarea" style={{ minHeight: 60 }} value={answers[x.key] || ""} onChange={(e) => setAnswer(a.id, x.key, e.target.value)} placeholder="A sentence or two, in your own words" data-testid={`input-tq-${x.key}`} />
        </label>
      ))}
      {before ? (
        <span className="xs muted">{filled ? <><Check size={12} style={{ display: "inline" }} /> I'll use {filled === 1 ? "this" : "these"} when you press <b>Tailor with AI</b>.</> : "Optional, but it saves you editing the letter later."}</span>
      ) : (
        <button className="btn btn-primary btn-sm" onClick={send} disabled={!filled || sending} data-testid="button-tq-send">{sending ? <Spinner /> : null} Use my answers</button>
      )}
    </div>
  );
}
