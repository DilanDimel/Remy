import type { Contact, InboxMessage } from "./types";

// Clearly synthetic people. No real alumni data is used.
export const SAMPLE_CONTACTS: Contact[] = [
  {
    id: "c-sample-1",
    name: "Jordan Ellis (sample)",
    title: "Investment Banking Analyst",
    org: "Example Advisory Group",
    email: "jordan.ellis@example.com",
    why: "Sample contact: works in M&A advisory, a match for students exploring Evercore-style roles.",
    tags: ["Investment banking", "TCU alum (sample)"],
    label: "Demo data",
  },
  {
    id: "c-sample-2",
    name: "Priya Raman (sample)",
    title: "Fintech Product Analyst",
    org: "Example Payments Co.",
    email: "priya.raman@example.com",
    why: "Sample contact: bridges finance and information systems, relevant to Finance + BIS students.",
    tags: ["Fintech", "BIS"],
    label: "Demo data",
  },
  {
    id: "c-sample-3",
    name: "Marcus Bell (sample)",
    title: "Campus Recruiter",
    org: "Example Capital Partners",
    email: "marcus.bell@example.com",
    why: "Sample contact: recruiters can explain sophomore insight programs and timelines.",
    tags: ["Recruiting", "Sophomore programs"],
    label: "Demo data",
  },
];

// Synthetic emails for the status-suggestion workflow. Not from real employers.
export const SAMPLE_INBOX: InboxMessage[] = [
  {
    id: "m-sample-receipt",
    from: "no-reply@careers.example-bank.com",
    subject: "We received your application – Early Insight Program",
    date: "2026-10-12",
    body:
      "Hi there,\n\nThank you for applying to the Example Bank Early Insight Program. This email confirms we have received your application. Our team reviews applications on a rolling basis and will contact you if you are selected to move forward.\n\nBest,\nCampus Recruiting",
    label: "Sample email",
  },
  {
    id: "m-sample-interview",
    from: "recruiting@example-advisory.com",
    subject: "Next steps: first-round interview",
    date: "2026-10-15",
    body:
      "Hello,\n\nWe enjoyed reviewing your application for the Example Advisory Summer Analyst Program and would like to invite you to a 30-minute first-round interview. Please use the link below to choose a time between October 22 and October 24.\n\nRegards,\nExample Advisory Recruiting",
    label: "Sample email",
  },
  {
    id: "m-sample-ambiguous",
    from: "talent@example-capital.com",
    subject: "Update on your candidacy",
    date: "2026-10-16",
    body:
      "Hi,\n\nThanks for your continued interest in Example Capital. We wanted to share an update: our team is still reviewing candidates and we expect to share decisions about interviews and offers in the coming weeks.\n\nThank you,\nExample Capital Talent Team",
    label: "Sample email",
  },
];
