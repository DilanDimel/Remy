# Interview coach (owners only)

Thread: interview coach build, Nov 27. Branch `claude/project-thread-yg68fj`.

- Owners see Interview as four steps (Learn, Build, Practice, Mock interviews), `client/src/components/InterviewCoach.tsx`. Students still see the locked Interview page; nothing changed for them.
- Learn: 3 lessons with a quick check each, saved in workspace `coach.learned`.
- Build: reuses `PitchCard` and `StoryDeck`.
- Practice: one question at a time, `POST /api/interviews/drill`, rated by the same scorer as mock interviews, 20 rated tries a week (`WEEKLY_DRILLS`), saved in workspace `drills`. A question counts as practiced when Situation, Your part, Result and Lesson are all heard.
- Mock interviews: the existing `MockInterview` with the stepper on top and a readiness card per company.
- Next: the same four steps in the app (`native/src/app/interview.tsx`).
