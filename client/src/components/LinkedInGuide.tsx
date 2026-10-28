import { useState, type ReactNode } from "react";
import { ArrowLeft, Check, Download, ExternalLink, FileText } from "lucide-react";
import { useStore } from "../lib/store";
import { ProfileImport, ResumeUpload } from "./Uploaders";

// Drawings of LinkedIn's desktop profile page (not screenshots), so the steps stay readable and don't break when LinkedIn restyles.
const ring = "0 0 0 3px var(--fox)";
const Frame = ({ children }: { children: ReactNode }) => (
  <div className="li-shot" aria-hidden>
    <div className="li-bar"><i /><i /><i /><span>linkedin.com/in/you</span></div>
    <div className="li-body">{children}</div>
  </div>
);
const Profile = ({ resources = false }: { resources?: boolean }) => (
  <>
    <div className="li-cover" />
    <div className="li-avatar" />
    <div className="li-line" style={{ width: "46%", height: 10, background: "#8a96a3" }} />
    <div className="li-line" style={{ width: "64%" }} />
    <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "nowrap" }}>
      <span className="li-btn primary">Open to</span>
      <span className="li-btn">Add section</span>
      <span className="li-btn" style={resources ? { boxShadow: ring } : undefined}>Resources</span>
    </div>
  </>
);

const STEPS: { title: string; body: ReactNode; shot: ReactNode }[] = [
  {
    title: "Open your LinkedIn profile on a computer",
    body: <>Sign in to LinkedIn and click <b>Me → View profile</b>, or use the button below. The LinkedIn phone app doesn't have this option, so use a laptop or desktop.</>,
    shot: <Frame><Profile /></Frame>,
  },
  {
    title: "Click “Resources” under your name",
    body: <>It's in the row of buttons under your headline. On some profiles it's called <b>More</b>.</>,
    shot: <Frame><Profile resources /></Frame>,
  },
  {
    title: "Click “Save to PDF”",
    body: <>LinkedIn downloads a file called <b>Profile.pdf</b> to your computer, usually into Downloads.</>,
    shot: (
      <Frame>
        <Profile />
        <div className="li-menu">
          <span>Send profile in a message</span>
          <span style={{ boxShadow: ring, borderRadius: 6 }}><Download size={12} /> Save to PDF</span>
          <span>About this profile</span>
        </div>
      </Frame>
    ),
  },
];

/** The LinkedIn "connector": LinkedIn doesn't let apps read profiles, so the student exports a PDF and uploads it here. */
export function LinkedInGuide({ onDone }: { onDone: () => void }) {
  const { ws } = useStore();
  const w = ws!;
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack-lg" data-testid="linkedin-guide">
      <div className="stack-sm">
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", padding: 0 }} onClick={onDone} disabled={busy}><ArrowLeft size={14} /> Back to your accounts</button>
        <h2 className="conn-title">Add your LinkedIn</h2>
        <p className="muted small">LinkedIn doesn't let apps read profiles directly, so it takes three clicks on LinkedIn and one upload here. {w.resume ? "Remy adds anything that isn't on your resume as facts you approve on the next step." : "With no resume yet, Remy reads your LinkedIn profile as your resume."}</p>
      </div>
      <ol className="li-steps">
        {STEPS.map((s, i) => (
          <li key={i} className="li-step">
            <div className="stack-sm">
              <span className="eyebrow">Step {i + 1}</span>
              <b>{s.title}</b>
              <p className="small muted">{s.body}</p>
              {i === 0 && <a className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} href="https://www.linkedin.com/in/me/" target="_blank" rel="noreferrer">Open my LinkedIn profile <ExternalLink size={13} /></a>}
            </div>
            {s.shot}
          </li>
        ))}
        <li className="li-step">
          <div className="stack-sm">
            <span className="eyebrow">Step 4</span>
            <b>Upload Profile.pdf here</b>
            <p className="small muted">When it's read, you'll go back to your accounts.</p>
          </div>
          <div className="stack-sm">
            {w.resume
              ? <ProfileImport kind="LinkedIn profile (PDF)" hint="Choose Upload PDF and pick Profile.pdf." onBusy={setBusy} onDone={onDone} />
              : <ResumeUpload compact source="linkedin" onBusy={setBusy} onDone={onDone} />}
            <span className="xs muted"><FileText size={12} style={{ verticalAlign: -2 }} /> Only the PDF you upload is used. Remy never signs in to LinkedIn for you.</span>
          </div>
        </li>
      </ol>
      <div><button className="btn btn-ghost" onClick={onDone} disabled={busy}><Check size={16} /> Done, back to my accounts</button></div>
    </div>
  );
}
