import type { HistoryMessage } from './context-budget.js';

export type CustomerGender = 'MALE' | 'FEMALE' | 'UNKNOWN';

const DIACRITICS_AND_TATWEEL = /[\u064B-\u065F\u0670\u0640]/g;
const ALEF_VARIANTS = /[أإآٱ]/g;

/** Normalize Arabic text for linguistic cue matching (preserves ة vs ه and ى vs ي). */
function normalizeTextForCues(raw: string): string {
  return raw
    .replace(DIACRITICS_AND_TATWEEL, '')
    .replace(ALEF_VARIANTS, 'ا')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize a single name token (Arabic or Latin) for dictionary lookup. */
function normalizeNameToken(token: string): string {
  return token
    .toLowerCase()
    .replace(DIACRITICS_AND_TATWEEL, '')
    .replace(ALEF_VARIANTS, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\u0600-\u06FFa-z]/g, '');
}

const UNISEX_NAMES = new Set([
  'نور',
  'رضا',
  'اسلام',
  'شمس',
  'وسام',
  'جهاد',
  'عصمت',
  'عفت',
  'احسان',
  'قمر',
  'nour',
  'reda',
  'eslam',
  'islam',
  'shams',
  'wessam',
  'wesam',
  'gehad',
  'jihad',
]);

const MALE_NAMES = new Set([
  'احمد',
  'محمد',
  'محمود',
  'مصطفي',
  'علي',
  'عمر',
  'عمرو',
  'حسن',
  'حسين',
  'ابراهيم',
  'يوسف',
  'خالد',
  'طارق',
  'كريم',
  'رامي',
  'تامر',
  'شريف',
  'زياد',
  'مازن',
  'ياسر',
  'وليد',
  'سامح',
  'هاني',
  'نبيل',
  'فادي',
  'مينا',
  'جرجس',
  'ابانوب',
  'بيشوي',
  'كيرلس',
  'بطرس',
  'مرقس',
  'ماجد',
  'مدحت',
  'اشرف',
  'ايمن',
  'ايهاب',
  'امير',
  'امجد',
  'انور',
  'اسامه',
  'حمزه',
  'طلحه',
  'حذيفه',
  'عبيده',
  'معاويه',
  'عقبه',
  'بلال',
  'باسم',
  'باسل',
  'بهاء',
  'توفيق',
  'جلال',
  'جمال',
  'حاتم',
  'حازم',
  'حسام',
  'حمدي',
  'رمضان',
  'رجب',
  'شعبان',
  'سعيد',
  'سعد',
  'سامي',
  'سيف',
  'سليم',
  'سليمان',
  'سمير',
  'شادي',
  'شهاب',
  'صلاح',
  'صدام',
  'صابر',
  'صفوت',
  'عادل',
  'عاطف',
  'عبدالله',
  'عبدالرحمن',
  'عبدالعزيز',
  'عبدالقادر',
  'عبدالوهاب',
  'عبدالحميد',
  'عبدالفتاح',
  'عبدالمنعم',
  'عصام',
  'علاء',
  'عماد',
  'فارس',
  'فاروق',
  'فتحي',
  'فؤاد',
  'فريد',
  'فيصل',
  'قاسم',
  'كامل',
  'كمال',
  'لؤي',
  'ماهر',
  'مروان',
  'معتز',
  'ممدوح',
  'منصور',
  'منير',
  'مهاب',
  'مهند',
  'موسي',
  'ناجي',
  'نادر',
  'ناصر',
  'نبيه',
  'نديم',
  'نزيه',
  'نشات',
  'نعيم',
  'هادي',
  'هاشم',
  'هشام',
  'هيثم',
  'وائل',
  'وجدي',
  'وحيد',
  'وديع',
  'وسيم',
  'ياسين',
  'يحيي',
  'يزيد',
  'ادم',
  'اياد',
  'اسر',
  'انس',
  'بدر',
  'تميم',
  'ريان',
  'زين',
  'مالك',
  'مراد',
  'نديم',
  'نزار',
  'تيم',
  // Latin / English transliterations
  'ahmed',
  'ahmad',
  'mohamed',
  'mohammed',
  'muhammad',
  'mahmoud',
  'mostafa',
  'mustafa',
  'ali',
  'omar',
  'amr',
  'hassan',
  'hussein',
  'ibrahim',
  'youssef',
  'yousef',
  'khaled',
  'khalid',
  'tarek',
  'tarik',
  'karim',
  'kareem',
  'ramy',
  'rami',
  'tamer',
  'sherif',
  'ziad',
  'zeyad',
  'mazen',
  'yasser',
  'waleed',
  'walid',
  'sameh',
  'hany',
  'hani',
  'nabil',
  'fady',
  'fadi',
  'mina',
  'girgis',
  'abanoub',
  'bishoy',
  'kirollos',
  'maged',
  'medhat',
  'ashraf',
  'ayman',
  'ehab',
  'ihab',
  'amir',
  'amgad',
  'anwar',
  'osama',
  'usama',
  'hamza',
  'bilal',
  'belal',
  'bassem',
  'basel',
  'bahaa',
  'gamal',
  'hatem',
  'hazem',
  'hossam',
  'hamdy',
  'saeed',
  'saad',
  'samy',
  'sami',
  'seif',
  'selim',
  'soliman',
  'samir',
  'shady',
  'shadi',
  'salah',
  'safwat',
  'adel',
  'atef',
  'abdallah',
  'abdullah',
  'abdelrahman',
  'essam',
  'alaa',
  'emad',
  'fares',
  'farouk',
  'fathy',
  'fouad',
  'farid',
  'faisal',
  'kamel',
  'kamal',
  'loay',
  'maher',
  'marwan',
  'moataz',
  'mamdouh',
  'mansour',
  'mounir',
  'mohab',
  'mohanad',
  'nader',
  'nasser',
  'hady',
  'hesham',
  'hisham',
  'haitham',
  'haytham',
  'wael',
  'wagdy',
  'waheed',
  'waseem',
  'yassin',
  'yaseen',
  'yahia',
  'yahya',
  'adam',
  'eyad',
  'iyad',
  'asser',
  'anas',
  'badr',
  'rayan',
  'zain',
  'zein',
  'malek',
  'mourad',
  'murad',
  'john',
  'david',
  'michael',
  'mark',
  'peter',
  'george',
  'andrew',
]);

const FEMALE_NAMES = new Set([
  'ساره',
  'مريم',
  'فاطمه',
  'نورهان',
  'ياسمين',
  'ندي',
  'نهي',
  'دينا',
  'رانيا',
  'مني',
  'مي',
  'مها',
  'هدي',
  'سلمي',
  'ايه',
  'ايمان',
  'اسماء',
  'امل',
  'اسراء',
  'شيماء',
  'دعاء',
  'سمر',
  'رضوي',
  'هبه',
  'بسنت',
  'فريده',
  'ملك',
  'لجين',
  'حبيبه',
  'جنات',
  'جني',
  'فرح',
  'ريم',
  'تقي',
  'نسمه',
  'رحمه',
  'هاجر',
  'سحر',
  'سميه',
  'عائشه',
  'خديجه',
  'زينب',
  'رقيه',
  'عبير',
  'غاده',
  'نجلاء',
  'حنان',
  'سوزان',
  'مارينا',
  'ماري',
  'كريستين',
  'دميانه',
  'نانسي',
  'نيفين',
  'ريهام',
  'رنا',
  'نرمين',
  'شيرين',
  'اميره',
  'سماح',
  'سهي',
  'ابتسام',
  'وفاء',
  'صفاء',
  'مروه',
  'سلوي',
  'لبني',
  'داليا',
  'عبله',
  'علا',
  'سوسن',
  'ايناس',
  'انجي',
  'مايا',
  'يارا',
  'تارا',
  'ليلي',
  'اماني',
  'اميمه',
  'بثينه',
  'بسمه',
  'تسنيم',
  'جميله',
  'جيهان',
  'حلا',
  'حلوي',
  'خلود',
  'دارين',
  'دره',
  'رباب',
  'رحاب',
  'رغد',
  'رشا',
  'رغده',
  'روان',
  'روضه',
  'ريماس',
  'زهره',
  'ساره',
  'سجي',
  'سندس',
  'سهام',
  'سيرين',
  'شاديه',
  'شروق',
  'شذي',
  'شهد',
  'صابرين',
  'ضحى',
  'ضحي',
  'عاليه',
  'عزه',
  'عطيات',
  'عفاف',
  'علياء',
  'غدير',
  'فاتن',
  'فايزه',
  'فدوي',
  'فيروز',
  'فيفي',
  'كاميليا',
  'كارما',
  'كارمن',
  'كنزي',
  'كندا',
  'لمياء',
  'لميس',
  'لينا',
  'ليان',
  'ماجده',
  'ماجي',
  'ماريان',
  'مادلين',
  'نيره',
  'ميرنا',
  'ميرفت',
  'ميساء',
  'مياده',
  'ناريمان',
  'نادين',
  'ناديه',
  'ناهد',
  'نجوي',
  'نرمين',
  'نهال',
  'نهاد',
  'نوال',
  'نورا',
  'نوران',
  'هايدي',
  'هاله',
  'لبنه',
  'هند',
  'هنادي',
  'هيام',
  'هيفاء',
  'وداد',
  'ورود',
  'ولاء',
  'يمني',
  'يسرا',
  // Latin / English transliterations
  'sara',
  'sarah',
  'mariam',
  'maryam',
  'fatma',
  'fatima',
  'nourhan',
  'norhan',
  'yasmin',
  'yasmine',
  'nada',
  'noha',
  'dina',
  'rania',
  'mona',
  'mai',
  'may',
  'maha',
  'hoda',
  'salma',
  'aya',
  'eman',
  'iman',
  'asmaa',
  'amal',
  'esraa',
  'israa',
  'shaimaa',
  'doaa',
  'samar',
  'radwa',
  'heba',
  'basant',
  'bassant',
  'farida',
  'malak',
  'logain',
  'lujain',
  'habiba',
  'jannat',
  'jana',
  'farah',
  'reem',
  'toqa',
  'toka',
  'nesma',
  'rahma',
  'hagar',
  'hajar',
  'sahar',
  'somaya',
  'aisha',
  'khadija',
  'zeinab',
  'zainab',
  'roqaya',
  'abeer',
  'ghada',
  'naglaa',
  'hanan',
  'suzan',
  'marina',
  'mary',
  'christine',
  'nancy',
  'nevine',
  'riham',
  'reham',
  'rana',
  'nermeen',
  'sherine',
  'amira',
  'samah',
  'soha',
  'ebtisam',
  'wafaa',
  'safaa',
  'marwa',
  'salwa',
  'lobna',
  'dalia',
  'ola',
  'sawsan',
  'enas',
  'inas',
  'engy',
  'ingy',
  'maya',
  'yara',
  'tara',
  'laila',
  'layla',
  'amany',
  'amani',
  'basma',
  'tasneem',
  'gehan',
  'jihan',
  'hala',
  'kholoud',
  'dareen',
  'rabab',
  'rehab',
  'rasha',
  'rowan',
  'rawan',
  'shorouk',
  'shahd',
  'sabreen',
  'doha',
  'aliaa',
  'azza',
  'afaf',
  'faten',
  'fadwa',
  'fayrouz',
  'karma',
  'kenzy',
  'lamiaa',
  'lamees',
  'lina',
  'layan',
  'magda',
  'marian',
  'mirna',
  'mervat',
  'mayada',
  'nadine',
  'nadia',
  'nahed',
  'nagwa',
  'nehal',
  'nehad',
  'nawal',
  'noura',
  'nora',
  'nouran',
  'haidy',
  'heidi',
  'hend',
  'hind',
  'walaa',
  'yomna',
  'yosra',
  'yousra',
  'jessica',
  'emily',
  'sophia',
  'olivia',
]);

const FEMALE_TITLES = new Set(['مدام', 'انسه', 'استاذه', 'دكتوره', 'مهندسه', 'الحاجه', 'ام', 'mrs', 'ms', 'miss', 'madam']);
const MALE_TITLES = new Set(['استاذ', 'باشا', 'كابتن', 'الحاج', 'الحج', 'ابو', 'mr']);
const NEUTRAL_TITLES = new Set(['دكتور', 'مهندس', 'د', 'م', 'ا', 'dr', 'eng', 'prof']);

/** Infer customer gender from a customer name or title+name string. */
export function detectGenderFromName(rawName: string | null | undefined): CustomerGender {
  if (!rawName || typeof rawName !== 'string') return 'UNKNOWN';
  const rawTokens = rawName
    .trim()
    .split(/[\s,،._-]+/)
    .map(normalizeNameToken)
    .filter(Boolean);
  if (!rawTokens.length) return 'UNKNOWN';

  const first = rawTokens[0];
  if (FEMALE_TITLES.has(first)) return 'FEMALE';
  if (MALE_TITLES.has(first)) return 'MALE';

  const given = NEUTRAL_TITLES.has(first) ? rawTokens[1] : first;
  if (!given || UNISEX_NAMES.has(given)) return 'UNKNOWN';

  // Compound "عبد ..." names written with a space (e.g. "عبد الرحمن")
  if (given === 'عبد' && rawTokens.length > 1) return 'MALE';

  if (FEMALE_NAMES.has(given)) return 'FEMALE';
  if (MALE_NAMES.has(given)) return 'MALE';
  return 'UNKNOWN';
}

// Arabic boundary helpers (JS \b only works on ASCII \w)
const AR_START = '(?:^|[^\\u0600-\\u06FFa-zA-Z0-9_])';
const AR_END = '(?![\\u0600-\\u06FFa-zA-Z0-9_])';

// Spousal / relational cues that identify the speaker's own gender regardless of product gender
const MALE_SPOUSAL_RE = new RegExp(`${AR_START}(?:مراتي|زوجتي|خطيبتي|حرمي|للمدام عندي)${AR_END}`, 'i');
const FEMALE_SPOUSAL_RE = new RegExp(`${AR_START}(?:جوزي|زوجي|خطيبي|ابو عيالي)${AR_END}`, 'i');

// Self-introduction with gendered title or name
const SELF_INTRO_TITLE_FEMALE_RE = new RegExp(
  `${AR_START}(?:انا|اسمي|معاك[ي]?)\\s+(?:مدام|انسة|انسه|استاذة|استاذه|دكتورة|دكتوره|مهندسة|مهندسه|الحاجة|الحاجه|ام\\s+\\S+)${AR_END}`,
);
const SELF_INTRO_TITLE_MALE_RE = new RegExp(
  `${AR_START}(?:انا|اسمي|معاك[ي]?)\\s+(?:استاذ|باشا|كابتن|دكتور|مهندس|الحاج|الحج|ابو\\s+\\S+)${AR_END}`,
);
const SELF_INTRO_NAME_RE = new RegExp(
  `${AR_START}(?:انا\\s+اسمي|اسمي)(?:\\s+هو)?\\s+([\\u0600-\\u06FFa-zA-Z]{2,20})${AR_END}`,
);

// Third-person subject phrases to strip before checking standalone participles
const THIRD_PERSON_FEM_SUBJECT_RE = new RegExp(
  `${AR_START}(?:هي|بنتي|اختي|امي|مامتي|ماما|صاحبتي|زميلتي|خالتي|عمتي|جدتي|تيتا|المدام|مدام|الشنطة|الشنطه|القطعة|القطعه|العباية|العبايه|البلوزة|البلوزه|الدرجة|الدرجه)\\s+(?:كانت\\s+|مش\\s+|برضو\\s+|كمان\\s+)?(?:عايزة|عايزه|عاوزة|عاوزه|محتاجة|محتاجه|محتارة|محتاره|موجودة|موجوده|جاهزة|جاهزه)${AR_END}`,
  'g',
);
const THIRD_PERSON_MASC_SUBJECT_RE = new RegExp(
  `${AR_START}(?:هو|ابني|اخويا|ابويا|بابا|صاحبي|زميلي|خالي|عمي|جدي|الراجل|العميل|المندوب|الموديل|المقاس|اللون|الطلب|الاوردر|القميص|البنطلون|الجاكيت|الفستان|الشحن)\\s+(?:كان\\s+|مش\\s+|برضو\\s+|كمان\\s+)?(?:عايز|عاوز|محتاج|محتار|موجود|جاهز)${AR_END}`,
  'g',
);

// 1st-person pronoun + feminine adjective/participle
const FIRST_PERSON_FEM_RE = new RegExp(
  `${AR_START}(?:انا|اناا+|كنت|بقيت|لسه)\\s+(?:بس\\s+|كمان\\s+|والله\\s+|مش\\s+)?(?:عايزة|عايزه|عاوزة|عاوزه|محتاجة|محتاجه|محتارة|محتاره|مهتمة|مهتمه|متاكدة|متاكده|حامل|عروسة|عروسه|خايفة|خايفه|زعلانة|زعلانه|مبسوطة|مبسوطه|جاهزة|جاهزه|موجودة|موجوده|مشغولة|مشغوله|قلقانة|قلقانه|دايخة|دايخه|عارفة|عارفه|شايفة|شايفه|فاهمة|فاهمه)${AR_END}`,
);

// 1st-person pronoun + masculine adjective/participle
const FIRST_PERSON_MASC_RE = new RegExp(
  `${AR_START}(?:انا|اناا+|كنت|بقيت|لسه)\\s+(?:بس\\s+|كمان\\s+|والله\\s+|مش\\s+)?(?:عايز|عاوز|محتاج|محتار|مهتم|متاكد|خايف|زعلان|مبسوط|جاهز|موجود|مشغول|قلقان|دايخ|عارف|شايف|فاهم)${AR_END}`,
);

// Unambiguously feminine forms:
// - explicit ة forms (عايزة, عاوزة, محتاجة, محتارة, مهتمة, متاكدة)
// - long-vowel feminine object-pronoun forms (عايزاه, عايزاها, عاوزاه, عاوزاها, محتاجاه, محتاجاها, شايفاه, شايفاها)
// - ه-spelling (عايزه, عاوزه, محتاجه, محتاره) when followed by a complement word (so it cannot mean masculine "عايزُه" at end of sentence)
const STANDALONE_FEM_EXPLICIT_RE = new RegExp(
  `${AR_START}(?:عايزة|عاوزة|محتاجة|محتارة|مهتمة|متاكدة|عايزاه|عايزاها|عاوزاه|عاوزاها|محتاجاه|محتاجاها|شايفاه|شايفاها)${AR_END}`,
);
const STANDALONE_FEM_HEH_WITH_COMPLEMENT_RE = new RegExp(
  `${AR_START}(?:عايزه|عاوزه|محتاجه|محتاره)\\s+[\\u0600-\\u06FF]{2,}`,
);

// Unambiguously masculine singular forms (exact word boundary so it never matches عايزة/عايزين/عايزه)
const STANDALONE_MASC_RE = new RegExp(
  `${AR_START}(?:عايز|عاوز|محتاج|محتار|مهتم|متاكد|عايزها|عاوزها|محتاجها)${AR_END}`,
);

// Arabizi cues
const ARABIZI_SPOUSAL_MALE_RE = /\b(?:meraty|mraty|zawgaty|khatibty|5atibty)\b/i;
const ARABIZI_SPOUSAL_FEMALE_RE = /\b(?:gozy|gawzy|khatiby|5atiby)\b/i;
const ARABIZI_FEM_RE = /(?<!\b(?:heya|hya|benty|benti|okhty|o5ty|mama|mamty)\s+)\b(?:(?:ana|kont)\s+)?(?:3ayza|3awza|me7taga|m7taga|mo7tara|m7tara)\b/i;
const ARABIZI_MASC_RE = /(?<!\b(?:howa|hwa|ebny|ebni|akhouya|a5oya|baba)\s+)\b(?:(?:ana|kont)\s+)?(?:3ayez|3ayz|3awez|3awz|me7tag|m7tag|mo7tar|m7tar)\b/i;

/**
 * Infer customer gender from a single inbound customer message (Arabic script or Arabizi).
 * Returns 'UNKNOWN' unless there is a clear first-person gender marker.
 */
export function detectGenderFromText(rawText: string | null | undefined): CustomerGender {
  if (!rawText || typeof rawText !== 'string') return 'UNKNOWN';
  const text = normalizeTextForCues(rawText);
  if (!text) return 'UNKNOWN';

  // 1. Spousal cues (e.g. "عايز هدية لمراتي" or "مراتي عايزة فستان" -> speaker is MALE)
  if (MALE_SPOUSAL_RE.test(text) || ARABIZI_SPOUSAL_MALE_RE.test(text)) return 'MALE';
  if (FEMALE_SPOUSAL_RE.test(text) || ARABIZI_SPOUSAL_FEMALE_RE.test(text)) return 'FEMALE';

  // 2. Explicit self-intro with title or name
  if (SELF_INTRO_TITLE_FEMALE_RE.test(text)) return 'FEMALE';
  if (SELF_INTRO_TITLE_MALE_RE.test(text)) return 'MALE';
  const nameMatch = text.match(SELF_INTRO_NAME_RE);
  if (nameMatch?.[1]) {
    const byName = detectGenderFromName(nameMatch[1]);
    if (byName !== 'UNKNOWN') return byName;
  }

  // 3. Strip 3rd-person subject clauses before checking participles
  const cleaned = text.replace(THIRD_PERSON_FEM_SUBJECT_RE, ' ').replace(THIRD_PERSON_MASC_SUBJECT_RE, ' ');

  // 4. Explicit "أنا + participle/adjective"
  const hasFirstFem = FIRST_PERSON_FEM_RE.test(cleaned);
  const hasFirstMasc = FIRST_PERSON_MASC_RE.test(cleaned);
  if (hasFirstFem && !hasFirstMasc) return 'FEMALE';
  if (hasFirstMasc && !hasFirstFem) return 'MALE';

  // 5. Standalone shopping participles (e.g. "عايزة اعرف المقاس", "عايز قميص")
  const hasFem = STANDALONE_FEM_EXPLICIT_RE.test(cleaned) || STANDALONE_FEM_HEH_WITH_COMPLEMENT_RE.test(cleaned);
  const hasMasc = STANDALONE_MASC_RE.test(cleaned);
  if (hasFem && !hasMasc) return 'FEMALE';
  if (hasMasc && !hasFem) return 'MALE';

  // 6. Arabizi cues
  const hasArabiziFem = ARABIZI_FEM_RE.test(cleaned);
  const hasArabiziMasc = ARABIZI_MASC_RE.test(cleaned);
  if (hasArabiziFem && !hasArabiziMasc) return 'FEMALE';
  if (hasArabiziMasc && !hasArabiziFem) return 'MALE';

  return 'UNKNOWN';
}

/**
 * Resolve customer gender from all available conversation signals:
 * 1. Explicit first-person linguistic cues in the current message
 * 2. Previously persisted `slots.customer_gender`
 * 3. First-person linguistic cues in recent inbound history (newest first)
 * 4. Customer name in `slots.customer_name`
 */
export function resolveCustomerGender(p: {
  slots?: Record<string, unknown> | null;
  text?: string | null;
  history?: HistoryMessage[] | null;
}): CustomerGender {
  const fromCurrentText = detectGenderFromText(p.text);
  if (fromCurrentText !== 'UNKNOWN') return fromCurrentText;

  const slotGender = p.slots?.customer_gender;
  if (slotGender === 'FEMALE' || slotGender === 'MALE') return slotGender;

  if (p.history?.length) {
    for (let i = p.history.length - 1; i >= 0; i--) {
      const msg = p.history[i];
      if (msg.direction !== 'INBOUND') continue;
      const g = detectGenderFromText(msg.normalizedText || msg.rawText);
      if (g !== 'UNKNOWN') return g;
    }
  }

  const slotName = typeof p.slots?.customer_name === 'string' ? p.slots.customer_name : null;
  const fromName = detectGenderFromName(slotName);
  if (fromName !== 'UNKNOWN') return fromName;

  return 'UNKNOWN';
}
