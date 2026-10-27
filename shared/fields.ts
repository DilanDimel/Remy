// The field chips students pick in setup, grouped so every kind of student sees their area
// (each label must match a field in server/fit.ts FIELDS; fit.test.ts checks this).
export const FIELD_GROUPS: [string, string[]][] = [
  ["Business", ["Finance", "Investment banking", "Accounting", "Consulting", "Marketing", "Sales", "Business & management", "Entrepreneurship", "Human resources", "Supply chain & operations", "Real estate"]],
  ["Tech & engineering", ["Software & computer science", "Data & analytics", "Information systems & IT", "Cybersecurity", "Engineering", "Architecture & construction", "Aviation"]],
  ["Health & science", ["Healthcare & medicine", "Nursing", "Science & research", "Environment & sustainability"]],
  ["People & public service", ["Education & teaching", "Psychology & social work", "Law & government", "Public safety", "Nonprofit & ministry"]],
  ["Creative & media", ["Art & design", "Film, theater & music", "Journalism & communications"]],
  ["Other", ["Hospitality & events", "Sports & recreation"]],
];
