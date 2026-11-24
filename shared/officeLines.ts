// What Remy says in his office on his own (owners, Nov 24 2026): Stoic quotes while he leans back in his chair, a
// line for every thing you tap, and small surprises for the time of day and the date. Demetre asked for "100s of
// cool easter eggs"; the count is checked in officeLines.test.ts. Quotes are from public-domain translations.

export type Quote = { q: string; by: string };
export const QUOTES: Quote[] = [
  { q: "The impediment to action advances action. What stands in the way becomes the way.", by: "Marcus Aurelius" },
  { q: "Waste no more time arguing what a good man should be. Be one.", by: "Marcus Aurelius" },
  { q: "If it is not right, do not do it. If it is not true, do not say it.", by: "Marcus Aurelius" },
  { q: "Such as are your habitual thoughts, such also will be the character of your mind.", by: "Marcus Aurelius" },
  { q: "Very little is needed to make a happy life.", by: "Marcus Aurelius" },
  { q: "Look within. Within is the fountain of good, and it will ever bubble up, if you will ever dig.", by: "Marcus Aurelius" },
  { q: "Confine yourself to the present.", by: "Marcus Aurelius" },
  { q: "How much time he gains who does not look to see what his neighbour says or does.", by: "Marcus Aurelius" },
  { q: "The best revenge is not to be like your enemy.", by: "Marcus Aurelius" },
  { q: "Loss is nothing else but change, and change is Nature's delight.", by: "Marcus Aurelius" },
  { q: "At dawn, when you have trouble getting out of bed, tell yourself: I have to go to work, as a human being.", by: "Marcus Aurelius" },
  { q: "Never value anything as profitable that makes you break your word or lose your self-respect.", by: "Marcus Aurelius" },
  { q: "Accept the things to which fate binds you, and love the people with whom fate brings you together.", by: "Marcus Aurelius" },
  { q: "The object of life is not to be on the side of the majority, but to escape finding oneself in the ranks of the insane.", by: "Marcus Aurelius" },
  { q: "We suffer more often in imagination than in reality.", by: "Seneca" },
  { q: "While we are postponing, life speeds by.", by: "Seneca" },
  { q: "Begin at once to live, and count each separate day as a separate life.", by: "Seneca" },
  { q: "It is not that we have a short time to live, but that we waste a lot of it.", by: "Seneca" },
  { q: "No man was ever wise by chance.", by: "Seneca" },
  { q: "As long as you live, keep learning how to live.", by: "Seneca" },
  { q: "If a man knows not to which port he sails, no wind is favorable.", by: "Seneca" },
  { q: "Difficulties strengthen the mind, as labor does the body.", by: "Seneca" },
  { q: "Associate with people who are likely to improve you.", by: "Seneca" },
  { q: "First say to yourself what you would be, and then do what you have to do.", by: "Epictetus" },
  { q: "Men are disturbed not by things, but by the views which they take of things.", by: "Epictetus" },
  { q: "No great thing is created suddenly.", by: "Epictetus" },
  { q: "If you want to improve, be content to be thought foolish and stupid.", by: "Epictetus" },
  { q: "No man is free who is not master of himself.", by: "Epictetus" },
  { q: "Make the best use of what is in your power, and take the rest as it happens.", by: "Epictetus" },
  { q: "Wealth consists not in having great possessions, but in having few wants.", by: "Epictetus" },
  { q: "Well done is better than well said.", by: "Benjamin Franklin" },
  { q: "A journey of a thousand miles begins beneath one's feet.", by: "Lao Tzu" },
  { q: "Energy and persistence conquer all things.", by: "Benjamin Franklin" },
];

/** What he says when you tap a thing in the room. Keys match data-it on the office drawing. */
export const TAPS: Record<string, string[]> = {
  books: ["Each book is a job you decoded. I've read them all. Twice.", "Alphabetized by color. Don't tell anyone.", "One day this shelf will need a second shelf.", "Careful, that one's a first edition. Of your job search."],
  resume: ["Your resume, framed. Recruiters spend about seven seconds on one, so we make every second count.", "Numbers in bullets beat adjectives. Every time.", "I'd hang it in a museum. Or at least on a recruiter's desk."],
  pins: ["Every pin on this board is something you really did.", "I polish these on Sundays.", "The board has room. Lots of room."],
  window: ["Out there is where you're headed.", "Nice view. Better with an offer letter.", "Sometimes I just stare out here and think about cover letters."],
  sun: ["Sunlight: zero cost, full benefits.", "Good day to send one application.", "Vitamin D and a strong resume. All you need."],
  moon: ["The moon's out. So are the late-night applications.", "Even the moon takes nights off. Rest counts too.", "Fun fact: the moon has no job openings. I checked."],
  clock: ["It's {time}. Good time for one small step.", "Tick, tock. Deadlines don't wait, but you've got this.", "This clock runs on ambition. And one AA battery."],
  mug: ["Coffee. Fuel for cover letters.", "Third cup. Don't judge.", "It says World's Okayest Fox on the other side."],
  goldmug: ["Solid gold mug. The coffee tastes like success.", "A rare find. I only drink victory from it.", "Do not put this in the dishwasher."],
  lamp: ["Click. Mood lighting for deep work.", "Every good idea starts under a desk lamp.", "Lamp's on. Brain's on."],
  globe: ["Where in the world will your first job be?", "Spin it. Point. That's how I plan vacations.", "Opportunities are everywhere. Some are even remote."],
  plant: ["This plant grows with your streak. Water it with one small step a day.", "Its name is Gerald.", "Talk to it. It's a great listener. Better than LinkedIn."],
  bigplant: ["It grew this tall because you kept showing up.", "Photosynthesis and persistence. Same thing, really.", "Tall plant, tall goals."],
  bonsai: ["Patience, trimmed weekly.", "Small tree, big energy.", "Like a career: you shape it a little every day."],
  rug: ["It really ties the room together.", "Hand-woven. By me. Okay, not really.", "Wipe your paws, please."],
  painting: ["An original. The artist is very talented and very fox.", "It's called 'Hills, with Opportunity'.", "Art critics call it 'fine'."],
  trophy: ["You earned this one. I just dust it.", "First place in showing up.", "It's heavier than it looks. So is commitment."],
  chair: ["My thinking chair. It spins. Don't tell my manager.", "Ergonomic. My back thanks me.", "Leather. Faux, though. I'm a fox."],
  laptop: ["Forty-seven tabs open. All job postings.", "Ctrl+S. Always Ctrl+S.", "I type with two paws. Very fast."],
  briefcase: ["Every application you send goes in here.", "Packed and ready for interviews.", "Snacks are in the side pocket."],
  cert: ["This frame is waiting for your first certificate.", "Certificates look great in frames. Even better on resumes.", "A certificate a day keeps the rejection away. Roughly."],
  pennant: ["Go team!", "Earned from the daily chest. Very rare.", "School spirit, career spirit. Same pennant."],
  record: ["Lo-fi beats to job hunt to.", "Vinyl sounds warmer. Like a good referral.", "Now playing: The Sound of Applying."],
  photo: ["Thirty days in a row. That's a habit now.", "I keep this photo to remember where we started.", "Framed streaks hit different."],
  desk: ["Where the magic, and the spreadsheets, happen.", "Clean desk, clear mind. Mostly clean.", "This desk has seen a thousand drafts."],
  skyline: ["A whole city of employers. We'll find yours.", "Somewhere in there is your future office.", "Every lit window is somebody's career."],
};

/** When you tap Remy himself. Tap him five times fast and he spins his chair; ten and he gives up. */
export const POKES = [
  "Hi! Need something?", "That tickles.", "I'm working, I promise.", "Boop.", "Yes, the glasses are real.",
  "Ask me anything in the box below.", "You found me.", "I'm a fox. In a suit. At work. Living the dream.",
  "Still here.", "Hey, that's my ear.", "Did you know I can read your resume in two seconds?", "Every click is a high five.",
];
export const SPIN = "Wheee!";
export const GIVE_UP = "Okay, okay. You win. I'll stop pretending to work.";

/** Something for the time of day. h is the local hour, d the weekday (0 Sunday). */
export function timeLine(h: number, d: number): string {
  if (h < 4) return pick(["Up late? Same. Sleep counts as career prep, though.", "It's late. One small thing, then bed. Deal?", "The night owl gets the... no wait, that's not it."]);
  if (h < 7) return pick(["Early start. The best applications go out before breakfast.", "You're up before the sun. Respect."]);
  if (h < 11) return d === 1 ? "Monday. New week, fresh start." : pick(["Good morning! Coffee's on.", "Morning. Let's do one thing before lunch."]);
  if (h < 14) return pick(["Lunch break? Perfect time to rate a few openings.", "Midday check-in. You're doing great."]);
  if (h < 18) return d === 5 ? "It's Friday. Send one application and you've earned the weekend." : pick(["Afternoon slump? One quick quest fixes that.", "Afternoon. The office is quiet. Good time to think."]);
  if (h < 22) return d === 0 || d === 6 ? "Weekend evening. Even a small step counts today." : pick(["Evening. Wrapping up the day?", "Night's coming. My lamp's on."]);
  return pick(["Late night in the office. I'll keep the lamp on.", "Almost midnight. Wrap up and rest. Tomorrow's a new card."]);
}

/** Special days. m is the month (0 January), day the date. */
export function dateLine(when: Date): string | null {
  const m = when.getMonth(), day = when.getDate(), wd = when.getDay();
  const thanks = m === 10 && wd === 4 && day >= 22 && day <= 28;
  if (m === 10 && day >= 20 && day <= 30 && !thanks) return "Thanksgiving week. I'm grateful you keep showing up.";
  if (thanks) return "Happy Thanksgiving! I'm thankful for you. And pie.";
  if (m === 9 && day === 31) return "Happy Halloween! I'm dressed as a fox. Very convincing, right?";
  if (m === 0 && day === 1) return "Happy New Year! New year, new resume?";
  if (m === 1 && day === 14) return "Happy Valentine's Day. Fall in love with a job posting.";
  if (m === 3 && day === 1) return "Breaking news: every company wants to hire you. April Fools. But some really do.";
  if (m === 11 && day >= 24 && day <= 26) return "Happy holidays! The office is cozy. Take a real break.";
  if (m === 11 && day >= 5 && day <= 18) return "Finals season. Applications can wait a day. Your sleep can't.";
  if (m === 4 && day >= 1 && day <= 15) return "Finals and graduations season. Proud of you.";
  if (m === 10 && day === 20) return "Today's my office's birthday. I opened it on November 20.";
  if (wd === 5 && day === 13) return "Friday the 13th. Luckily, luck isn't on your resume.";
  if (m === 2 && day === 14) return "Pi Day. 3.14159... I memorized it for the interview.";
  return null;
}

export const KONAMI = "Cheat code accepted. +0 XP. Nice try, though.";
export const SECRETS: Record<string, string> = {
  stoic: "", // a quote
  remy: "That's me!",
  hire: "Hired! Okay, not yet. But soon.",
  coffee: "Brewing...",
};

export const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
