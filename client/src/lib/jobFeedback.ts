import type { Workspace } from "@shared/types";

/** Responses from concurrent saves can arrive out of order. Revisions belong to one account only. */
export function keepNewerJobFeedback(previous: Workspace | null, incoming: Workspace, previousAccount: string | null, incomingAccount: string | null): Workspace {
  if (!previous || !previousAccount || previousAccount !== incomingAccount) return incoming;
  let result = incoming;
  if ((previous.jobFeedbackVersion || 0) > (incoming.jobFeedbackVersion || 0))
    result = { ...result, jobFeedback: previous.jobFeedback, jobFeedbackVersion: previous.jobFeedbackVersion };
  return result;
}
