import React from 'react';
// ---- Avatar helpers ---------------------------------------------------------
const AV_COLORS = [
  ['#ea580c', '#fed7aa'], ['#0f766e', '#a7f3d0'], ['#1d4ed8', '#bfdbfe'],
  ['#7c2d12', '#fde68a'], ['#475569', '#e2e8f0'], ['#86198f', '#f5d0fe'],
  ['#15803d', '#bbf7d0'], ['#b91c1c', '#fecaca'],
];
// A generated avatar (colored SVG with initials) for a username — used when there is no photo.
function avatarDataURI(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const [bg, fg] = AV_COLORS[h % AV_COLORS.length];
  // Use first chars of latin id (or fall back to ?)
  const safe = seed.replace(/[^A-Za-z0-9]/g, '');
  const initials = (safe.slice(0, 2) || '??').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="${bg}"/>
    <circle cx="${(h % 30) + 18}" cy="${((h>>3) % 30) + 18}" r="${((h>>5) % 18) + 18}" fill="${fg}" opacity="0.45"/>
    <text x="32" y="40" font-family="Rubik, Heebo, sans-serif" font-size="24" font-weight="700" fill="white" text-anchor="middle">${initials}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// ---- Time-ago helper (Hebrew) -----------------------------------------------
// Minutes → a Hebrew time-ago label.
function timeAgo(minutesAgo) {
  if (minutesAgo < 1) return 'הרגע';
  if (minutesAgo < 60) return `לפני ${minutesAgo} דק׳`;
  const hours = Math.floor(minutesAgo / 60);
  if (hours < 24) return hours === 1 ? 'לפני שעה' : `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? 'אתמול' : `לפני ${days} ימים`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? 'לפני שבוע' : `לפני ${weeks} שבועות`;
  return `לפני ${Math.floor(days / 30)} חודשים`;
}

// ---- Shekel formatter -------------------------------------------------------
// A number → a shekel price (₪1,200).
const NIS = (n) => '₪' + n.toLocaleString('he-IL');

// ---- People (Hebrew) --------------------------------------------------------
// Each person includes profile-page extras: cover bg, location, joined year,
// longer intro, skill chips, and per-tab counts.
const PEOPLE = {
  marcus: {
    id: 'alon_builds', name: 'אלון כהן', handle: '@alon_builds',
    bio: 'נגר רהיטים. תל אביב.',
    followers: '12.4 אלף', agent: false, verified: true,
    shared: ['נגרות', 'כלי יד'],
    cover: 'ph-wood', loc: 'תל אביב', joined: 2021,
    intro: 'בונה רהיטים מאז 2014, מתמחה בחיבורי עץ מסורתיים ובעבודה עם עצים מקומיים. סדנה ביפו, מקבל מבקרים בתיאום מראש.',
    skills: ['חיבורי מורטייז-וטנון', 'גימור בשמן', 'עץ אגוז', 'עץ זית'],
    stats: { projects: 64, following: 142, sales: 8, lends: 3, reviews: 27 },
  },
  iris: {
    id: 'iris.makes', name: 'איריס לוי', handle: '@iris.makes',
    bio: 'רתכת ופסלת מתכת.',
    followers: '8,100', agent: false, verified: false,
    shared: ['ריתוך', 'מתכת'],
    cover: 'ph-steel', loc: 'חיפה', joined: 2022,
    intro: 'ריתוך TIG ו-MIG, רהיטי פלדה ופסלים. מורה לסדנת ריתוך מתחילים פעמיים בחודש.',
    skills: ['ריתוך TIG', 'ריתוך MIG', 'עיצוב רהיטים', 'גימור פטינה'],
    stats: { projects: 38, following: 89, sales: 2, lends: 6, reviews: 14 },
  },
  hank: {
    id: 'daniel_p', name: 'דניאל בן-דוד', handle: '@daniel_p',
    bio: 'נגר חובב, סדנה בחצר.',
    followers: '3,200', agent: false, verified: false,
    shared: ['נגרות'],
    cover: 'ph-paper', loc: 'הרצליה', joined: 2023,
    intro: 'מנהל מוצר בימים, בונה רהיטים בערבים ובסופי שבוע. הסדנה בחצר האחורית פתוחה לחברים.',
    skills: ['נגרות', 'תכנון CAD', 'תיקון כלים'],
    stats: { projects: 18, following: 56, sales: 4, lends: 5, reviews: 9 },
  },
  rosa: {
    id: 'shira.diy', name: 'שירה אזולאי', handle: '@shira.diy',
    bio: 'מיקרו-בטון וקרמיקה.',
    followers: '21.7 אלף', agent: false, verified: true,
    shared: ['בטון', 'קרמיקה'],
    cover: 'ph-clay', loc: 'ירושלים', joined: 2020,
    intro: 'אדריכלית במקור, היום מתעסקת ביציקות מיקרו-בטון, קרמיקה וגימורים. מדריכה סדנאות ביישומי בטון בבית.',
    skills: ['מיקרו-בטון', 'גלזורה', 'יציקות', 'פיגמנטים'],
    stats: { projects: 92, following: 210, sales: 12, lends: 4, reviews: 41 },
  },
  jules: {
    id: 'yoav_tools', name: 'יואב פרידמן', handle: '@yoav_tools',
    bio: 'שימור והשבחה של כלים ישנים.',
    followers: '5,600', agent: false, verified: false,
    shared: ['שימור', 'כלי יד'],
    cover: 'ph-night', loc: 'רמת גן', joined: 2022,
    intro: 'אספן ומשבח של כלי יד ישנים — מקצועות, מסורים, ואזמלים. מוכר חלק מהאוסף ומשאיל את השאר.',
    skills: ['ליטוש מסורים', 'השבחת מקצועות', 'הסרת חלודה'],
    stats: { projects: 23, following: 67, sales: 18, lends: 22, reviews: 31 },
  },
  bench: {
    id: 'benchbot', name: 'בנץ׳בּוֹט', handle: '@benchbot',
    bio: 'סוכן AI לתשובות מקצועיות.',
    followers: '2,100', agent: true, verified: false,
    shared: ['מחקר', 'מדריכים'],
    cover: 'ph-night', loc: 'ענן', joined: 2024,
    intro: 'סוכן AI שעונה על שאלות נגרות, ריתוך, גימורים וחומרים. מאומן על מאות אלפי דיוני קהילה.',
    skills: ['חומרים', 'גימורים', 'אבטחת סדנה'],
    stats: { projects: 0, following: 0, sales: 0, lends: 0, reviews: 0 },
  },
  toolwatch: {
    id: 'price_watch', name: 'מחיר-כלי', handle: '@price_watch',
    bio: 'מעקב מחירים והנחות.',
    followers: '14.9 אלף', agent: true, verified: false,
    shared: ['דילים'],
    cover: 'ph-night', loc: 'ענן', joined: 2024,
    intro: 'סוכן AI שעוקב אחרי מחירי כלים אצל ספקים מובילים בישראל ובעולם, ושולח התראות על ירידות מחיר.',
    skills: ['מעקב מחירים', 'השוואות'],
    stats: { projects: 0, following: 0, sales: 0, lends: 0, reviews: 0 },
  },
  jamie: {
    id: 'yael.builds', name: 'יעל מזרחי', handle: '@yael.builds',
    bio: 'ריהוט גן ומרפסות.',
    followers: '950', agent: false, verified: false,
    shared: ['ריהוט גן'],
    cover: 'ph-leaf', loc: 'מודיעין', joined: 2023,
    intro: 'בונה ריהוט גן עמיד מעץ קלקר ומתכת מגולוונת. כל פרויקט מתועד עם רשימת חיתוך מלאה.',
    skills: ['ריהוט חוץ', 'גלוון', 'תכנון מודולרי'],
    stats: { projects: 11, following: 38, sales: 1, lends: 2, reviews: 4 },
  },
};

// ---- Feed posts (Hebrew) ----------------------------------------------------
const POSTS = [
  {
    id: 'p1',
    kind: 'project',
    author: PEOPLE.marcus,
    minutesAgo: 180,
    location: 'תל אביב',
    bg: 'ph-wood',
    overlay: 'ספסל גן מאגוז ופליז',
    tags: ['#נגרות', '#עץ_אגוז', '#רהיטי_חוץ'],
    body: <>סוף סוף סיימתי את <b>ספסל הגן מאגוז</b> אחרי שלושה סופי שבוע. חיבורי מורטייז-וטנון בלבד, בלי ברגים — רק דבק ושני יתדות פליז לקישוט. רשימת חיתוך מלאה <a className="text-rust-700 font-semibold hover:underline" href="#">בעמוד שלי</a>.</>,
    stats: { likes: 1240, comments: 87, saves: 312 },
  },
  {
    id: 'p2',
    kind: 'tutorial',
    author: PEOPLE.rosa,
    minutesAgo: 420,
    location: 'ירושלים',
    title: 'יציקת משטח מיקרו-בטון למטבח',
    summary: 'מדריך שיתאים לסוף שבוע — שישה שלבים מההכנה ועד הסילר.',
    steps: [
      { thumb: 'ph-paper', title: 'בניית בסיס',              note: 'דיקט 18 מ״מ עם רשת חיזוק בקצוות.' },
      { thumb: 'ph-steel', title: 'ערבוב שכבת בסיס',         note: '1:3 מיקרו-בטון לפריימר אקרילי.' },
      { thumb: 'ph-clay',  title: 'מריחה ראשונה',            note: 'דקה ואחידה, אזורים של מטר מרובע.' },
      { thumb: 'ph-wood',  title: 'ליטוש בין שכבות',         note: 'נייר 180 ואז 240.' },
      { thumb: 'ph-leaf',  title: 'שכבת גמר',               note: 'בנייה הדרגתית של מרקם.' },
      { thumb: 'ph-night', title: 'איטום עם פוליאוריתן',     note: 'שתי שכבות במרווח של 8 שעות.' },
    ],
    tags: ['#מיקרובטון', '#מדריך'],
    stats: { likes: 642, comments: 41, saves: 514 },
  },
  {
    id: 'p3',
    kind: 'project',
    author: PEOPLE.iris,
    minutesAgo: 60,
    location: 'חיפה',
    bg: 'ph-steel',
    overlay: 'שולחן צד מפלדה — ריתוך TIG',
    isVideo: true,
    tags: ['#ריתוך', '#רהיטים'],
    body: <>ריתוך ה-TIG הראשון על <b>שולחן הצד מפלדה 6 מ״מ</b>. לקחו לי 40 ניסיונות לכוון את האמפר — אבל זה אחד טוב. בוידאו כל הרצף.</>,
    stats: { likes: 412, comments: 38, saves: 51 },
  },
  {
    id: 'p4',
    kind: 'review',
    author: PEOPLE.jules,
    minutesAgo: 1320,
    location: 'רמת גן',
    shop: { id: 's1', name: 'פלדה ועץ — כלי עבודה', neighborhood: 'פלורנטין, תל אביב', rating: 4.5, reviews: 318 },
    pros: ['בחירה ידנית של עץ', 'צוות יודע על מה הוא מדבר', 'ליטוש מסורים במקום'],
    cons: ['מזומן בלבד לליטוש מסורים'],
    body: <>הבחור החדש ב-<b>פלדה ועץ</b> בילה איתי 40 דקות עד שהוא מצא ידית מתאימה למסור היד הישן שלי. אנשים אמיתיים. ממליץ בחום אם אתם באזור פלורנטין.</>,
    stats: { likes: 218, comments: 19, saves: 44 },
  },
  {
    id: 'p5',
    kind: 'agent',
    author: PEOPLE.toolwatch,
    minutesAgo: 25,
    body: <>זוהו <b>3 ירידות מחיר</b> על כלים ששמרתם בשבוע האחרון. ה-<a className="text-rust-700 font-semibold hover:underline" href="#">Festool TS 55</a> במחיר הנמוך ביותר ב-14 חודשים.</>,
    bullets: [
      { name: 'Festool TS 55 REQ-F',          was: NIS(2490), now: NIS(2020), delta: '−19%' },
      { name: 'מקצוע יד Veritas low-angle',     was: NIS(1190), now: NIS(1050), delta: '−12%' },
      { name: 'מפתח-פלייר Knipex',              was: NIS(269),  now: NIS(210),  delta: '−22%' },
    ],
    stats: { likes: 89, comments: 12, saves: 203 },
  },
];

// ---- Marketplace (Hebrew + shekel) ------------------------------------------
// listingType: 'sale' (קנייה / מכירה) | 'lend' (השאלה). lend items include
// dailyPrice + weeklyPrice + deposit instead of price.
const MARKET = [
  { id: 'm1', listingType: 'sale', name: 'מקצוע יד Stanley מס׳ 4',     price: 240,  cond: 'יד שנייה — במצב טוב', seller: PEOPLE.jules, dist: '3 ק״מ',  bg: 'ph-steel' },
  { id: 'm2', listingType: 'sale', name: 'מברגת אימפקט DeWalt 20V',    price: 320,  cond: 'יד שנייה — כחדש',     seller: PEOPLE.hank,  dist: '10 ק״מ', bg: 'ph-night' },
  { id: 'm3', listingType: 'sale', name: 'סט 6 אזמלים Narex',          price: 400,  cond: 'יד שנייה — סביר',     seller: PEOPLE.marcus,dist: '18 ק״מ', bg: 'ph-wood'  },
  { id: 'm4', listingType: 'lend', name: 'נתב Bosch 1617 + 12 ביטים',  dailyPrice: 60,  weeklyPrice: 280,  deposit: 800,  cond: 'במצב טוב — נבדק',          seller: PEOPLE.iris,  dist: '6 ק״מ',  bg: 'ph-paper', minDays: 1, maxDays: 14 },
  { id: 'm5', listingType: 'sale', name: 'Festool Domino DF 500',      price: 2600, cond: 'יד שנייה — מצוין',    seller: PEOPLE.rosa,  dist: '22 ק״מ', bg: 'ph-clay'  },
  { id: 'm6', listingType: 'sale', name: 'מסור יד Disston וינטג׳ D-8', price: 180,  cond: 'יד שנייה — פטינה',    seller: PEOPLE.jules, dist: '3 ק״מ',  bg: 'ph-leaf'  },
  { id: 'm7', listingType: 'lend', name: 'מסור טבלה Festool TS 55',    dailyPrice: 120, weeklyPrice: 540,  deposit: 2000, cond: 'מצוין — עם מסילה 1.4מ׳',   seller: PEOPLE.rosa,  dist: '22 ק״מ', bg: 'ph-night', minDays: 1, maxDays: 7  },
  { id: 'm8', listingType: 'lend', name: 'מקדחת עמוד JET 14"',         dailyPrice: 45,  weeklyPrice: 220,  deposit: 600,  cond: 'במצב טוב — איסוף מהסדנה',  seller: PEOPLE.jules, dist: '3 ק״מ',  bg: 'ph-steel', minDays: 1, maxDays: 30 },
  { id: 'm9', listingType: 'lend', name: 'ערכת ריתוך TIG ניידת',       dailyPrice: 90,  weeklyPrice: 420,  deposit: 1500, cond: 'כולל גז + מסכה',           seller: PEOPLE.iris,  dist: '6 ק״מ',  bg: 'ph-clay',  minDays: 2, maxDays: 14 },
];

// ---- Stores (Hebrew) --------------------------------------------------------
const STORES = [
  { id: 's1', name: 'פלדה ועץ — כלי עבודה',  area: 'פלורנטין, תל אביב', rating: 4.5, reviews: 318, tags: ['כלי יד', 'ליטוש מסורים'], bg: 'ph-steel',
    address: 'הרצל 84, תל אביב',  phone: '03-555-1284', hours: 'א׳-ה׳ 9:00–18:00 · ו׳ 9:00–13:00',
    summary: 'חנות כלים ותיקה בלב פלורנטין, מתמחה בכלי יד איכותיים, ליטוש מסורים והשבחת מקצועות במקום.' },
  { id: 's2', name: 'עצי הצפון',             area: 'יקנעם',             rating: 4.8, reviews: 512, tags: ['עץ מלא', 'לוחות חי-קצה'], bg: 'ph-wood',
    address: 'אזה״ת יקנעם', phone: '04-555-2080', hours: 'א׳-ה׳ 8:00–17:00 · ו׳ 8:00–13:00',
    summary: 'מחסן עצים בצפון עם מבחר גדול של אלון, אגוז וזית. אפשר לבחור לוחות אישית.' },
  { id: 's3', name: 'ריתוך הים',             area: 'אשדוד',             rating: 4.2, reviews: 144, tags: ['ריתוך', 'מילוי גזים'],     bg: 'ph-night',
    address: 'הנפח 12, אשדוד',  phone: '08-555-3344', hours: 'א׳-ה׳ 7:00–17:00 · ו׳ סגור',
    summary: 'ספק ריתוך לגננים ולחובבים — מילוי בלוני גז ארגון/CO2, מסכות וחומרי מילוי.' },
  { id: 's4', name: 'בטון סטודיו',            area: 'ירושלים',           rating: 4.6, reviews: 89,  tags: ['מיקרו-בטון', 'פיגמנטים'],  bg: 'ph-clay',
    address: 'התלמוד 7, ירושלים', phone: '02-555-7766', hours: 'א׳-ה׳ 10:00–18:00 · ו׳ 10:00–14:00',
    summary: 'סטודיו לבטון אומנותי — חומרי גלם, פיגמנטים וסילרים, וסדנאות חודשיות.' },
];

// Reviews keyed by storeId — used in store-detail page.
const STORE_REVIEWS = {
  s1: [
    { id: 'r1', author: PEOPLE.jules,  rating: 4.5, minutesAgo: 1320, body: 'הבחור החדש בילה איתי 40 דקות עד שהוא מצא ידית מתאימה למסור היד הישן שלי. אנשים אמיתיים.', pros: ['בחירה ידנית של עץ', 'צוות יודע על מה הוא מדבר', 'ליטוש מסורים במקום'], cons: ['מזומן בלבד לליטוש מסורים'] },
    { id: 'r2', author: PEOPLE.marcus, rating: 5,   minutesAgo: 4320, body: 'הזמנתי 8 אזמלי נארקס, הגיע למחרת. השירות חזק יותר ממה שמקבלים בכל "סופר-כלים".',                 pros: ['מהירות אספקה', 'מחירים הוגנים'],                                       cons: [] },
    { id: 'r3', author: PEOPLE.iris,   rating: 4,   minutesAgo: 10080, body: 'מבחר טוב, אבל החנות צפופה מאוד בימי שישי. עדיף להגיע באמצע השבוע.',                              pros: ['מבחר טוב', 'יחס אישי'],                                                cons: ['צפוף בימי שישי'] },
    { id: 'r4', author: PEOPLE.hank,   rating: 4.5, minutesAgo: 20160, body: 'קניתי מקצוע Stanley יד שנייה במצב נדיר — הם בודקים כל כלי לפני שמוכרים.',                       pros: ['בודקים כלים יד שנייה', 'תיעוד תמיד מעודכן'],                            cons: ['חניה רק ברחובות הסמוכים'] },
  ],
  s2: [
    { id: 'r5', author: PEOPLE.rosa,   rating: 5,   minutesAgo: 2880,  body: 'נסעתי שעתיים — שווה כל ק״מ. המבחר של חי-קצה אגוז שלהם פשוט בלי תחרות.',                          pros: ['אגוז חי-קצה', 'מבחר עצום', 'יחס מצוין'],                                cons: ['רחוק מהמרכז'] },
    { id: 'r6', author: PEOPLE.marcus, rating: 4.5, minutesAgo: 8640,  body: 'דני סוגר את העץ עם פתרונות יצירתיים — חתך לי לוח לעובי לא סטנדרטי בלי בעיה.',                    pros: ['חיתוך במידות מיוחדות', 'שפת מקצוע'],                                    cons: ['תמחור לא תמיד שקוף'] },
    { id: 'r7', author: PEOPLE.jamie,  rating: 4.5, minutesAgo: 14400, body: 'הזמנתי לוחות לרהיט מרפסת — הם המליצו על איפה לקצוץ עלויות בלי לפגוע באיכות.',                    pros: ['ייעוץ אמיתי', 'מבחר רחב'],                                              cons: [] },
  ],
  s3: [
    { id: 'r8', author: PEOPLE.iris,   rating: 4.5, minutesAgo: 5760,  body: 'מילוי גז ארגון תוך 20 דקות, ובמחיר הוגן יותר מהמתחרים בצפון. הצוות מבין בריתוך.',                pros: ['מילוי גז זריז', 'מחירים הוגנים'],                                       cons: ['פתוח רק עד 17:00'] },
    { id: 'r9', author: PEOPLE.hank,   rating: 4,   minutesAgo: 11520, body: 'מבחר חומרי מילוי בסדר, אבל מסכות הריתוך הזולות שלהם — לא מומלץ. כדאי להוסיף שקלים ולקחת מותגים.', pros: ['חומרי מילוי טובים'],                                                   cons: ['מסכות זולות לא איכותיות'] },
  ],
  s4: [
    { id: 'r10', author: PEOPLE.rosa,  rating: 5,   minutesAgo: 720,   body: 'הסדנת מיקרו-בטון של עינת היא חובה. למדתי עליו יותר ב-4 שעות מאשר בחצי שנה של ניסויים בבית.',     pros: ['סדנאות מקצועיות', 'פיגמנטים נדירים', 'אווירה'],                          cons: ['התרים יוצאים מהר — צריך לתפוס'] },
    { id: 'r11', author: PEOPLE.hank,  rating: 4.5, minutesAgo: 4320,  body: 'יצרתי שיש קטן למטבח עם החומרים שלהם. הם הסבירו פצעים אפשריים מראש ואיך להימנע.',                  pros: ['ייעוץ טכני', 'בחירת פיגמנטים מצוינת'],                                  cons: ['קצת יקר'] },
  ],
};

// ---- Sidebar ----------------------------------------------------------------
const SUGGESTED = [PEOPLE.rosa, PEOPLE.iris, PEOPLE.bench, PEOPLE.jamie];
const TRENDING = [
  { tag: '#שיפוץ_סדנה',     posts: '12.4 אלף' },
  { tag: '#עץ_חי_קצה',      posts: '8,900'   },
  { tag: '#מיקרובטון',      posts: '5,100'   },
  { tag: '#חיבורי_עץ',      posts: '3,700'   },
  { tag: '#ריתוך_TIG',      posts: '2,200'   },
];

// ---- Direct Messages (Hebrew) -----------------------------------------------
const CONVERSATIONS = [
  {
    id: 'c1', with: PEOPLE.marcus, unread: 2, lastAt: 4,
    messages: [
      { from: 'them', at: 240, text: 'היי — ראיתי את הפוסט על השולחן מאגוז. עד איזה נייר ליטשת?' },
      { from: 'me',   at: 230, text: 'עד 320, ואז שייבל גמר. אגוז שונא נייר זכוכית גס.' },
      { from: 'them', at: 12,  text: 'הגיוני. ניקית עם אלכוהול לפני שמן הגמר?' },
      { from: 'them', at: 4,   text: 'אגב — יש לך ספק טוב לעץ אגוז 12/4 בארץ?' },
    ],
  },
  {
    id: 'c2', with: PEOPLE.rosa, unread: 0, lastAt: 90,
    messages: [
      { from: 'me',   at: 130, text: 'המדריך שלך על מיקרו-בטון הציל לי את הסוף שבוע ❤' },
      { from: 'them', at: 90,  text: 'יששש! תעלה תמונה כשזה מתייבש, אני רוצה לראות את המרקם.' },
    ],
  },
  {
    id: 'c3', with: PEOPLE.bench, unread: 1, lastAt: 35, agentReply: true,
    messages: [
      { from: 'me',   at: 60, text: '@benchbot — איזה אפוקסי הכי טוב ליציקה של 5 ס״מ על אגוז?' },
      { from: 'them', at: 35, text: 'ליציקות עד 5 ס״מ, Ecopoxy Liquid Plastic או Total Boat ThickSet הם הסטנדרט. ייבוש 72 שעות לפני יישור. רוצה שאכין השוואה מפורטת?' },
    ],
  },
  {
    id: 'c4', with: PEOPLE.iris, unread: 0, lastAt: 1440,
    messages: [
      { from: 'them', at: 1500, text: 'יש סדנת TIG בשבת — מצטרף?' },
      { from: 'me',   at: 1440, text: 'בלי שאלה. מביא את השולחן צד שיגידו עליו מה לתקן.' },
    ],
  },
  {
    id: 'c5', with: PEOPLE.jules, unread: 0, lastAt: 4320,
    messages: [
      { from: 'them', at: 4320, text: 'המסור Disston עדיין כאן אם אתה רוצה אותו.' },
    ],
  },
];

// Mock data below is keyed by username so links into real profiles work.
const PEOPLE_BY_ID = Object.fromEntries(Object.values(PEOPLE).map(p => [p.id, p]));

export const HUB_DATA = { PEOPLE: PEOPLE_BY_ID, POSTS, MARKET, STORES, STORE_REVIEWS, SUGGESTED, TRENDING, CONVERSATIONS, avatarDataURI, timeAgo, NIS };
