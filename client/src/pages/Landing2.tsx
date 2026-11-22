import { useStore } from "../lib/store";
import { BetaBadge, Remy } from "../components/common";
import { TEAM } from "./Info";
import { LinkedInMark, applyHref } from "./Welcome";

export const INSTAGRAM = "https://www.instagram.com/coachremyai/";
export const LINKEDIN = "https://www.linkedin.com/company/remyai-org/";

function InstagramMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** The simpler front page (preview at /?v=new until it replaces Landing after Dec 1): one message, the real app, the real team, our socials. */
export default function Landing2() {
  const { config, me, ws } = useStore();
  const inside = !!(me && ws?.started);
  const beta = !!config?.beta?.on && !inside;
  const start = inside ? "/" : beta ? applyHref(config?.beta?.formUrl) : "/signin";
  const startLabel = inside ? "Open my Remy" : beta ? "Apply to be a beta tester" : "Create your free account";
  const ext = beta ? { target: "_blank", rel: "noreferrer" } : {};
  const out = { target: "_blank", rel: "noreferrer" };
  return (
    <div className="lp2">
      <div className="lp2-w">
        <header className="lp2-top">
          <a className="logo" href="/" aria-label="Remy home"><Remy size={28} mood="idle" /> Remy <BetaBadge /></a>
          <nav className="lp2-nav" aria-label="Main">
            <a className="hide-sm" href="#what">What Remy does</a>
            <a className="hide-sm" href="/about">About</a>
            <a className="lp2-btn lp2-btn-sm" href={inside ? "/" : "/signin"} data-testid="button-lp-signin">{inside ? "Open my Remy" : "Sign in"}</a>
          </nav>
        </header>

        <main>
          <section className="lp2-hero">
            <p className="lp2-pre">Free for college students, now in beta</p>
            <h1>Don&rsquo;t hunt for a job alone.</h1>
            <p className="lp2-lede">Remy finds openings you can actually get, keeps your resume honest, and tells you what to do this week.</p>
            <div className="lp2-ctas">
              <a className="lp2-btn lp2-btn-lg" href={start} {...ext} data-testid="button-lp-start">{startLabel}</a>
              {!inside && <a className="lp2-link" href="/signin">{beta ? "Already in? Sign in" : "I have an account"}</a>}
            </div>
            <div className="lp2-shot">
              <img src="/landing/home.png" width={864} height={540} alt="Remy's Home screen: one next step, this week's to-dos and openings that fit" />
            </div>
          </section>
        </main>
      </div>

      <section className="lp2-sec" id="what" aria-labelledby="what-h">
        <div className="lp2-w">
          <h2 id="what-h">What Remy does</h2>
          <div className="lp2-three">
            <div><h3>Openings you can actually get</h3><p>Remy reads 180+ employers&rsquo; own career sites and hides postings you can&rsquo;t apply to. Every opening says why it fits you.</p></div>
            <div><h3>A resume that stays true</h3><p>Suggestions for each job, line by line. Anything your resume can&rsquo;t back up gets flagged. You approve every word.</p></div>
            <div><h3>One next step, every week</h3><p>Deadlines become dated to-dos, in your Google Calendar if you like. Not sure what you want yet? Remy starts there.</p></div>
          </div>
          <p className="lp2-never">Remy never makes up experience, applies or messages anyone for you, or sells your data.</p>
        </div>
      </section>

      <section className="lp2-sec" aria-labelledby="team-h">
        <div className="lp2-w">
          <div className="lp2-row">
            <div><h2 id="team-h">The people behind Remy</h2><p>A small team in Fort Worth, Texas. We read every message beta testers send.</p></div>
            <a className="lp2-more" href="/about">About the team <span aria-hidden>&rarr;</span></a>
          </div>
          <ul className="lp2-team">
            {TEAM.map((m) => (
              <li key={m.name}>
                {m.photo ? <img src={m.photo} alt="" width={200} height={200} loading="lazy" /> : <span className="lp2-ini" aria-hidden>{m.name.split(" ").map((w) => w[0]).join("")}</span>}
                <b>{m.name}</b><span>{m.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lp2-sec" aria-labelledby="follow-h">
        <div className="lp2-w">
          <h2 id="follow-h">Follow along</h2>
          <p className="lp2-sub">What we&rsquo;re building, and tips for your search.</p>
          <div className="lp2-social">
            <a href={INSTAGRAM} {...out} data-testid="link-instagram"><InstagramMark size={26} /><span><b>Instagram</b><span>@coachremyai</span></span><span className="lp2-go" aria-hidden>&rarr;</span></a>
            <a href={LINKEDIN} {...out} data-testid="link-linkedin"><LinkedInMark /><span><b>LinkedIn</b><span>RemyAI company page</span></span><span className="lp2-go" aria-hidden>&rarr;</span></a>
          </div>
        </div>
      </section>

      <section className="lp2-sec lp2-end">
        <div className="lp2-w">
          <Remy size={52} mood="wave" />
          <h2>Ready when you are.</h2>
          <p>Free, no credit card. About five minutes to set up.</p>
          <a className="lp2-btn lp2-btn-lg" href={start} {...ext}>{startLabel}</a>
        </div>
      </section>

      <div className="lp2-w">
        <footer className="lp2-foot">
          <span>&copy; 2026 RemyAI LLC &middot; Fort Worth, Texas</span>
          <nav aria-label="Footer">
            <a href="/about">About</a><a href="mailto:hello@remyai.org">hello@remyai.org</a>
            <a href={INSTAGRAM} {...out}>Instagram</a><a href={LINKEDIN} {...out}>LinkedIn</a>
            <a href="/policies">Privacy</a><a href="/policies#beta-terms">Beta terms</a>
          </nav>
        </footer>
      </div>
    </div>
  );
}
