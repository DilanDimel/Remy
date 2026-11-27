import { StoryDeck } from "../components/StoryDeck";
import { PitchCard } from "../components/PitchCard";
import { MockInterview } from "../components/MockInterview";
import { useOwnerView } from "../lib/store";
import { RemyAskInline } from "../components/RemyAskInline";

/** Interview prep (Dilan, Nov 19: its own place in the left bar, not a Resume tab): true stories from the resume,
 *  practiced out loud, and a 30-second pitch. The LinkedIn coach stays with the resume. */
export default function Interview() {
  const forJob = useOwnerView(); // redesign stage 3 (owners first): questions tied to the job they're applying for
  if (forJob) return <MockInterview />; // owners: the coach draws its own head (quota, Remy's line for each step)
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Interview</span>
          <h1><span className="title-slogan">Get ready to talk about yourself</span><span className="title-plain">Interview</span></h1>
          <p className="hide-phone">True stories from your resume for "Tell me about a time when…", and a 30-second pitch for career fairs and coffee chats.</p>
        </div>
      </div>
      <div className="stack-lg"><RemyAskInline page="Interview" placeholder="Ask Remy about interviews…" starters={["How do I answer “tell me about yourself”?", "What should I ask the interviewer?"]} /><StoryDeck /><PitchCard /></div>
    </>
  );
}
