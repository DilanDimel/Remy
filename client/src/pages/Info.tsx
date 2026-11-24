import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Remy } from "../components/common";
import { ThemeToggle } from "../components/ThemeToggle";
import { useOwnerView, useStore } from "../lib/store";
import { Top } from "./Landing2";
import { BETA_TERMS_LEAD, termsFor } from "@shared/beta";

const CONTACT = "hello@remyai.org";
const UPDATED = "November 23, 2026";

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="stack-sm info-sec" id={slug(title)}><h2 style={{ fontSize: "1.15rem" }}>{title}</h2>{children}</section>
);

// Nov 23 (Dilan: fix About for everyone): every visitor gets the full-width reading page.
const Page = DocPage;

/** Owners first (Dilan, Nov 22: these pages "look bad", one narrow card): a full-width reading page on the paper
 *  background, with a contents list beside the text on wide screens. Built from the page's own section headings. */
function DocPage({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  const body = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<{ id: string; text: string }[]>([]);
  const owner = useOwnerView();
  const { me, ws } = useStore();
  useEffect(() => { setToc([...(body.current?.querySelectorAll<HTMLElement>(".info-sec") || [])].map((el) => ({ id: el.id, text: el.querySelector("h2")?.textContent || "" }))); }, [title]);
  return (
    <div className="doc">
      {owner ? <Top inside={!!(me && ws?.started)} what="/welcome#what" /> : (
      <header className="doc-top">
        <a className="logo" href="/"><Remy size={26} /><span>Remy<b>.</b></span></a>
        <nav className="row small"><a href="/" data-testid="link-back-to-remy"><ArrowLeft size={14} /> Back to Remy</a><a href="/about" aria-current={title.startsWith("About") ? "page" : undefined}>About</a><a href="/policies" aria-current={title.startsWith("About") ? undefined : "page"}>Privacy & terms</a><ThemeToggle /></nav>
      </header>
      )}
      <div className="doc-head"><h1>{title}</h1><p>{lead}</p></div>
      <div className="doc-grid">
        {toc.length > 2 && <nav className="doc-toc" aria-label="On this page"><b>On this page</b>{toc.map((t) => <a key={t.id} href={`#${t.id}`}>{t.text}</a>)}</nav>}
        <article className="doc-body" ref={body}>
          {children}
          <p className="xs muted">Questions? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
        </article>
      </div>
    </div>
  );
}

// Photos go in client/public/team/ (e.g. "/team/dilan.jpg"); until then each shows initials.
// Work emails are each person's own @remyai.org address (Zoho); admin@ and hello@ are the shared company inbox.
export const TEAM: { name: string; role: string; photo: string; email?: string }[] = [
  { name: "Dilan Desman", role: "Technology lead", photo: "/team/dilan.jpg", email: "d.desman@remyai.org" },
  { name: "Ashton Wisecarver", role: "Brand, marketing & finance", photo: "" },
  { name: "Lincoln Yoo", role: "Operations & partnerships", photo: "/team/lincoln.jpg", email: "l.yoo@remyai.org" },
  { name: "Demetre Dondoladze", role: "Data & databases", photo: "/team/demetre.jpg", email: "d.dondoladze@remyai.org" },
  { name: "Julio Renovato", role: "Research & analytics", photo: "", email: "j.renovato@remyai.org" },
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))", gap: 12 }}>
          {TEAM.map((m) => (
            <figure key={m.name} className="stack-sm" style={{ margin: 0, alignItems: "center", textAlign: "center" }}>
              {m.photo
                ? <img src={m.photo} alt={m.name} width={96} height={96} style={{ borderRadius: "50%", objectFit: "cover" }} />
                : <div aria-hidden style={{ width: 96, height: 96, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--fox-soft)", color: "var(--fox)", fontWeight: 800, fontSize: 28 }}>{m.name.split(" ").map((w) => w[0]).join("")}</div>}
              <figcaption className="stack-sm" style={{ gap: 2 }}><b>{m.name}</b><span className="xs muted">{m.role}</span>{m.email && <a className="xs" href={`mailto:${m.email}`} title={m.email}>Email {m.name.split(" ")[0]}</a>}</figcaption>
            </figure>
          ))}
        </div>
      </Section>
    </Page>
  );
}

export function Policies() {
  const { config } = useStore();
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
          <li><b>Your phone number</b>, only if you turn on texts for urgent deadlines in Account. You can turn them off or remove the number at any time.</li>
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
        <p>Some of this uses AI. When it does, Remy sends only the text that task needs (for example, your resume and a job posting) to an AI provider, either directly or through OpenRouter: currently Google's Gemini models, and for the team's own test accounts Anthropic's Claude models. Those providers' own privacy policies apply. Remy checks what the AI writes against your own words before showing it to you.</p>
        <p>If you practice an interview answer out loud, your browser's own speech recognition turns your voice into text (in Chrome, Google handles this). Remy receives only the text, never a recording.</p>
        <p>Remy emails you 6-digit sign-in codes and, unless you turn them off in Account → Appearance & alerts, deadline reminders and a weekly digest, from remy@mail.remyai.org. These emails are sent through our email provider, Resend (with a Gmail account as a backup only if Resend fails), and replies go to hello@remyai.org. If you turn on deadline texts, they're sent through our text provider, Twilio. If you're accepted as a beta tester, the team sends you a welcome email with how to sign in.</p>
        <p>The team's dashboard shows counts across students (for example, how many applications got an answer, or how many students opened a page), never what you wrote. We may keep combined statistics that can't identify anyone to improve Remy.</p>
      </Section>
      <Section title="Where it's stored">
        <p>Your information is stored in a Supabase database and served from Render, both in the United States. Sign-in is handled by Supabase (with Google or LinkedIn), Google, or Remy's own emailed 6-digit code. Public job postings Remy finds are kept in one shared list with no student information. If you connect Google Calendar, Remy keeps an encrypted Google access key so it can update and delete its “Remy” calendar; disconnecting deletes the calendar and the key.</p>
      </Section>
      <Section title="Deleting your information">
        <p>Go to <b>Account → Account & data → Delete everything</b>. Your resume, files, profile, applications, calendar, contacts, chat, ratings, feedback and problem reports, verified school email, beta tester application, sign-in record and account are deleted immediately, the “Remy” calendar is deleted from your Google Calendar if you connected it, and you're signed out. Remy keeps nothing that identifies you. Combined statistics, if any, can't be traced back to you.</p>
        <p>You can also <b>download all your data</b> from the same page at any time: your account, workspace, uploaded files, feedback and problem reports, AI use, beta application and whether Google Calendar is connected. Left out on purpose: sign-in secrets (sign-in codes and the Google Calendar key) and the team's internal notes on beta applications. Guest (demo) accounts are deleted automatically after 30 days without use. Applications the team declines are deleted after their cohort closes. Copies in our hosting providers' routine backups expire on their own schedule.</p>
      </Section>

      <Section title="Keeping it safe">
        <p>Remy only talks to your browser over encrypted connections (HTTPS), and only the Remy team and our hosting providers can reach the database. No system is perfectly secure. If a breach ever affects your information, we'll tell you as the law requires.</p>
      </Section>
      <Section title="Age">
        <p>Remy is for college students and isn't meant for anyone under 16. If we learn that someone under 13 gave us information, we'll delete it.</p>
      </Section>
      <Section title="Questions and requests">
        <p>Remy is run by RemyAI LLC in Fort Worth, Texas. To ask what we hold about you, fix something, or have it deleted, use the tools in Account or email <a href="mailto:hello@remyai.org">hello@remyai.org</a>. We answer within 30 days. If we change this policy, we'll update the date at the top, and we'll tell you in the app before a big change to how your information is used.</p>
      </Section>

      <h2 className="eyebrow" style={{ marginTop: 12 }}>Terms of use</h2>
      <Section title="Remy is in beta">
        <p id="beta-terms">{BETA_TERMS_LEAD}</p>
        <ul className="stack-sm" style={{ paddingLeft: 18 }}>{termsFor(config?.beta?.open).terms.map((t) => <li key={t}>{t}</li>)}</ul>
      </Section>
      <Section title="Using Remy">
        <ul className="stack-sm" style={{ paddingLeft: 18 }}>
          <li>Remy is for college students looking for internships, jobs and career advice. It's free during beta, and invite-only: sign in with the same email you applied with.</li>
          <li>Be honest. You're responsible for what you put on your resume and send to employers. Remy only suggests; you decide.</li>
          <li>Remy can be wrong. Check openings, deadlines and requirements with the employer before you apply. Remy can't promise any interview or job.</li>
          <li>Use contacts respectfully: one thoughtful email, no spam, and never share someone's information.</li>
          <li>Don't misuse Remy: no fake accounts, no scraping, no trying to get around its limits or see other students' data. We may remove accounts that do.</li>
          <li>You can stop using Remy and delete your account at any time from Account → Account & data.</li>
          <li>We may change Remy and these terms as it grows. If we make a big change to how your information is used, we'll tell you in the app.</li>
          <li>Remy is run by RemyAI LLC, a Texas company. Texas law governs these terms. Questions: <a href="mailto:hello@remyai.org">hello@remyai.org</a>.</li>
        </ul>
      </Section>
    </Page>
  );
}
