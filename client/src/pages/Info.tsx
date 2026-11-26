import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Remy } from "../components/common";
import { ThemeToggle } from "../components/ThemeToggle";
import { useOwnerView, useStore } from "../lib/store";
import { BETA_TERMS_LEAD, termsFor } from "@shared/beta";

const CONTACT = "hello@remyai.org";
const UPDATED = "November 26, 2026";

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="stack-sm info-sec" id={slug(title)}><h2 style={{ fontSize: "1.15rem" }}>{title}</h2>{children}</section>
);

/** Phones, signed out (Dilan, Nov 25): once you've scrolled a screen, "Create your account" stays at the bottom. */
export function SignupBar({ after = 500 }: { after?: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const f = () => setOn(window.scrollY > after);
    f(); window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, [after]);
  return (
    <div className={"signup-bar" + (on ? " on" : "")} aria-hidden={!on}>
      <a className="btn btn-primary" href="/signin" tabIndex={on ? 0 : -1} data-testid="button-signup-bar">Create your account</a>
      <a className="btn btn-secondary" href="/signin" tabIndex={on ? 0 : -1} data-testid="button-signup-bar-signin">Sign in</a>
    </div>
  );
}

// Nov 23 (Dilan: fix About for everyone): every visitor gets the full-width reading page.
const Page = DocPage;

/** Owners first (Dilan, Nov 22: these pages "look bad", one narrow card): a full-width reading page on the paper
 *  background, with a contents list beside the text on wide screens. Built from the page's own section headings. */
function DocPage({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  const body = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<{ id: string; text: string }[]>([]);
  const { me } = useStore();
  const inside = !!me; // signed in: "/" opens their Remy, not the homepage
  const about = title.startsWith("About");
  useEffect(() => { setToc([...(body.current?.querySelectorAll<HTMLElement>(".info-sec") || [])].map((el) => ({ id: el.id, text: el.querySelector("h2")?.textContent || "" }))); }, [title]);
  // Scroll-spy (Dilan, Nov 24): the contents list marks the section you're reading; at the bottom, the last one.
  const [at, setAt] = useState("");
  useEffect(() => {
    const secs = [...(body.current?.querySelectorAll<HTMLElement>(".info-sec") || [])];
    const spy = () => {
      const end = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const cur = end ? secs[secs.length - 1] : secs.filter((el) => el.getBoundingClientRect().top <= 120).pop() || secs[0];
      setAt(cur?.id || "");
    };
    spy();
    window.addEventListener("scroll", spy, { passive: true });
    return () => window.removeEventListener("scroll", spy);
  }, [title]);
  // Phones: the jump row is one sideways strip, so it slides to keep the section you're reading in view (Dilan, Nov 25).
  const tocRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = tocRef.current, a = nav?.querySelector<HTMLElement>('a[aria-current="location"]');
    if (nav && a && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - 16, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [at]);
  return (
    <div className="doc">
      {/* One header for everyone (Dilan, Nov 24): back to wherever you came from, and the other page one tap away. */}
      <header className="doc-top">
        <a className="logo" href="/"><Remy size={26} /><span>Remy<b>.</b></span></a>
        <nav className="row small">
          {about ? <a className="doc-pill" href="/policies" data-testid="link-doc-privacy">Privacy & terms</a> : <a className="doc-pill" href="/about" data-testid="link-doc-about">About Remy</a>}
          <ThemeToggle />
          <a className="doc-back" href="/" data-testid="link-back-to-remy"><ArrowLeft size={14} /> <span>{inside ? "Back to Remy" : "Back to homepage"}</span></a>
        </nav>
      </header>
      <div className="doc-head"><h1>{title}</h1><p>{lead}</p></div>
      <div className="doc-grid">
        {toc.length > 2 && <nav ref={tocRef} className="doc-toc" aria-label="On this page"><b>On this page</b>{toc.map((t) => <a key={t.id} href={`#${t.id}`} aria-current={t.id === at ? "location" : undefined} data-testid={`link-toc-${t.id}`}>{t.text}</a>)}</nav>}
        <article className="doc-body" ref={body}>
          {children}
          <p className="xs muted">Questions? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
        </article>
      </div>
      {!inside && <SignupBar />}
    </div>
  );
}

// Photos go in client/public/team/ (e.g. "/team/dilan.jpg"); until then each shows initials.
// Work emails are each person's own @remyai.org address (Zoho); admin@ and hello@ are the shared company inbox.
export const TEAM: { name: string; role: string; photo: string; email?: string; owners?: true }[] = [
  { name: "Dilan Desman", role: "Co-founder & CEO", photo: "/team/dilan.jpg", email: "d.desman@remyai.org" },
  { name: "Ashton Wisecarver", role: "Brand, marketing & finance", photo: "", owners: true },
  { name: "Lincoln Yoo", role: "Co-founder & COO", photo: "/team/lincoln.jpg", email: "l.yoo@remyai.org" },
  { name: "Demetre Dondoladze", role: "Data & databases", photo: "/team/demetre.jpg", email: "d.dondoladze@remyai.org", owners: true },
  { name: "Julio Renovato", role: "Research & analytics", photo: "", email: "j.renovato@remyai.org", owners: true },
];
// Team meeting (Dilan, Nov 24): Ashton (for now), Demetre and Julio (work authorization, until the lawyer meeting) show only in owner view.
export const useTeam = () => { const owner = useOwnerView(); return TEAM.filter((m) => owner || !m.owners); };

export function About() {
  const config = useStore()?.config;
  const team = useTeam();
  return (
    <Page title="About Remy" lead={`Remy is an AI career coach for college students: he maps out your path, finds real openings that fit you and helps you apply honestly. ${config?.beta?.open ? "Remy is free during beta, and anyone can sign up and start right away." : "Remy is free during beta, and invite-only for now."}`}>
      <Section title="Why we built it">
        <p>Most students, freshmen especially, don't know where to start: what to put on a resume, which openings fit, or who to talk to. Remy walks you through it, from your first resume to your first offer.</p>
      </Section>
      <Section title="What Remy does">
        <ul className="stack-sm" style={{ paddingLeft: 18 }}>
          <li><b>Shows you the road ahead.</b> My Path maps your field year by year: the roles, skills and exams that matter, when internship season opens, and a short daily round of real steps. Remy works on it with you from his office.</li>
          <li><b>Reads your resume, or builds one with you.</b> No resume yet? Remy builds one from a few taps and short answers, using only what you say.</li>
          <li><b>Fixes your resume himself, honestly.</b> Remy rewrites weak lines using facts already on your resume and shows each one next to the original, for you to accept, edit or skip. If a fact is missing, he asks you. He never invents numbers, titles or experience.</li>
          <li><b>Finds real openings.</b> Remy reads employers' own career sites and shows openings that fit your major, year and where you want to work, and says whether you qualify and why.</li>
          <li><b>Does things for you, and shows you what he did.</b> Ask Remy in chat to add a to-do, save an opening or update your plan, and he does it. Every action is listed so you can undo it. He also reaches out first with reminders and what to do next.</li>
          <li><b>Helps you reach out.</b> Remy helps write the first email to people you've met. You approve every word and send it yourself from your own email.</li>
          <li><b>Keeps you on track, and makes it fun.</b> A plan, deadlines, a calendar and an application tracker in one place. Rewards add XP, a streak, pins to collect and items for Remy's office as you make progress.</li>
          <li><b>Coming soon:</b> interview practice built from real postings, and Community for alumni connections.</li>
        </ul>
      </Section>
      <Section title="Our promises">
        <ul className="stack-sm" style={{ paddingLeft: 18 }}>
          <li>Remy only uses what you give it, and you can see and change all of it, including what he remembers about you.</li>
          <li>Remy never applies, emails or sends anything for you.</li>
          <li>Remy never asks for your passwords.</li>
          <li>Delete your account and everything that identifies you is deleted right away.</li>
          <li>Remy never records your screen or what you type to learn how it's used: when something breaks, it reports only what failed and where.</li>
        </ul>
      </Section>
      <Section title="Beta Insiders">
        <p>Remy is free during beta. After you've used Remy on a few different days, you can join Beta Insiders: a secret pin, and a three-question check-in every two weeks that shapes what we build next. Everyone who signed up as a beta tester before sign-ups opened is already an Insider.</p>
      </Section>
      <Section title="Who we are">
        <p>Remy is made by RemyAI LLC, a company in Fort Worth, Texas. We started building it in October 2026 and ship improvements every week.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))", gap: 12 }}>
          {team.map((m) => (
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
  const config = useStore()?.config;
  return (
    <Page title="Privacy & terms" lead={`How Remy handles your information, and the rules for using it. Last updated ${UPDATED}.`}>
      <Section title="What Remy collects">
        <ul className="stack-sm" style={{ paddingLeft: 18 }}>
          <li><b>From signing in:</b> your name, email address and profile photo.</li>
          <li><b>What you give Remy:</b> your resume (the file and its text), a LinkedIn profile PDF if you upload one, your answers in setup and the resume builder, anything you paste in from Handshake, your degree plan or an employer's email, your preferences and settings (like light or dark mode), saved openings, applications, tracker, calendar items, contacts you add, email drafts and chat messages.</li>
          <li><b>What Remy remembers about you:</b> short facts he learns from your resume, setup and chats (like your goals or where you want to work). New ones wait for your OK, and you can edit or delete any of them in Account → AI memory.</li>
          <li><b>What Remy does for you:</b> a list of the actions he takes in your account when you ask (like saving an opening or adding a to-do), so you can see and undo them.</li>
          <li><b>Your progress and rewards:</b> your daily round, streak, XP, level, pins and the items in Remy's office.</li>
          <li><b>Your school email</b>, if you verify it (for example name@tcu.edu), so Remy knows you're a student there.</li>
          <li><b>Beta Insider answers</b>, if you join: your short answers when you join (what you're looking for, where you're stuck, the tools you use and how you heard about Remy) and your answers to the check-in every two weeks. If you applied to be a beta tester before sign-ups opened, we also keep the answers from that Google Form (name, school, sign-in email, major, class year and the same questions). Google Forms' own privacy policy applies to the form itself.</li>
          <li><b>Your ratings and feedback:</b> “More like this” / “Not for me” on openings, one-tap 👍 / 👎, anything you send with Send feedback, and your one-tap answers to Remy's questions after something happens (like how an interview went).</li>
          <li><b>Automatic problem reports:</b> when something breaks for you (a page error, or a request that fails or is very slow), your browser tells Remy which page and what failed, linked to your account so we can fix it. Remy also counts which pages are opened and when a button is clicked over and over (a sign it's broken), without your name. To see where Remy is confusing, Remy uses PostHog, an analytics provider in the United States. It records which pages you open, what you click, errors you hit, and how long Remy's AI answers take and what they cost (never what they say), linked to your account. On some visits it also records a replay of the page. In those replays all text and everything you type are hidden, so your resume, messages, name and email are never recorded. The Remy team doesn't appear in these recordings.</li>
          <li><b>Your work authorization</b>, only if you choose to answer (it's optional, and you can pick “Rather not say”). Remy uses it only to skip openings you can't take, and you can still open those.</li>
          <li><b>Your phone number</b>, saved only when you turn on texts for urgent deadlines in Account. If you turn texts off, the number stays until you remove it or delete your account.</li>
          <li><b>That you agreed to the beta terms</b>, with the version and the time.</li>
          <li><b>A sign-in cookie</b> that keeps you signed in. Remy uses your network address to stop abuse (like too many requests at once). It keeps only a scrambled code made from it, never the address itself, and deletes that within about two hours. Our hosting providers (Cloudflare and Render) see the address too and may keep it briefly in their own logs.</li>
        </ul>
      </Section>
      <Section title="What Remy doesn't do">
        <ul className="stack-sm" style={{ paddingLeft: 18 }}>
          <li>Remy never asks for or stores your passwords.</li>
          <li>Remy doesn't read your email, calendar, LinkedIn, Handshake or school accounts. It only uses the files and text you choose to give it.</li>
          <li>If you connect Google Calendar, Remy creates one separate calendar called “Remy” and only ever touches that one. It can't see your other calendars or events. Remy's use of information received from Google APIs follows the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including its Limited Use requirements.</li>
          <li>Remy doesn't sell your information or show you ads.</li>
          <li>Remy uses no advertising trackers. Its only analytics tool is PostHog (described above), which Remy uses only to improve Remy. It doesn't let other companies follow what you do across websites. Remy also turns analytics off if your browser sends a “Do Not Track” signal.</li>
        </ul>
      </Section>
      <Section title="How your information is used">
        <p>Only to run Remy for you: building your profile, finding openings that fit, tailoring applications, drafting emails, and planning your next steps.</p>
        <p>Some of this uses AI. When it does, Remy sends only the text that task needs (for example, your resume and a job posting) to an AI provider through OpenRouter: currently Anthropic's Claude models (run on Amazon Bedrock), with Google's Gemini or OpenAI's models as a backup when Claude is unavailable. For writing other people will read, like an email to a contact or your pitch, Remy leaves out your GPA, work authorization, worries and limits. Remy turns on OpenRouter's zero-data-retention setting, so requests go only to providers that say they don't keep your text after answering or train on it. Those providers' and OpenRouter's own terms and privacy policies apply. Remy checks what the AI writes against your own words before showing it to you.</p>
        <p>If you practice an interview answer out loud, your browser's own speech recognition turns your voice into text (in Chrome, Google handles this). Remy receives only the text, never a recording.</p>
        <p>Some of Remy's work happens while you're away. About once a day he looks for new openings that fit your profile, every few days he checks whether your saved openings are still open, and he sends the reminders you've turned on. This uses your saved preferences inside Remy; it doesn't send anything for you or share your information with employers.</p>
        <p>Remy emails you 6-digit sign-in codes and, unless you turn them off in Account → Appearance & alerts, deadline reminders and a weekly digest, from remy@mail.remyai.org. These emails are sent through our email provider, Resend (with a Gmail account as a backup only if Resend fails), and replies go to hello@remyai.org. If you turn on deadline texts, they're sent through our text provider, Twilio.</p>
        <p>The team's dashboard mostly shows counts across students (for example, how many applications got an answer, or how many students opened a page). To answer you and fix problems, Remy's owners (the founders who run it) can also read what you send them: feedback with your email and any screenshot you attach, problem reports linked to your account, and, if you join Beta Insider, your join and check-in answers with your name, email, school and how many days you've used Remy. The dashboard doesn't show your resume, chats, applications or AI memory. We may keep combined statistics that can't identify anyone to improve Remy.</p>
      </Section>
      <Section title="Where it's stored">
        <p>Your information is stored in a DigitalOcean database and served from DigitalOcean, both in the United States. To keep Remy fast, the server also keeps an encrypted copy of your workspace in a private Cloudflare storage bucket in the United States; it is locked with a key only Remy's server holds, so Cloudflare can't read it, and it is deleted when you delete your account. Visits to remyai.org pass through Cloudflare's network, which protects the site and keeps it fast, and Cloudflare also starts Remy's hourly background jobs. The site's fonts and company logos load from Google, so Google sees your network address when they load, as with most websites. Sign-in is with Google or Remy's own emailed 6-digit code. Public job postings Remy finds are kept in one shared list with no student information. If you connect Google Calendar, Remy keeps an encrypted Google access key so it can update and delete its “Remy” calendar; disconnecting deletes the calendar and the key.</p>
      </Section>
      <Section title="Deleting your information">
        <p>Go to <b>Account → Account & data → Delete everything</b>. Your resume, files, profile, applications, calendar, contacts, chat, AI memory, rewards and progress, ratings, feedback and problem reports, Beta Insider answers, verified school email, beta tester application, sign-in record and account are deleted from Remy's database immediately, the “Remy” calendar is deleted from your Google Calendar if you connected it, and you're signed out. Remy's encrypted nightly backups (in the same private Cloudflare storage) still hold a copy until they expire: daily copies after 31 days, weekly copies after 8 weeks. To make sure a restored backup can't bring your account back, Remy keeps a scrambled code made from your account's internal id (not your name or email) for 70 days, and deletes your account again if a backup is ever restored. Combined statistics, if any, can't be traced back to you.</p>
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
          <li>Remy is for college students looking for internships, jobs and career advice. It's free during beta{config?.beta?.open ? ", and anyone can sign up." : ", and invite-only: sign in with the same email you applied with."}</li>
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
