import fs from "node:fs";
const inventory = JSON.parse(
  fs.readFileSync("docs/idea-inventory.json", "utf8"),
);
function scope(n: number): [string, string, string] {
  if (n <= 10)
    return [
      "/about",
      "Context",
      "Product problem and audience retained in the full brief.",
    ];
  if (n <= 19)
    return [
      "/connections",
      "Demo",
      "Labeled sample connection states only; no external account access or completeness claim.",
    ];
  if (n <= 25)
    return [
      "/profile",
      "Partial",
      "Editable profile, contextual setup and live guide. Imports are sample or manually supplied; no automatic verified record extraction.",
    ];
  if (n <= 31)
    return [
      "/profile; /opportunities",
      "Working",
      "Editable year, skills, sponsorship uncertainty, relocation and local priority; explained deterministic matching.",
    ];
  if (n <= 39)
    return [
      "/path",
      "Partial",
      "Role descriptions, experiments and live guidance. No quantitative forecasting model or JobsGPT integration.",
    ];
  if (n <= 46)
    return [
      "/path",
      "Demo",
      "Illustrative learning roadmap only. No official degree audit, course prerequisites, enrollment or graduation guarantee.",
    ];
  if (n <= 53)
    return [
      "/campus",
      "Demo",
      "Filter example activities and add tasks; actual campus inventory and community connections need verification.",
    ];
  if (n <= 59)
    return [
      "/path",
      "Partial",
      "Create, complete and remove semester tasks. No automatic dependency engine or autonomous life plan.",
    ];
  if (n <= 67)
    return [
      "/opportunities",
      "Partial",
      "Dated public snapshots, sample niche roles, manual public URL/text import. No comprehensive or live job aggregator.",
    ];
  if (n <= 74)
    return [
      "/opportunities",
      "Working",
      "Explainable relevance, strongest eligible-to-explore match, constraints and unknowns. Not hiring probabilities.",
    ];
  if (n <= 83)
    return [
      "/applications",
      "Working",
      "Three prepared example pairs; live AI tailoring, source comparison, student approval and text/DOCX export. Rule checks are not proof of truth or ATS success.",
    ];
  if (n <= 88)
    return [
      "/applications",
      "Partial",
      "Student-reported status only. Application bots are unresolved and no submission is automated.",
    ];
  if (n <= 96)
    return [
      "/advising",
      "Partial",
      "Tentative scheduling against sample classes, ICS, manual notes, live AI summary and approved tasks. No advisor booking, invite or recorded-meeting access.",
    ];
  if (n <= 104)
    return [
      "/settings",
      "Partial",
      "Per-category choices, visible defaults, digest preference and unsent previews. No email, push, scheduled delivery or channel connection.",
    ];
  if (n <= 109)
    return [
      "/profile; /opportunities",
      "Partial",
      "Preferences and feedback persist; location feedback updates weighting. No inferred private facts or adaptive training.",
    ];
  if (n <= 115)
    return [
      "/about; /opportunities",
      "Partial",
      "Shared public snapshots reused with private visitor workspaces. No live crawl, automatic refresh or model retraining.",
    ];
  if (n <= 130)
    return [
      "/about",
      "Context",
      "Full purpose statements and values retained in the build brief; human approval boundaries in the app.",
    ];
  if (n === 132)
    return [
      "/profile",
      "Working",
      "Two explicitly synthetic sample profiles; editable by visitor.",
    ];
  if (n === 133)
    return [
      "/opportunities",
      "Partial",
      "Three researched public posting snapshots. Recheck on employer sites before final submission; not a live current feed.",
    ];
  if (n === 134 || n === 135)
    return [
      "/applications",
      "Working",
      "Three prepared pairs plus live generation, review and export. Final competition outputs still require review.",
    ];
  if (n === 136)
    return [
      "/about",
      "Working",
      "Reusable live AI guide, application generator and meeting summarizer.",
    ];
  if (n === 137)
    return [
      "/about",
      "Partial",
      "Actual requests and flags logged separately from constructed tests. Team must identify and explain an actual observed error.",
    ];
  if (n === 138 || n === 139 || n === 131)
    return [
      "/about",
      "Retained requirement",
      "Competition pitch, appendix and rubric preserved in brief; no completed pitch deck is claimed.",
    ];
  if (n === 142 || n === 144)
    return [
      "/about",
      "Working",
      "Responsive interfaces and end-to-end functional QA; see QA report.",
    ];
  if (n <= 147)
    return [
      "/about",
      "Partial",
      "Build plan and positioning retained; team roles, outcome measurement and prioritization are team decisions.",
    ];
  return [
    "/about",
    "Open / parked",
    "Original idea retained verbatim in brief and inventory; intentionally not represented as implemented.",
  ];
}
const quote = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
const rows = [
  [
    "id",
    "path",
    "title",
    "original_note",
    "original_status",
    "demo_screen",
    "implementation_status",
    "boundary",
  ],
];
for (const x of inventory.items)
  rows.push([
    x.id,
    x.path,
    x.title,
    x.note,
    x.status,
    ...scope(Number(x.id.slice(1))),
  ]);
fs.writeFileSync(
  "docs/mindmap-coverage.csv",
  rows.map((r) => r.map(quote).join(",")).join("\n") + "\n",
);
if (inventory.items.length !== 155)
  throw new Error("Expected all 155 original ideas.");
console.log("Preserved 155 idea records in coverage CSV.");
