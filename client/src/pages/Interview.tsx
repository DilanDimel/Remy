import { StoryDeck } from "../components/StoryDeck";
import { PitchCard } from "../components/PitchCard";
import { JobInterview } from "../components/JobInterview";
import { useOwnerView, useStore } from "../lib/store";
import type { Workspace } from "@shared/types";

/** Interview prep (Dilan, Nov 19: its own place in the left bar, not a Resume tab): true stories from the resume,
 *  practiced out loud, and a 30-second pitch. The LinkedIn coach stays with the resume. */
export default function Interview() {
  const forJob = useOwnerView(); // redesign stage 3 (owners first): questions tied to the job they're applying for
  const { ws } = useStore();
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Interview</span>
          <h1><span className="title-slogan">Get ready to talk about yourself</span><span className="title-plain">Interview</span></h1>
          {forJob ? <InterviewLine w={ws!} /> : <p className="hide-phone">True stories from your resume for "Tell me about a time when…", and a 30-second pitch for career fairs and coffee chats.</p>}
        </div>
      </div>
      <div className="stack-lg">{forJob && <JobInterview />}<StoryDeck /><PitchCard /></div>
    </>
  );
}

/** Owners: Remy's one line, from what's real: an interview on the tracker, then stories and pitch still to do. */
function InterviewLine({ w }: { w: Workspace }) {
  const iv = w.tracker.find((t) => t.status === "Interview");
  const stories = w.stories || [];
  const ready = stories.filter((s) => s.situation && s.task && s.action && s.result).length;
  const todo = !stories.length ? "Build your stories first: Remy finds them in your resume." : ready < stories.length ? `${ready} of ${stories.length} stories ready, so finish one more today.` : !w.pitch ? "Your stories are ready. Draft your 30-second pitch next." : "Stories and pitch are ready. Practice one question out loud.";
  return (
    <p className="op-say" data-testid="interview-line">
      <b>{iv ? `You have an interview with ${iv.company}.` : "Interviews come fast once you apply."}</b> {todo}
    </p>
  );
}
