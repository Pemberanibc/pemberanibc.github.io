// ─────────────────────────────────────────────────────────────
//  Pemberani Tournament · Edition 3.0 — tournament data
//  Everything the committee might want to change lives here.
//  Groups confirmed by the live draw on 20 November 2026. Prize amounts still to be announced.
// ─────────────────────────────────────────────────────────────

export const TOURNAMENT = {
  edition: '3.0',
  // First serve. Malaysia time (+08:00). Drives the countdown.
  startsAt: '2026-12-05T10:00:00+08:00',
  endsAt: '2026-12-05T17:00:00+08:00',
  dateLabel: 'Saturday · 05.12.2026',
  timeLabel: '10 AM – 5 PM',
  venue: 'Andalas Sports Complex',
  // Rough minutes per match, used for "approx. start" estimates.
  minutesPerGroupMatch: 12,
  minutesPerKnockoutMatch: 20,
};

// Internal court numbers are 1 and 2; this is what everyone sees.
export const COURT_LABEL = { 1: 'C4', 2: 'C5' };
export const courtName = n => `Court ${COURT_LABEL[n] ?? n}`;

// Firebase path everything for this edition is stored under.
export const DB_ROOT = 'pt3';

// Address of a file in this site, from any page (the home page sits at the root, the Match Centre in live/).
export const sitePath = p => new URL('../' + p, import.meta.url).href;

export const RULES = {
  // Group stage: one game to 21 (captain: "21 points best of 1").
  group: { bestOf: 1, target: 21, deuce: false, cap: 21 },
  // Knockout: best of three games to 15 (captain: "15 points best of 3").
  // Assumed: win by 2, capped at 21 (at 20–20 the next point wins). Confirm with the captain.
  knockout: { bestOf: 3, target: 15, deuce: true, cap: 21 },
};

// The 24 players, split into the two pots used to draw the pairs.
// Pot A = past podium finishers (seeded). Titles: [place, edition], place 1 = champion, 2 = runner-up, 3 = third.
export const POTS = {
  A: [
    { name: 'Rasheed', titles: [[1, '1.0']] },
    { name: 'Jai', titles: [[1, '1.0'], [3, '2.0']] },
    { name: 'Muizz', titles: [[1, '2.0']] },
    { name: 'Daus', titles: [[1, '2.0']] },
    { name: 'Aizat', titles: [[2, '2.0'], [3, '1.0']] },
    { name: 'Soul', titles: [[2, '2.0']] },
    { name: 'Herman', titles: [[2, '1.0']] },
    { name: 'Syahir', titles: [[2, '1.0']] },
  ],
  B: [
    'Fareez', 'Azlan', 'Nizam', 'Fauzie Gigi', 'Abdel', 'Nataman', 'Pok', 'Charlie',
    'Syaqir', 'Abg Mie', 'Poknik', 'Adian', 'Abg Fizan', 'Satbeer', 'Samad', 'Rosli',
  ].map(name => ({ name, titles: [] })),
};
export const ROSTER = [...POTS.A, ...POTS.B].map(p => p.name);

// The draw: made live on 20 November 2026 (draw/). Pair numbers 1–6 follow the order each pair was
// drawn into its group, and decide the order of play (GROUP_ORDER below).
export const DRAW_CONFIRMED = true;
export const DRAW_DATE = '2026-11-20';

export const GROUPS = [
  {
    id: 'G1', name: 'Group A', court: 1,
    pairs: [
      { id: 'g1p1', name: 'Muizz & Fareez', players: ['Muizz', 'Fareez'] },
      { id: 'g1p2', name: 'Aizat & Abg Mie', players: ['Aizat', 'Abg Mie'] },
      { id: 'g1p3', name: 'Charlie & Azlan', players: ['Charlie', 'Azlan'] },
      { id: 'g1p4', name: 'Rosli & Nataman', players: ['Rosli', 'Nataman'] },
      { id: 'g1p5', name: 'Soul & Syaqir', players: ['Soul', 'Syaqir'] },
      { id: 'g1p6', name: 'Fauzie Gigi & Jai', players: ['Fauzie Gigi', 'Jai'] },
    ],
  },
  {
    id: 'G2', name: 'Group B', court: 2,
    pairs: [
      { id: 'g2p1', name: 'Nizam & Satbeer', players: ['Nizam', 'Satbeer'] },
      { id: 'g2p2', name: 'Daus & Abg Fizan', players: ['Daus', 'Abg Fizan'] },
      { id: 'g2p3', name: 'Syahir & Samad', players: ['Syahir', 'Samad'] },
      { id: 'g2p4', name: 'Rasheed & Abdel', players: ['Rasheed', 'Abdel'] },
      { id: 'g2p5', name: 'Adian & Pok', players: ['Adian', 'Pok'] },
      { id: 'g2p6', name: 'Herman & Poknik', players: ['Herman', 'Poknik'] },
    ],
  },
];

// Full round robin: 15 matches per group, every pair plays the other
// five once; nobody plays two matches back to back.
const GROUP_ORDER = [
  [1, 2], [3, 6], [4, 5],
  [1, 3], [2, 4], [5, 6],
  [1, 4], [3, 5], [2, 6],
  [1, 5], [4, 6], [2, 3],
  [1, 6], [2, 5], [3, 4],
];

// Top 4 of each group go through to the quarter-finals.
export const QUALIFIERS_PER_GROUP = 4;

export const KNOCKOUT = [
  { id: 'QF1', label: 'Quarter-final 1', round: 'QF', court: 1, a: { group: 'G1', rank: 1 }, b: { group: 'G2', rank: 4 } },
  { id: 'QF2', label: 'Quarter-final 2', round: 'QF', court: 1, a: { group: 'G2', rank: 2 }, b: { group: 'G1', rank: 3 } },
  { id: 'QF3', label: 'Quarter-final 3', round: 'QF', court: 2, a: { group: 'G2', rank: 1 }, b: { group: 'G1', rank: 4 } },
  { id: 'QF4', label: 'Quarter-final 4', round: 'QF', court: 2, a: { group: 'G1', rank: 2 }, b: { group: 'G2', rank: 3 } },
  { id: 'SF1', label: 'Semi-final 1', round: 'SF', court: 1, a: { winnerOf: 'QF1' }, b: { winnerOf: 'QF2' } },
  { id: 'SF2', label: 'Semi-final 2', round: 'SF', court: 2, a: { winnerOf: 'QF3' }, b: { winnerOf: 'QF4' } },
  { id: 'BRONZE', label: 'Third place', round: '3RD', court: 2, a: { loserOf: 'SF1' }, b: { loserOf: 'SF2' } },
  { id: 'FINAL', label: 'Final', round: 'F', court: 1, a: { winnerOf: 'SF1' }, b: { winnerOf: 'SF2' } },
];

// Prizes (poster: cash for 1st, 2nd and 3rd; amounts not announced yet).
export const PRIZES = [
  { place: '1', label: 'Champions', reward: 'Cash prize', amount: null },
  { place: '2', label: 'Runners-up', reward: 'Cash prize', amount: null },
  { place: '3', label: 'Third place', reward: 'Cash prize', amount: null },
];
export const GOODY_BAG = 'Goody bag worth up to RM15 for every entry';

export const HALL_OF_FAME = [
  { edition: '1.0', names: 'Rasheed & Jai', photo: 'assets/e3/champions-e1.jpg' },
  { edition: '2.0', names: 'Muizz & Daus', photo: 'assets/e3/champions-e2.jpg' },
];

// Photos in assets/e3/. List a name here once its .jpg has been uploaded;
// until then the page uses its own artwork (no broken images).
//   hero          → assets/e3/hero.jpg            (wide action shot, landscape)
//   story-1..3    → assets/e3/story-1.jpg …       (statement section backgrounds)
//   story-4       → assets/e3/story-4.jpg         (group photo, printed into the yellow "This is Pemberani")
//   champions-e2  → assets/e3/champions-e2.jpg    (Muizz & Daus, portrait)
export const PHOTOS = ['champions-e2', 'story-1', 'story-2', 'story-3', 'story-4', 'hero']; // hero.jpg: shows automatically once uploaded
// Gallery: gallery-01.jpg, gallery-02.jpg, … The site also looks for the next numbers by itself,
// so new photos appear as soon as they are uploaded with the next number.
export const GALLERY_COUNT = 5;

// ── Derived lists (no need to edit below) ─────────────────────

export const PAIRS = GROUPS.flatMap(g => g.pairs.map((p, i) => ({ ...p, group: g.id, seed: i + 1 })));
export const PAIR_BY_ID = Object.fromEntries(PAIRS.map(p => [p.id, p]));

export const FIXTURES = [
  ...GROUPS.flatMap(g => GROUP_ORDER.map(([x, y], i) => ({
    id: `${g.id}-M${i + 1}`,
    stage: 'group',
    group: g.id,
    label: `${g.name} · Match ${i + 1}`,
    short: `M${i + 1}`,
    court: g.court,
    order: i + 1,
    a: g.pairs[x - 1].id,
    b: g.pairs[y - 1].id,
  }))),
  ...KNOCKOUT.map((k, i) => ({
    ...k,
    stage: 'knockout',
    short: k.id === 'BRONZE' ? '3RD' : k.id,
    order: 100 + i,
    slotA: k.a,
    slotB: k.b,
    a: null,
    b: null,
  })),
];
export const FIXTURE_BY_ID = Object.fromEntries(FIXTURES.map(f => [f.id, f]));
