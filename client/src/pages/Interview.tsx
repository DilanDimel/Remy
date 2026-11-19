import { StoryDeck } from "../components/StoryDeck";
import { PitchCard } from "../components/PitchCard";

/** Interview prep (Dilan, Nov 19: its own place in the left bar, not a Resume tab): true stories from the resume,
 *  practiced out loud, and a 30-second pitch. The LinkedIn coach stays with the resume. */
export default function Interview() {
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Interview</span>
          <h1>Get ready to talk about yourself</h1>
          <p className="hide-phone">True stories from your resume for "Tell me about a time when…", and a 30-second pitch for career fairs and coffee chats.</p>
        </div>
      </div>
      <div className="stack-lg"><StoryDeck /><PitchCard /></div>
    </>
  );
}
