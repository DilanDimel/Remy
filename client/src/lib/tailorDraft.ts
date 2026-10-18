import { useSyncExternalStore } from "react";

// Answers to Remy's tailoring questions, shared between the Remy side panel and
// the Resume page (both can show the questions). Kept in memory per application
// until they're sent with "Tailor with AI" or "Use my answers".
type Answers = Record<string, string>;
const drafts = new Map<string, Answers>();
const listeners = new Set<() => void>();
const empty: Answers = {};

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function setAnswer(appId: string, key: string, value: string) {
  drafts.set(appId, { ...(drafts.get(appId) || {}), [key]: value });
  listeners.forEach((l) => l());
}
export function clearAnswers(appId: string) {
  drafts.delete(appId);
  listeners.forEach((l) => l());
}
export function getAnswers(appId: string): Answers {
  return drafts.get(appId) || empty;
}
export function useAnswers(appId: string): Answers {
  return useSyncExternalStore(subscribe, () => getAnswers(appId));
}
