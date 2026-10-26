import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Remy } from "../components/common";

const CONTACT = "remy.careercoach@gmail.com";
const UPDATED = "October 24, 2026";

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="stack-sm"><h2 style={{ fontSize: "1.15rem" }}>{title}</h2>{children}</section>
);

function Page({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <div className="ob">
      <div className="row-between" style={{ width: "100%", maxWidth: 740 }}>
        <a className="logo" href="#/"><Remy size={26} /><span>Remy<b>.</b></span></a>
        <nav className="row small"><a href="#/about">About</a><a href="#/policies">Policies</a></nav>
      </div>
      <article className="ob-card card card-pad stack-lg" style={{ lineHeight: 1.6 }}>
        <a className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", padding: 0 }} href="#/"><ArrowLeft size={14} /> Back to Remy</a>
        <div className="stack-sm"><h1 className="conn-title">{title}</h1><p className="muted">{lead}</p></div>
        {children}
        <p className="xs muted">Questions? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      </article>
    </div>
  );
}

export function About() {
  return (
    <Page title="About Remy" lead="Remy is a career coach for college students: it finds real openings that fit you and helps you apply honestly.">
      <Section title="Why we built it">
        <p>Most students, freshmen especially, don't know where to start: what to put on a resume, which openings fit, or who to talk to. Remy walks you through it, from your first resume to your first offer.</p>
      </Section>
      <Section title="What Remy does">
        <ul className="stack-sm" style={{ paddingLeft: 18 }}>
          <li><b>Reads your resume, or builds one with you.</b> No resume yet? Remy builds one from a few taps and short answers, using only what you say.</li>
          <li><b>Finds real openings.</b> Remy reads employers' own career sites and shows openings that fit your major, year and where you want to work.</li>
          <li><b>Tailors honestly.</b> Every suggested change is checked against your own resume. Remy never invents numbers, titles or experience.</li>
          <li><b>Connects you with alumni.</b> Verified TCU students can see TCU alumni who match their interests, and Remy helps write the first email. You approve every word and send it yourself.</li>
          <li><b>Keeps you on track.</b> A plan, deadlines, a calendar and an application tracker in one place.</li>
        </ul>
      </Section>
      <Section title="Our promises">
        <ul className="stack-sm" style={{ paddingLeft: 18 }}>
          <li>Remy only uses what you give it, and you can see and change all of it.</li>
          <li>Remy never asks for your passwords.</li>
          <li>Delete your account and everything that identifies you is deleted right away.</li>
        </ul>
      </Section>
      <Section title="Who we are">
        <p>Remy was started by five TCU students: Dilan Desman, Ashton Wisecarver, Lincoln Yoo, Demetre Dondoladze and Julio Renovato. It won first place at TCU Neeley's AI Forward competition in October 2026, and we've kept building it since.</p>
        <p className="small muted">Remy is a student project. It isn't run by or affiliated with TCU's administration.</p>
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
        <p>We may keep combined statistics that can't identify anyone (for example, how many students used the resume builder) to improve Remy.</p>
      </Section>
      <Section title="TCU alumni">
        <p>Alumni matches come from the TCU Neeley alumni networking list. They're shown only to students who've verified a TCU email, and an alum's email address is shown only when you choose to contact them. Please use it only to ask for career advice, never to spam or share the list.</p>
      </Section>
      <Section title="Where it's stored">
        <p>Your information is stored in a Supabase database and served from Render, both in the United States. Sign-in is handled by Supabase (with Google, LinkedIn or an email link) or Google. If you connect Google Calendar, Remy keeps an encrypted Google access key so it can update and delete its “Remy” calendar; disconnecting deletes the calendar and the key.</p>
      </Section>
      <Section title="Deleting your information">
        <p>Go to <b>Account → Account & data → Delete everything</b>. Your resume, files, profile, applications, calendar, contacts, chat, verified school email, sign-in record and account are deleted immediately, the “Remy” calendar is deleted from your Google Calendar if you connected it, and you're signed out. Remy keeps nothing that identifies you. Combined statistics, if any, can't be traced back to you.</p>
        <p>You can also <b>download all your data</b> from the same page at any time. Guest (demo) accounts are deleted automatically after 30 days without use. Copies in our hosting providers' routine backups expire on their own schedule.</p>
      </Section>

      <h2 className="eyebrow" style={{ marginTop: 12 }}>Terms of use</h2>
      <Section title="Using Remy">
        <ul className="stack-sm" style={{ paddingLeft: 18 }}>
          <li>Remy is for college students looking for internships, jobs and career advice. It's free while we're in early testing.</li>
          <li>Be honest. You're responsible for what you put on your resume and send to employers. Remy only suggests; you decide.</li>
          <li>Remy can be wrong. Check openings, deadlines and requirements with the employer before you apply. Remy can't promise any interview or job.</li>
          <li>Use alumni contacts respectfully: one thoughtful email, no spam, and never share their information.</li>
          <li>Don't misuse Remy: no fake accounts, no scraping, no trying to get around its limits or see other students' data. We may remove accounts that do.</li>
          <li>We may change Remy and these terms as it grows. If we make a big change to how your information is used, we'll tell you in the app.</li>
        </ul>
      </Section>
    </Page>
  );
}
