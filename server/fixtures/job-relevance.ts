// Julio Renovato's hand-labeled relevance cases (shared job discovery, Oct 2026), kept as a regression test.
/** Hand-labeled synthetic evaluation cases. Never imported by the app or seeded as jobs.
 * Expected labels are fixed here independently of the ranking implementation.
 * Each sector has a direct role, a duty-based role, incidental text and a senior role.
 */
export const RELEVANCE_CASES = [
  { sector: "finance", target: "Finance", cases: [
    ["Investment Banking Intern", "Prepare valuations for client transactions.", true],
    ["Summer Intern", "You will prepare financial models and valuation research.", true],
    ["Software Intern", "Build internal tools. Benefits include financial wellness support.", false],
    ["Senior Financial Analyst", "Prepare financial forecasts.", false],
  ] },
  { sector: "healthcare", target: "Nursing", cases: [
    ["Student Nurse", "Assist with patient care under supervision.", true],
    ["Summer Intern", "You will provide patient care and assist clinical staff.", true],
    ["Software Intern", "Develop internal tools. We provide medical and health insurance benefits.", false],
    ["Nursing Director", "Manage clinical teams.", false],
  ] },
  { sector: "software", target: "Software development", cases: [
    ["Junior Software Developer", "Build internal applications.", true],
    ["Summer Intern", "You will develop software and implement new features.", true],
    ["Mechanical Engineering Intern", "Design mechanical assemblies using CAD.", false],
    ["Staff Software Engineer", "Develop distributed services.", false],
  ] },
  { sector: "marketing", target: "Marketing", cases: [
    ["Brand Intern", "Create campaigns for a product launch.", true],
    ["Summer Intern", "You will conduct market research and support marketing campaigns.", true],
    ["Software Intern", "Build internal tools. About us: our marketing platform serves brands.", false],
    ["Marketing Director", "Manage brand campaigns.", false],
  ] },
  { sector: "education", target: "Teaching", cases: [
    ["Teaching Assistant", "Assist classroom lessons.", true],
    ["Summer Intern", "You will support classroom activities and teacher preparation.", true],
    ["Software Intern", "Build internal tools. Benefits include education assistance.", false],
    ["Director of Education", "Manage teaching programs.", false],
  ] },
  { sector: "logistics", target: "Supply chain", cases: [
    ["Procurement Intern", "Coordinate supplier deliveries.", true],
    ["Summer Intern", "You will analyze supply chain routes and warehouse capacity.", true],
    ["Marketing Intern", "Create brand campaigns. Qualifications: any major including logistics.", false],
    ["Logistics Manager", "Manage warehouse operations.", false],
  ] },
  { sector: "hospitality", target: "Hospitality", cases: [
    ["Hotel Trainee", "Assist guest services.", true],
    ["Summer Intern", "You will coordinate hotel guest arrivals and restaurant reservations.", true],
    ["Software Intern", "Build internal tools. Benefits include hotel discounts.", false],
    ["Hotel Director", "Manage hotel staff.", false],
  ] },
  { sector: "design", target: "Graphic design", cases: [
    ["Graphic Design Intern", "Create visual assets.", true],
    ["Summer Intern", "You will design graphic assets and create brand illustrations.", true],
    ["Accounting Intern", "Prepare tax returns. Benefits include creative workshops.", false],
    ["Principal Designer", "Design visual systems.", false],
  ] },
  { sector: "legal", target: "Legal", cases: [
    ["Paralegal Trainee", "Prepare litigation documents.", true],
    ["Summer Intern", "You will conduct legal research and prepare litigation records.", true],
    ["Software Intern", "Build internal tools. Equal opportunity employer as protected by law.", false],
    ["Legal Director", "Manage litigation teams.", false],
  ] },
  { sector: "sustainability", target: "Sustainability", cases: [
    ["Environmental Intern", "Conduct field surveys.", true],
    ["Summer Intern", "You will conduct environmental research and support sustainability projects.", true],
    ["Software Intern", "Build internal tools. About the company: a sustainable environment matters to us.", false],
    ["Sustainability Manager", "Manage environmental programs.", false],
  ] },
  { sector: "mechanical", target: "Mechanical engineering", cases: [
    ["Mechanical Engineering Intern", "Build mechanical prototypes.", true],
    ["Summer Intern", "You will develop CAD models and test mechanical assemblies.", true],
    ["Software Engineering Intern", "Build web applications.", false],
    ["Senior Mechanical Engineer", "Design mechanical systems.", false],
  ] },
  { sector: "human-resources", target: "Human resources", cases: [
    ["Recruiting Intern", "Coordinate candidate interviews.", true],
    ["Summer Intern", "You will support human resources and coordinate recruiting projects.", true],
    ["Software Intern", "Build internal tools. Contact human resources if you need interview accommodations.", false],
    ["Human Resources Director", "Manage recruiting programs.", false],
  ] },
] as const;
