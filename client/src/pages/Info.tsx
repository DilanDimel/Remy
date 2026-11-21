import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Remy } from "../components/common";
import { ThemeToggle } from "../components/ThemeToggle";
import { BETA_TERMS, BETA_TERMS_LEAD } from "@shared/beta";

const CONTACT = "hello@remyai.org";
const UPDATED = "November 21, 2026";

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="stack-sm"><h2 style={{ fontSize: "1.15rem" }}>{title}</h2>{children}</section>
);

function Page({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <div className="ob">
      <div className="row-between" style={{ width: "100%", maxWidth: 740 }}>
        <a className="logo" href="/"><Remy size={26} /><span>Remy<b>.</b></span></a>
        <nav className="row small"><a href="/about">About</a><a href="/policies">Policies</a><ThemeToggle /></nav>
      </div>
      <article className="ob-card card card-pad stack-lg" style={{ lineHeight: 1.6 }}>
        <a className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", padding: 0 }} href="/"><ArrowLeft size={14} /> Back to Remy</a>
        <div className="stack-sm"><h1 className="conn-title">{title}</h1><p className="muted">{lead}</p></div>
        {children}
        <p className="xs muted">Questions? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      </article>
    </div>
  );
}

// Photos go in client/public/team/ (e.g. "/team/dilan.jpg"); until then each shows initials.
const TEAM: { name: string; role: string; photo: string }[] = [
  { name: "Dilan Desman", role: "Technology lead", photo: "/team/dilan.jpg" },
  { name: "Ashton Wisecarver", role: "Brand, marketing & finance", photo: "" },
  { name: "Lincoln Yoo", role: "Operations & partnerships", photo: "/team/lincoln.jpg" },
  { name: "Demetre Dondoladze", role: "Data & databases", photo: "/team/demetre.jpg" },
  { name: "Julio Renovato", role: "Research & analytics", photo: "" },
];

export function About() {
  return (
    <Page title="About Remy" lead="Remy is a career coach for college students: it finds real openings that fit you and helps you apply honestly. During the beta it's invite-only: apply to be a beta tester on the homepage.">
      <Section title="Why we built it">
        <p>Most students, freshmen especially, don't know where to start: what to put on a resume, which openings fit, or who to talk to. Remy walks you through it, from your first resume to your first offer.</p>
      </Section>
      <Section title="What Remy does">
        <ul className="stack-sm" style={{ paddingLeft: 18 }}>
          <li><b>Reads your resume, or builds one with you.</b> No resume yet? Remy builds one from a few taps and short answers, using only what you say.</li>
          <li><b>Finds real openings.</b> Remy reads employers' own career sites and shows openings that fit your major, year and where you want to work.</li>
          <li><b>Tailors honestly.</b> Every suggested change is checked against your own resume. Remy never invents numbers, titles or experience.</li>
          <li><b>Helps you reach out.</b> Remy helps write the first email to people you've met. You approve every word and send it yourself. Alumni matching is coming soon.</li>
          <li><b>Keeps you on track.</b> A plan, deadlines, a calendar and an application tracker in one place, and it shows how many of your applications got an answer, so you can see what works.</li>
        </ul>
      </Section>
      <Section title="Our promises">
        <ul className="stack-sm" style={{ paddingLeft: 18 }}>
          <li>Remy only uses what you give it, and you can see and change all of it.</li>
          <li>Remy never asks for your passwords.</li>
          <li>Delete your account and everything that identifies you is deleted right away.</li>
          <li>Remy never records your screen or what you type to learn how it's used: when something breaks, it reports only what failed and where.</li>
        </ul>
      </Section>
      <Section title="Who we are">
        <p>Remy is a career coach for college students, built by a small team in Fort Worth, Texas. We started it in October 2026 and ship improvements every week.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 12 }}>
          {TEAM.map((m) => (
            <figure key={m.name} className="stack-sm" style={{ margin: 0, alignItems: "center", textAlign: "center" }}>
              {m.photo
                ? <img src={m.photo} alt={m.name} width={96} height={96} style={{ borderRadius: "50%", objectFit: "cover" }} />
                : <div aria-hidden style={{ width: 96, height: 96, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--fox-soft)", color: "var(--fox)", fontWeight: 800, fontSize: 28 }}>{m.name.split(" ").map((w) => w[0]).join("")}</div>}
              <figcaption className="stack-sm" style={{ gap: 2 }}><b>{m.name}</b><span className="xs muted">{m.role}</span></figcaption>
            </figure>
          ))}
        </div>
        <p className="small muted">Remy is an independent company. It isn't run by or affiliated with TCU or any other university.</p>
      </Section>
    </Page>
  );
}

export function Policies() {
  return (
    <Page title="Privacy & terms" lead={`How Remy handles your information, and the rules for using it. Last updated ${UPDATED}.`}>
      <h2 className="eyebrow">Privacy policy</h2>
      <Section title="What Remy collects">
        <ul className="stack-sm" style={{ paddingLeft: 18 }}>
          <li><b>From signing in:</b> your name, email address and profile photo.</li>
          <li><b>What you give Remy:</b> your resume (the file and its text), a LinkedIn profile PDF if you upload one, your answers in setup and the resume builder, your preferences, saved openings, applications, tracker, calendar items, contacts you add, email drafts and chat messages.</li>
          <li><b>Your school email</b>, if you verify it (for example name@tcu.edu), so Remy knows you're a student there.</li>
          <li><b>Your beta tester application</b>, if you apply with our Google Form: your name, school, the email you'll sign in with, major, class year, what you're looking for, where you're stuck, the tools you use, whether you'll give weekly feedback and how you heard about Remy. The team uses it to choose who joins the beta. Google Forms' own privacy policy applies to the form itself.</li>
          <li><b>Your ratings and feedback:</b> “More like this” / “Not for me” on openings, one-tap 👍 / 👎, anything you send with Send feedback, and your one-tap answers to Remy's questions after something happens (like how an interview went).</li>
          <li><b>Automatic problem reports:</b> when something breaks for you (a page error, or a request that fails or is very slow), your browser tells Remy which page and what failed, linked to your account so we can fix it. Remy also counts which pages are opened and when a button is clicked over and over (a sign it's broken), without your name. Remy never records your screen or what you type.</li>
          <li><b>A sign-in cookie</b> that keeps you signed in. Remy uses your network address briefly to stop abuse (like too many requests at once) and doesn't store it.</li>
        </ul>
      </Section>
      <Section title="What Remy doesn't do">
        <ul className="stack-sm" style={{ paddingLeft: 18 }}>
          <li>Remy never asks for or stores your passwords.</li>
          <li>Remy doesn't read your email, calendar, LinkedIn, Handshake or school accounts. It only uses the files and text you choose to give it.</li>
          <li>If you connect Google Calendar, Remy creates one separate calendar called “Remy” and only ever touches that one. It can't see your other calendars or events.</li>
          <li>Remy doesn't sell your information or show you ads.</li>
        </ul>
      </Section>
      <Section title="How your information is used">
        <p>Only to run Remy for you: building your profile, finding openings that fit, tailoring applications, drafting emails, and planning your next steps.</p>
        <p>Some of this uses AI. When it does, Remy sends only the text that task needs (for example, your resume and a job posting) to an AI provider (currently Google's Gemini models, through OpenRouter), and those providers' own privacy policies apply. Remy checks what the AI writes against your own words before showing it to you.</p>
        <p>Remy emails you 6-digit sign-in codes and, unless you turn them off in Account → Appearance & alerts, deadline reminders and a weekly digest, from remy.careercoach@gmail.com. If you're accepted as a beta tester, the team sends you a welcome email with how to sign in.</p>
        <p>The team's dashboard shows counts across students (for example, how many applications got an answer, or how many students opened a page), never what you wrote. We may keep combined statistics that can't identify anyone to improve Remy.</p>
      </Section>
      <Section title="Where it's stored">
        <p>Your information is stored in a Supabase database and served from Render, both in the United States. Sign-in is handled by Supabase (with Google or LinkedIn), Google, or Remy's own emailed 6-digit code. Public job postings Remy finds are kept in one shared list with no student information. If you connect Google Calendar, Remy keeps an encrypted Google access key so it can update and delete its “Remy” calendar; disconnecting deletes the calendar and the key.</p>
      </Section>
      <Section title="Deleting your information">
        <p>Go to <b>Account → Account & data → Delete everything</b>. Your resume, files, profile, applications, calendar, contacts, chat, ratings, feedback and problem reports, verified school email, beta tester application, sign-in record and account are deleted immediately, the “Remy” calendar is deleted from your Google Calendar if you connected it, and you're signed out. Remy keeps nothing that identifies you. Combined statistics, if any, can't be traced back to you.</p>
        <p>You can also <b>download all your data</b> from the same page at any time: your account, workspace, uploaded files, feedback and problem reports, AI use, beta application and whether Google Calendar is connected. Left out on purpose: sign-in secrets (sign-in codes and the Google Calendar key) and the team's internal notes on beta applications. Guest (demo) accounts are deleted automatically after 30 days without use. Applications the team declines are deleted after their cohort closes. Copies in our hosting providers' routine backups expire on their own schedule.</p>
      </Section>

      <h2 className="eyebrow" style={{ marginTop: 12 }}>Terms of use</h2>
      <Section title="Remy is in beta">
        <p id="beta-terms">{BETA_TERMS_LEAD}</p>
        <ul className="stack-sm" style={{ paddingLeft: 18 }}>{BETA_TERMS.map((t) => <li key={t}>{t}</li>)}</ul>
      </Section>
      <Section title="Using Remy">
        <ul className="stack-sm" style={{ paddingLeft: 18 }}>
          <li>Remy is for college students looking for internships, jobs and career advice. It's free while we're in early testing, and invite-only: sign in with the same email you applied with.</li>
          <li>Be honest. You're responsible for what you put on your resume and send to employers. Remy only suggests; you decide.</li>
          <li>Remy can be wrong. Check openings, deadlines and requirements with the employer before you apply. Remy can't promise any interview or job.</li>
          <li>Use contacts respectfully: one thoughtful email, no spam, and never share someone's information.</li>
          <li>Don't misuse Remy: no fake accounts, no scraping, no trying to get around its limits or see other students' data. We may remove accounts that do.</li>
          <li>We may change Remy and these terms as it grows. If we make a big change to how your information is used, we'll tell you in the app.</li>
        </ul>
      </Section>
    </Page>
  );
}
