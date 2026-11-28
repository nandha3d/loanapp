const VOICE_ENABLED_STORAGE_KEY = 'zolofund:chit-bid-voice-enabled';
const CUSTOMER_VOICE_LANG_STORAGE_KEY = 'zolofund:chit-customer-voice-lang';

export const BID_VOICE_LANGUAGES = [
  { code: 'en', label: 'EN (IN)', bcp47: 'en-IN' },
  { code: 'ta', label: 'தமிழ்', bcp47: 'ta-IN' },
  { code: 'ml', label: 'മലയാളം', bcp47: 'ml-IN' },
  { code: 'hi', label: 'हिन्दी', bcp47: 'hi-IN' },
  { code: 'te', label: 'తెలుగు', bcp47: 'te-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ', bcp47: 'kn-IN' },
] as const;

export type BidVoiceLanguageCode = (typeof BID_VOICE_LANGUAGES)[number]['code'];

export function normalizeVoiceLanguageCode(raw?: string | null): BidVoiceLanguageCode {
  const code = String(raw ?? '')
    .toLowerCase()
    .slice(0, 2);
  return BID_VOICE_LANGUAGES.some((l) => l.code === code) ? (code as BidVoiceLanguageCode) : 'en';
}

export function voiceLanguageBcp47(code?: string | null): string {
  const norm = normalizeVoiceLanguageCode(code);
  return BID_VOICE_LANGUAGES.find((l) => l.code === norm)?.bcp47 ?? 'en-IN';
}

const SPEECH_NUMBER_UNITS: Record<
  BidVoiceLanguageCode,
  { crore: string; lakh: string; thousand: string; hundred: string }
> = {
  en: { crore: 'crore', lakh: 'lakh', thousand: 'thousand', hundred: 'hundred' },
  ta: { crore: 'கோடி', lakh: 'லட்சம்', thousand: 'ஆயிரம்', hundred: 'நூறு' },
  ml: { crore: 'കോടി', lakh: 'ലക്ഷം', thousand: 'ആയിരം', hundred: 'നൂറ്' },
  hi: { crore: 'करोड़', lakh: 'लाख', thousand: 'हजार', hundred: 'सौ' },
  te: { crore: 'కోటి', lakh: 'లక్ష', thousand: 'వేలు', hundred: 'వందలు' },
  kn: { crore: 'ಕೋಟಿ', lakh: 'ಲಕ್ಷ', thousand: 'ಸಾವಿರ', hundred: 'ನೂರು' },
};

export type RoomChatLocalizedStrings = {
  placeholderBidding: string;
  placeholderGeneral: string;
  sendBtn: string;
  staffOnlyLabel: string;
  quickCalloutsAuction: string[];
  quickCalloutsLottery: string[];
  quickCalloutsSealed: string[];
  quickCalloutsOther: string[];
};

const ROOM_CHAT_STRINGS: Record<BidVoiceLanguageCode, RoomChatLocalizedStrings> = {
  en: {
    placeholderBidding: 'Type message or bid amount (e.g. 92500)…',
    placeholderGeneral: 'Message members or announce floor…',
    sendBtn: 'Send',
    staffOnlyLabel: 'Staff only',
    quickCalloutsAuction: ['Going once!', 'Going twice!', 'Any lower bid?', 'Last 30 seconds'],
    quickCalloutsLottery: ['Drum ready!', 'Spinning shortly', 'All members verified'],
    quickCalloutsSealed: ['Tender window open', 'Submit sealed bid', 'Closing shortly'],
    quickCalloutsOther: ['Attendance confirmed', 'Ready for cycle', 'Update posted'],
  },
  ta: {
    placeholderBidding: 'செய்தி அல்லது ஏலத் தொகை (எ.கா. 92500)…',
    placeholderGeneral: 'உறுப்பினர்களுக்கு செய்தி அனுப்பவும்…',
    sendBtn: 'அனுப்பு',
    staffOnlyLabel: 'ஊழியர்களுக்கு மட்டும்',
    quickCalloutsAuction: ['ஒரு தரம்!', 'இரண்டு தரம்!', 'குறைவான ஏலம் உண்டா?', 'கடைசி 30 வினாடிகள்'],
    quickCalloutsLottery: ['குலுக்கல் தயார்!', 'சிறிது நேரத்தில் சுழற்சி', 'உறுப்பினர்கள் சரிபார்ப்பு முடிந்தது'],
    quickCalloutsSealed: ['சீல் செய்யப்பட்ட ஏலம் திறந்துள்ளது', 'ஏலம் சமர்ப்பிக்கவும்', 'விரைவில் முடியும்'],
    quickCalloutsOther: ['வருகை உறுதி செய்யப்பட்டது', 'சுற்றுக்கு தயார்', 'தகவல் பகிரப்பட்டது'],
  },
  ml: {
    placeholderBidding: 'സന്ദേശം അല്ലെങ്കിൽ ലേലത്തുക (ഉദാ. 92500)…',
    placeholderGeneral: 'അംഗങ്ങൾക്ക് സന്ദേശം അയക്കുക…',
    sendBtn: 'അയയ്ക്കുക',
    staffOnlyLabel: 'സ്റ്റാഫ് മാത്രം',
    quickCalloutsAuction: ['ഒന്നാം വിളി!', 'രണ്ടാം വിളി!', 'ഇതിലും കുറഞ്ഞ വിളിയുണ്ടോ?', 'അവസാന 30 സെക്കൻഡ്'],
    quickCalloutsLottery: ['നറുക്കെടുപ്പ് തയ്യാർ!', 'ഉടൻ കറക്കുന്നു', 'എല്ലാ അംഗങ്ങളും സ്ഥിരീകരിച്ചു'],
    quickCalloutsSealed: ['സീൽഡ് ടെൻഡർ തുറന്നു', 'ലേലം സമർപ്പിക്കുക', 'ഉടൻ അവസാനിക്കും'],
    quickCalloutsOther: ['ഹാജർ സ്ഥിരീകരിച്ചു', 'തയ്യാറാണ്', 'അപ്ഡേറ്റ് നൽകി'],
  },
  hi: {
    placeholderBidding: 'संदेश या बोली राशि लिखें (जैसे 92500)…',
    placeholderGeneral: 'सदस्यों को संदेश भेजें…',
    sendBtn: 'भेजें',
    staffOnlyLabel: 'केवल स्टाफ',
    quickCalloutsAuction: ['पहली आवाज़!', 'दूसरी आवाज़!', 'कोई और कम बोली?', 'अंतिम 30 सेकंड'],
    quickCalloutsLottery: ['लॉटरी ड्रम तैयार है!', 'अभी शुरू हो रहा है', 'सभी सदस्य सत्यापित'],
    quickCalloutsSealed: ['सील्ड टेंडर खुला है', 'बोली जमा करें', 'जल्द बंद होगा'],
    quickCalloutsOther: ['उपस्थिति दर्ज', 'चक्र तैयार है', 'सूचना साझा की गई'],
  },
  te: {
    placeholderBidding: 'సందేశం లేదా బిడ్ మొత్తం (ఉదా. 92500)…',
    placeholderGeneral: 'సభ్యులకు సందేశం పంపండి…',
    sendBtn: 'పంపండి',
    staffOnlyLabel: 'సిబ్బంది మాత్రమే',
    quickCalloutsAuction: ['మొదటి పిలుపు!', 'రెండవ పిలుపు!', 'ఇంకా తక్కువ బిడ్ ఉందా?', 'చివరి 30 సెకన్లు'],
    quickCalloutsLottery: ['డ్రమ్ సిద్ధం!', 'త్వరలో తిప్పుతాము', 'అందరూ నిర్ధారించబడ్డారు'],
    quickCalloutsSealed: ['సీల్డ్ టెండర్ తెరవబడింది', 'బిడ్ సమర్పించండి', 'త్వరలో ముగుస్తుంది'],
    quickCalloutsOther: ['హాజరు నమోదైంది', 'సైకిల్ సిద్ధం', 'సమాచారం ఇవ్వబడింది'],
  },
  kn: {
    placeholderBidding: 'ಸಂದೇಶ ಅಥವಾ ಬಿಡ್ ಮೊತ್ತ (ಉದಾ. 92500)…',
    placeholderGeneral: 'ಸದಸ್ಯರಿಗೆ ಸಂದೇಶ ಕಳುಹಿಸಿ…',
    sendBtn: 'ಕಳುಹಿಸಿ',
    staffOnlyLabel: 'ಸಿಬ್ಬಂದಿಗೆ ಮಾತ್ರ',
    quickCalloutsAuction: ['ಒಂದನೇ ಕೂಗು!', 'ಎರಡನೇ ಕೂಗು!', 'ಇನ್ನೂ ಕಡಿಮೆ ಬಿಡ್ ಇದೆಯೇ?', 'ಕೊನೆಯ 30 ಸೆಕೆಂಡುಗಳು'],
    quickCalloutsLottery: ['ಡ್ರಮ್ ಸಿದ್ಧ!', 'ಶೀಘ್ರದಲ್ಲಿ ತಿರುಗಲಿದೆ', 'ಎಲ್ಲಾ ಸದಸ್ಯರು ಪರಿಶೀಲಿತರು'],
    quickCalloutsSealed: ['ಸೀಲ್ಡ್ ಟೆಂಡರ್ ತೆರೆದಿದೆ', 'ಬಿಡ್ ಸಲ್ಲಿಸಿ', 'ಶೀಘ್ರದಲ್ಲಿ ಮುಕ್ತಾಯ'],
    quickCalloutsOther: ['ಹಾಜರಾತಿ ಖಚಿತ', 'ಚಕ್ರಕ್ಕೆ ಸಿದ್ಧ', 'ಮಾಹಿತಿ ನೀಡಲಾಗಿದೆ'],
  },
};

export function getRoomChatStrings(lang?: string | null): RoomChatLocalizedStrings {
  return ROOM_CHAT_STRINGS[normalizeVoiceLanguageCode(lang)];
}

let ttsProbePromise: Promise<{ configured: boolean; provider: string | null }> | null = null;
let cachedTtsConfig: { configured: boolean; provider: string | null } | null = null;
let lastFailedProbeAt = 0;
let sharedVoiceCtx: AudioContext | null = null;
let activeBufferSource: AudioBufferSourceNode | null = null;
let activeHtmlAudio: HTMLAudioElement | null = null;
let speakRequestSeq = 0;

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedVoiceCtx || sharedVoiceCtx.state === 'closed') {
    sharedVoiceCtx = new Ctor();
  }
  if (sharedVoiceCtx.state === 'suspended') {
    void sharedVoiceCtx.resume().catch(() => {});
  }
  return sharedVoiceCtx;
}

/**
 * Extracts a crisp first/given name for fast spoken auction callouts
 * (e.g. "S. Rajesh" -> "Rajesh", "Oviya Kandasamy" -> "Oviya").
 */
export function extractShortBidderName(fullName?: string | null): string {
  const clean = String(fullName ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!clean) return '';
  const tokens = clean.split(' ').filter(Boolean);
  for (const token of tokens) {
    const stripped = token.replace(/\.$/, '');
    if (stripped.length > 1) return stripped;
  }
  return tokens[0] ?? '';
}

const TA_UNITS = ['பூஜ்யம்', 'ஒன்று', 'இரண்டு', 'மூன்று', 'நான்கு', 'ஐந்து', 'ஆறு', 'ஏழு', 'எட்டு', 'ஒன்பது'] as const;
const TA_TEENS = ['பத்து', 'பதினொன்று', 'பன்னிரண்டு', 'பதின்மூன்று', 'பதினான்கு', 'பதினைந்து', 'பதினாறு', 'பதினேழு', 'பதினெட்டு', 'பத்தொன்பது'] as const;
const TA_TENS_EXACT = ['', '', 'இருபது', 'முப்பது', 'நாற்பது', 'ஐம்பது', 'அறுபது', 'எழுபது', 'எண்பது', 'தொண்ணூறு'] as const;
const TA_TENS_CONT = ['', '', 'இருபத்து', 'முப்பத்து', 'நாற்பத்து', 'ஐம்பத்து', 'அறுபத்து', 'எழுபத்து', 'எண்பத்து', 'தொண்ணூற்று'] as const;
const TA_HUNDREDS_EXACT = ['', 'நூறு', 'இருநூறு', 'முன்னூறு', 'நானூறு', 'ஐந்நூறு', 'அறுநூறு', 'எழுநூறு', 'எண்ணூறு', 'தொள்ளாயிரம்'] as const;
const TA_HUNDREDS_CONT = ['', 'நூற்று', 'இருநூற்று', 'முன்னூற்று', 'நானூற்று', 'ஐந்நூற்று', 'அறுநூற்று', 'எழுநூற்று', 'எண்ணூற்று', 'தொள்ளாயிரத்து'] as const;

function tamilUnder100(n: number): string {
  if (n < 10) return TA_UNITS[n];
  if (n < 20) return TA_TEENS[n - 10];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? TA_TENS_EXACT[t] : `${TA_TENS_CONT[t]} ${TA_UNITS[u]}`;
}

function tamilJoinThousand(k: number, hasRemainder: boolean): string {
  if (k === 1) return hasRemainder ? 'ஆயிரத்து' : 'ஆயிரம்';
  const tail = hasRemainder ? '\u0BBEயிரத்து' : '\u0BBEயிரம்';
  if (k === 90) return `தொண்ணூற்ற${tail}`;
  return `${tamilUnder100(k).replace(/\u0BC1$/, '')}${tail}`;
}

function tamilUnder1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0) return tamilUnder100(r);
  if (r === 0) return TA_HUNDREDS_EXACT[h];
  return `${TA_HUNDREDS_CONT[h]} ${tamilUnder100(r)}`;
}

function formatTamilNumberForSpeech(n: number): string {
  if (n === 0) return TA_UNITS[0];
  const parts: string[] = [];
  let rem = n;

  const crores = Math.floor(rem / 10_000_000);
  if (crores > 0) {
    rem %= 10_000_000;
    const prefix = crores === 1 ? 'ஒரு' : formatTamilNumberForSpeech(crores);
    parts.push(`${prefix} ${rem > 0 ? 'கோடியே' : 'கோடி'}`);
  }
  const lakhs = Math.floor(rem / 100_000);
  if (lakhs > 0) {
    rem %= 100_000;
    const prefix = lakhs === 1 ? 'ஒரு' : tamilUnder100(lakhs);
    parts.push(`${prefix} ${rem > 0 ? 'லட்சத்து' : 'லட்சம்'}`);
  }
  const thousands = Math.floor(rem / 1000);
  if (thousands > 0) {
    rem %= 1000;
    parts.push(tamilJoinThousand(thousands, rem > 0));
  }
  if (rem > 0) {
    parts.push(tamilUnder1000(rem));
  }
  return parts.join(' ');
}

const ML_UNITS = ['പൂജ്യം', 'ഒന്ന്', 'രണ്ട്', 'മൂന്ന്', 'നാല്', 'അഞ്ച്', 'ആറ്', 'ഏഴ്', 'എട്ട്', 'ഒമ്പത്'] as const;
const ML_TEENS = ['പത്ത്', 'പതിനൊന്ന്', 'പന്ത്രണ്ട്', 'പതിമൂന്ന്', 'പതിനാല്', 'പതിനഞ്ച്', 'പതിനാറ്', 'പതിനേഴ്', 'പതിനെട്ട്', 'പത്തൊമ്പത്'] as const;
const ML_TENS_EXACT = ['', '', 'ഇരുപത്', 'മുപ്പത്', 'നാൽപ്പത്', 'അമ്പത്', 'അറുപത്', 'എഴുപത്', 'എൺപത്', 'തൊണ്ണൂറ്'] as const;
const ML_TENS_CONT = ['', '', 'ഇരുപത്തി', 'മുപ്പത്തി', 'നാൽപ്പത്തി', 'അമ്പത്തി', 'അറുപത്തി', 'എഴുപത്തി', 'എൺപത്തി', 'തൊണ്ണൂറ്റി'] as const;
const ML_HUNDREDS_EXACT = ['', 'നൂറ്', 'ഇരുന്നൂറ്', 'മുന്നൂറ്', 'നാനൂറ്', 'അഞ്ഞൂറ്', 'അറുന്നൂറ്', 'എഴുന്നൂറ്', 'എണ്ണൂറ്', 'തൊള്ളായിരം'] as const;
const ML_HUNDREDS_CONT = ['', 'നൂറ്റി', 'ഇരുന്നൂറ്റി', 'മുന്നൂറ്റി', 'നാനൂറ്റി', 'അഞ്ഞൂറ്റി', 'അറുന്നൂറ്റി', 'എഴുന്നൂറ്റി', 'എണ്ണൂറ്റി', 'തൊള്ളായിരത്തി'] as const;

function mlUnder100(n: number): string {
  if (n < 10) return ML_UNITS[n];
  if (n < 20) return ML_TEENS[n - 10];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? ML_TENS_EXACT[t] : `${ML_TENS_CONT[t]} ${ML_UNITS[u]}`;
}

function mlJoinThousand(k: number, hasRemainder: boolean): string {
  if (k === 1) return hasRemainder ? 'ആയിരത്തി' : 'ആയിരം';
  if (k === 10) return hasRemainder ? 'പതിനായിരത്തി' : 'പതിനായിരം';
  const tail = hasRemainder ? '\u0D3Eയിരത്തി' : '\u0D3Eയിരം';
  return `${mlUnder100(k).replace(/\u0D4D$/, '')}${tail}`;
}

function mlUnder1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0) return mlUnder100(r);
  if (r === 0) return ML_HUNDREDS_EXACT[h];
  return `${ML_HUNDREDS_CONT[h]} ${mlUnder100(r)}`;
}

function formatMalayalamNumberForSpeech(n: number): string {
  if (n === 0) return ML_UNITS[0];
  const parts: string[] = [];
  let rem = n;

  const crores = Math.floor(rem / 10_000_000);
  if (crores > 0) {
    rem %= 10_000_000;
    const prefix = crores === 1 ? 'ഒരു' : formatMalayalamNumberForSpeech(crores);
    parts.push(`${prefix} കോടി`);
  }
  const lakhs = Math.floor(rem / 100_000);
  if (lakhs > 0) {
    rem %= 100_000;
    const prefix = lakhs === 1 ? 'ഒരു' : mlUnder100(lakhs);
    parts.push(`${prefix} ${rem > 0 ? 'ലക്ഷത്തി' : 'ലക്ഷം'}`);
  }
  const thousands = Math.floor(rem / 1000);
  if (thousands > 0) {
    rem %= 1000;
    parts.push(mlJoinThousand(thousands, rem > 0));
  }
  if (rem > 0) {
    parts.push(mlUnder1000(rem));
  }
  return parts.join(' ');
}

const HI_UNDER_100 = [
  'शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ',
  'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस',
  'बीस', 'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस',
  'तीस', 'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस',
  'चालीस', 'इकतालीस', 'बयालीस', 'तैंतालीस', 'चवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास',
  'पचास', 'इक्यावन', 'बावन', 'तिरेपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ',
  'साठ', 'इकसठ', 'बासठ', 'तिरेसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर',
  'सत्तर', 'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छहत्तर', 'सतहत्तर', 'अठहत्तर', 'उनासी',
  'अस्सी', 'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी',
  'नब्बे', 'इक्यानबे', 'बानवे', 'तिरानवे', 'चौरानवे', 'पचानवे', 'छियानवे', 'सत्तानवे', 'अट्ठानवे', 'निन्यानवे',
] as const;

function formatHindiNumberForSpeech(n: number): string {
  if (n === 0) return HI_UNDER_100[0];
  const parts: string[] = [];
  let rem = n;

  const crores = Math.floor(rem / 10_000_000);
  if (crores > 0) {
    rem %= 10_000_000;
    parts.push(`${crores < 100 ? HI_UNDER_100[crores] : formatHindiNumberForSpeech(crores)} करोड़`);
  }
  const lakhs = Math.floor(rem / 100_000);
  if (lakhs > 0) {
    rem %= 100_000;
    parts.push(`${HI_UNDER_100[lakhs]} लाख`);
  }
  const thousands = Math.floor(rem / 1000);
  if (thousands > 0) {
    rem %= 1000;
    parts.push(`${HI_UNDER_100[thousands]} हजार`);
  }
  const hundreds = Math.floor(rem / 100);
  if (hundreds > 0) {
    rem %= 100;
    parts.push(`${HI_UNDER_100[hundreds]} सौ`);
  }
  if (rem > 0) {
    parts.push(HI_UNDER_100[rem]);
  }
  return parts.join(' ');
}

const TE_UNITS = ['సున్నా', 'ఒకటి', 'రెండు', 'మూడు', 'నాలుగు', 'ఐదు', 'ఆరు', 'ఏడు', 'ఎనిమిది', 'తొమ్మిది'] as const;
const TE_MOD = ['', 'ఒక', 'రెండు', 'మూడు', 'నాలుగు', 'ఐదు', 'ఆరు', 'ఏడు', 'ఎనిమిది', 'తొమ్మిది'] as const;
const TE_TEENS = ['పది', 'పదకొండు', 'పన్నెండు', 'పదమూడు', 'పద్నాలుగు', 'పదిహేను', 'పదహారు', 'పదిహేడు', 'పద్దెనిమిది', 'పందొమ్మిది'] as const;
const TE_TENS = ['', '', 'ఇరవై', 'ముప్పై', 'నలభై', 'యాభై', 'అరవై', 'డెబ్బై', 'ఎనభై', 'తొంభై'] as const;

function teUnder100(n: number): string {
  if (n < 10) return TE_UNITS[n];
  if (n < 20) return TE_TEENS[n - 10];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? TE_TENS[t] : `${TE_TENS[t]} ${TE_UNITS[u]}`;
}

function formatTeluguNumberForSpeech(n: number): string {
  if (n === 0) return TE_UNITS[0];
  const parts: string[] = [];
  let rem = n;

  const crores = Math.floor(rem / 10_000_000);
  if (crores > 0) {
    rem %= 10_000_000;
    if (crores === 1) parts.push('ఒక కోటి');
    else parts.push(`${crores < 100 ? teUnder100(crores) : formatTeluguNumberForSpeech(crores)} ${rem > 0 ? 'కోట్ల' : 'కోట్లు'}`);
  }
  const lakhs = Math.floor(rem / 100_000);
  if (lakhs > 0) {
    rem %= 100_000;
    if (lakhs === 1) parts.push('ఒక లక్ష');
    else parts.push(`${teUnder100(lakhs)} ${rem > 0 ? 'లక్షల' : 'లక్షలు'}`);
  }
  const thousands = Math.floor(rem / 1000);
  if (thousands > 0) {
    rem %= 1000;
    if (thousands === 1) parts.push('వెయ్యి');
    else parts.push(`${teUnder100(thousands)} ${rem > 0 ? 'వేల' : 'వేలు'}`);
  }
  const hundreds = Math.floor(rem / 100);
  if (hundreds > 0) {
    rem %= 100;
    if (hundreds === 1) parts.push(rem > 0 ? 'నూట' : 'వంద');
    else parts.push(`${TE_MOD[hundreds]} ${rem > 0 ? 'వందల' : 'వందలు'}`);
  }
  if (rem > 0) {
    parts.push(teUnder100(rem));
  }
  return parts.join(' ');
}

const KN_UNITS = ['ಸೊನ್ನೆ', 'ಒಂದು', 'ಎರಡು', 'ಮೂರು', 'ನಾಲ್ಕು', 'ಐದು', 'ಆರು', 'ಏಳು', 'ಎಂಟು', 'ಒಂಬತ್ತು'] as const;
const KN_TEENS = ['ಹತ್ತು', 'ಹನ್ನೊಂದು', 'ಹನ್ನೆರಡು', 'ಹದಿಮೂರು', 'ಹದಿನಾಲ್ಕು', 'ಹದಿನೈದು', 'ಹದಿನಾರು', 'ಹದಿನೇಳು', 'ಹದಿನೆಂಟು', 'ಹತ್ತೊಂಬತ್ತು'] as const;
const KN_TENS_EXACT = ['', '', 'ಇಪ್ಪತ್ತು', 'ಮೂವತ್ತು', 'ನಲವತ್ತು', 'ಐವತ್ತು', 'ಅರವತ್ತು', 'ಎಪ್ಪತ್ತು', 'ಎಂಬತ್ತು', 'ತೊಂಬತ್ತು'] as const;
const KN_TENS_CONT = ['', '', 'ಇಪ್ಪತ್ತ', 'ಮೂವತ್ತ', 'ನಲವತ್ತ', 'ಐವತ್ತ', 'ಅರವತ್ತ', 'ಎಪ್ಪತ್ತ', 'ಎಂಬತ್ತ', 'ತೊಂಬತ್ತ'] as const;
const KN_HUNDREDS_EXACT = ['', 'ನೂರು', 'ಇನ್ನೂರು', 'ಮುನ್ನೂರು', 'ನಾಲ್ಕು ನೂರು', 'ಐನೂರು', 'ಆರು ನೂರು', 'ಏಳು ನೂರು', 'ಎಂಟು ನೂರು', 'ಒಂಬೈನೂರು'] as const;
const KN_HUNDREDS_CONT = ['', 'ನೂರಾ', 'ಇನ್ನೂರ', 'ಮುನ್ನೂರ', 'ನಾಲ್ಕು ನೂರ', 'ಐನೂರ', 'ಆರು ನೂರ', 'ಏಳು ನೂರ', 'ಎಂಟು ನೂರ', 'ಒಂಬೈನೂರ'] as const;

function knUnder100(n: number): string {
  if (n < 10) return KN_UNITS[n];
  if (n < 20) return KN_TEENS[n - 10];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? KN_TENS_EXACT[t] : `${KN_TENS_CONT[t]} ${KN_UNITS[u]}`;
}

function formatKannadaNumberForSpeech(n: number): string {
  if (n === 0) return KN_UNITS[0];
  const parts: string[] = [];
  let rem = n;

  const crores = Math.floor(rem / 10_000_000);
  if (crores > 0) {
    rem %= 10_000_000;
    const prefix = crores < 100 ? knUnder100(crores) : formatKannadaNumberForSpeech(crores);
    parts.push(`${prefix} ${rem > 0 ? 'ಕೋಟಿಯ' : 'ಕೋಟಿ'}`);
  }
  const lakhs = Math.floor(rem / 100_000);
  if (lakhs > 0) {
    rem %= 100_000;
    parts.push(`${knUnder100(lakhs)} ${rem > 0 ? 'ಲಕ್ಷದ' : 'ಲಕ್ಷ'}`);
  }
  const thousands = Math.floor(rem / 1000);
  if (thousands > 0) {
    rem %= 1000;
    parts.push(`${knUnder100(thousands)} ${rem > 0 ? 'ಸಾವಿರದ' : 'ಸಾವಿರ'}`);
  }
  const hundreds = Math.floor(rem / 100);
  if (hundreds > 0) {
    rem %= 100;
    parts.push(rem > 0 ? KN_HUNDREDS_CONT[hundreds] : KN_HUNDREDS_EXACT[hundreds]);
  }
  if (rem > 0) {
    parts.push(knUnder100(rem));
  }
  return parts.join(' ');
}

/**
 * Converts rupee amounts into natural spoken Indian grouping in the active language,
 * emitting full compound words in regional Indian languages so Cloud TTS pronounces
 * every number naturally (e.g. ta 94,700 -> "தொண்ணூற்று நான்காயிரத்து எழுநூறு").
 */
export function formatIndianNumberForSpeech(amount: number, lang?: string | null): string {
  const n = Math.max(0, Math.round(Number(amount) || 0));
  const code = normalizeVoiceLanguageCode(lang);
  switch (code) {
    case 'ta':
      return formatTamilNumberForSpeech(n);
    case 'ml':
      return formatMalayalamNumberForSpeech(n);
    case 'hi':
      return formatHindiNumberForSpeech(n);
    case 'te':
      return formatTeluguNumberForSpeech(n);
    case 'kn':
      return formatKannadaNumberForSpeech(n);
    default: {
      if (n === 0) return '0';
      const u = SPEECH_NUMBER_UNITS.en;
      const parts: string[] = [];
      let rem = n;

      const crores = Math.floor(rem / 10_000_000);
      if (crores > 0) {
        parts.push(`${crores} ${u.crore}`);
        rem %= 10_000_000;
      }
      const lakhs = Math.floor(rem / 100_000);
      if (lakhs > 0) {
        parts.push(`${lakhs} ${u.lakh}`);
        rem %= 100_000;
      }
      const thousands = Math.floor(rem / 1000);
      if (thousands > 0) {
        parts.push(`${thousands} ${u.thousand}`);
        rem %= 1000;
      }
      const hundreds = Math.floor(rem / 100);
      if (hundreds > 0) {
        parts.push(`${hundreds} ${u.hundred}`);
        rem %= 100;
      }
      if (rem > 0) {
        parts.push(String(rem));
      }
      return parts.join(' ');
    }
  }
}

export function formatBidVoicePhrase(params: {
  prizeAmount: number;
  memberName?: string | null;
  ticketNo?: string | number | null;
  lang?: string | null;
}): string {
  const safeAmt = Math.max(0, Math.round(Number(params.prizeAmount) || 0));
  const amtText = safeAmt.toLocaleString('en-IN');
  const shortName = extractShortBidderName(params.memberName);
  const actor = shortName || (params.ticketNo != null ? `Ticket ${params.ticketNo}` : 'Member');
  const code = normalizeVoiceLanguageCode(params.lang);

  switch (code) {
    case 'hi':
      return `${amtText}, ${actor} द्वारा`;
    case 'ta':
    case 'te':
    case 'kn':
    case 'ml':
      return `${amtText}, ${actor}`;
    default:
      return `${amtText} by ${actor}`;
  }
}

export function formatBidSpokenPhrase(params: {
  prizeAmount: number;
  memberName?: string | null;
  ticketNo?: string | number | null;
  lang?: string | null;
}): string {
  const code = normalizeVoiceLanguageCode(params.lang);
  const shortName = extractShortBidderName(params.memberName);
  const actor = shortName || (params.ticketNo != null ? `Ticket ${params.ticketNo}` : 'Member');
  const amtWords = formatIndianNumberForSpeech(params.prizeAmount, code);

  switch (code) {
    case 'hi':
      return `${amtWords}, ${actor} द्वारा`;
    case 'ta':
    case 'ml':
    case 'te':
    case 'kn':
      return `${amtWords}, ${actor}`;
    default:
      return `${amtWords} by ${actor}`;
  }
}

export function formatWinnerVoicePhrase(params: {
  prizeAmount: number;
  memberName?: string | null;
  ticketNo?: string | number | null;
  lang?: string | null;
}): string {
  const safeAmt = Math.max(0, Math.round(Number(params.prizeAmount) || 0));
  const code = normalizeVoiceLanguageCode(params.lang);
  const amtWords = formatIndianNumberForSpeech(safeAmt, code);
  const shortName = extractShortBidderName(params.memberName) || 'Member';
  const ticketNo = params.ticketNo != null ? String(params.ticketNo) : '';
  switch (code) {
    case 'ml':
      return `വിറ്റുപോയി! വിജയി${ticketNo ? ` ടിക്കറ്റ് ${ticketNo},` : ''} ${shortName}, ${amtWords}`;
    case 'ta':
      return `விற்பனையானது! வெற்றியாளர்${ticketNo ? ` டிக்கெட் ${ticketNo},` : ''} ${shortName}, ${amtWords}`;
    case 'hi':
      return `बिक गया! विजेता${ticketNo ? ` टिकट ${ticketNo},` : ''} ${shortName}, ${amtWords}`;
    case 'te':
      return `అమ్ముడైంది! విజేత${ticketNo ? ` టికెట్ ${ticketNo},` : ''} ${shortName}, ${amtWords}`;
    case 'kn':
      return `ಮಾರಾಟವಾಗಿದೆ! ವಿಜೇತ${ticketNo ? ` ಟಿಕೆಟ್ ${ticketNo},` : ''} ${shortName}, ${amtWords}`;
    default:
      return `Sold! Winner ${ticketNo ? `Ticket ${ticketNo}, ` : ''}${shortName}, for ${amtWords}`;
  }
}

export function isBidVoiceEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(VOICE_ENABLED_STORAGE_KEY);
    if (stored === '0') return false;
    return true;
  } catch {
    return true;
  }
}

export function setBidVoiceEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VOICE_ENABLED_STORAGE_KEY, enabled ? '1' : '0');
    if (enabled) {
      getOrCreateAudioContext();
    } else {
      stopBidVoicePlayback();
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

/** Optional customer-local voice language preference (only honored if Foreman allows). */
export function getCustomerVoiceLanguageOverride(): BidVoiceLanguageCode | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = window.localStorage.getItem(CUSTOMER_VOICE_LANG_STORAGE_KEY);
    if (!val) return null;
    return BID_VOICE_LANGUAGES.some((l) => l.code === val) ? (val as BidVoiceLanguageCode) : null;
  } catch {
    return null;
  }
}

export function setCustomerVoiceLanguageOverride(code: BidVoiceLanguageCode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUSTOMER_VOICE_LANG_STORAGE_KEY, code);
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

/**
 * Resolves the active speech language cleanly WITHOUT using the app's main Topbar UI language:
 * - Foreman / fixed mode: always uses the room/foreman's configured language (default 'en').
 * - Member-allowed mode: lets a customer override if they picked one; otherwise room language.
 */
export function resolveRoomEffectiveVoiceLang(opts?: {
  roomLanguage?: string | null;
  allowMemberChange?: boolean;
  customerOverride?: string | null;
}): BidVoiceLanguageCode {
  const roomLang = normalizeVoiceLanguageCode(opts?.roomLanguage);
  if (opts?.allowMemberChange && opts.customerOverride) {
    return normalizeVoiceLanguageCode(opts.customerOverride);
  }
  return roomLang;
}

export function stopBidVoicePlayback(): void {
  if (typeof window === 'undefined') return;
  if (activeBufferSource) {
    try {
      activeBufferSource.stop();
      activeBufferSource.disconnect();
    } catch {
      // ignore already-stopped buffer errors
    }
    activeBufferSource = null;
  }
  if (activeHtmlAudio) {
    try {
      activeHtmlAudio.pause();
      activeHtmlAudio.src = '';
    } catch {
      // ignore html audio stop errors
    }
    activeHtmlAudio = null;
  }
}

async function probeServerTts(): Promise<{ configured: boolean; provider: string | null }> {
  if (cachedTtsConfig?.configured) return cachedTtsConfig;
  const now = Date.now();
  if (cachedTtsConfig && !cachedTtsConfig.configured && now - lastFailedProbeAt < 4000) {
    return cachedTtsConfig;
  }
  if (!ttsProbePromise) {
    ttsProbePromise = fetch('/api/chits/tts', { method: 'GET', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { configured: false, provider: null }))
      .then((data) => {
        const next = {
          configured: Boolean(data?.configured),
          provider: typeof data?.provider === 'string' ? data.provider : null,
        };
        cachedTtsConfig = next;
        if (!next.configured) lastFailedProbeAt = Date.now();
        return next;
      })
      .catch(() => {
        lastFailedProbeAt = Date.now();
        cachedTtsConfig = { configured: false, provider: null };
        return cachedTtsConfig;
      })
      .finally(() => {
        ttsProbePromise = null;
      });
  }
  return ttsProbePromise;
}

export async function warmUpBidVoiceEngine(): Promise<{ configured: boolean; provider: string | null }> {
  getOrCreateAudioContext();
  cachedTtsConfig = null;
  ttsProbePromise = null;
  return probeServerTts();
}

async function playAudioBufferViaWebAudio(arrayBuf: ArrayBuffer): Promise<boolean> {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
    stopBidVoicePlayback();
    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.connect(ctx.destination);
    activeBufferSource = src;
    src.onended = () => {
      if (activeBufferSource === src) activeBufferSource = null;
    };
    src.start(0);
    return true;
  } catch {
    return false;
  }
}

export type BidVoiceProfileId = 'MALE_CLASSIC' | 'FEMALE_CLASSIC' | 'MALE_WARM' | 'FEMALE_NATURAL';

export const DEFAULT_BID_VOICE_PROFILE: BidVoiceProfileId = 'MALE_CLASSIC';
export const DEFAULT_BID_VOICE_SPEED = 0.88;

export const BID_VOICE_PROFILES: ReadonlyArray<{
  id: BidVoiceProfileId;
  label: string;
  gender: 'MALE' | 'FEMALE';
}> = [
  { id: 'MALE_CLASSIC', label: 'Male — Classic Auctioneer (Clear & Authoritative)', gender: 'MALE' },
  { id: 'FEMALE_CLASSIC', label: 'Female — Studio Host (Crisp & Bright)', gender: 'FEMALE' },
  { id: 'MALE_WARM', label: 'Male — Warm & Calm', gender: 'MALE' },
  { id: 'FEMALE_NATURAL', label: 'Female — Soft & Natural', gender: 'FEMALE' },
];

export const BID_VOICE_SPEED_PRESETS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0.75, label: '0.75× — Slow & Deliberate' },
  { value: 0.82, label: '0.82× — Relaxed Clarity' },
  { value: 0.88, label: '0.88× — Natural Auction Pace (Recommended)' },
  { value: 0.95, label: '0.95× — Standard' },
  { value: 1.05, label: '1.05× — Brisk' },
];

export function normalizeBidVoiceProfile(raw?: string | null): BidVoiceProfileId {
  const key = String(raw ?? '').trim().toUpperCase();
  return BID_VOICE_PROFILES.some((p) => p.id === key) ? (key as BidVoiceProfileId) : DEFAULT_BID_VOICE_PROFILE;
}

export function clampBidVoiceSpeed(raw?: number | string | null): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_BID_VOICE_SPEED;
  return Math.round(Math.min(1.2, Math.max(0.65, num)) * 100) / 100;
}

async function speakText(
  text: string,
  langCode: BidVoiceLanguageCode,
  force = false,
  overrides?: { speakingRate?: number; voiceProfile?: BidVoiceProfileId },
): Promise<boolean> {
  if (typeof window === 'undefined' || !text.trim()) return false;
  if (!force && !isBidVoiceEnabled()) return false;

  const seq = ++speakRequestSeq;
  const tts = await probeServerTts();
  if (!tts.configured || seq !== speakRequestSeq) return false;

  try {
    const res = await fetch('/api/chits/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        lang: langCode,
        ...(overrides?.speakingRate != null ? { speakingRate: clampBidVoiceSpeed(overrides.speakingRate) } : {}),
        ...(overrides?.voiceProfile ? { voiceProfile: normalizeBidVoiceProfile(overrides.voiceProfile) } : {}),
      }),
    });
    if (!res.ok || seq !== speakRequestSeq) return false;

    const arrayBuf = await res.arrayBuffer();
    if (seq !== speakRequestSeq || arrayBuf.byteLength === 0) return false;

    const playedWebAudio = await playAudioBufferViaWebAudio(arrayBuf);
    if (playedWebAudio) return true;

    const bytes = new Uint8Array(arrayBuf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    const audio = new Audio(`data:audio/mpeg;base64,${btoa(bin)}`);
    stopBidVoicePlayback();
    activeHtmlAudio = audio;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

export async function previewBidVoiceSample(params?: {
  lang?: string | null;
  speakingRate?: number;
  voiceProfile?: BidVoiceProfileId | string;
  prizeAmount?: number;
  memberName?: string;
}): Promise<boolean> {
  const effectiveLang = normalizeVoiceLanguageCode(params?.lang);
  const phrase = formatBidSpokenPhrase({
    prizeAmount: params?.prizeAmount ?? 4750000,
    memberName: params?.memberName ?? 'Oviya',
    lang: effectiveLang,
  });
  return speakText(phrase, effectiveLang, true, {
    speakingRate: params?.speakingRate != null ? clampBidVoiceSpeed(params.speakingRate) : undefined,
    voiceProfile: params?.voiceProfile ? normalizeBidVoiceProfile(params.voiceProfile) : undefined,
  });
}

export async function speakBidCallout(params: {
  prizeAmount: number;
  memberName?: string | null;
  ticketNo?: string | number | null;
  lang?: string | null;
  force?: boolean;
}): Promise<void> {
  const effectiveLang = normalizeVoiceLanguageCode(params.lang);
  const phrase = formatBidSpokenPhrase({ ...params, lang: effectiveLang });
  await speakText(phrase, effectiveLang, Boolean(params.force));
}

export async function speakWinnerCallout(params: {
  prizeAmount: number;
  memberName?: string | null;
  ticketNo?: string | number | null;
  lang?: string | null;
  force?: boolean;
}): Promise<void> {
  const effectiveLang = normalizeVoiceLanguageCode(params.lang);
  const phrase = formatWinnerVoicePhrase({ ...params, lang: effectiveLang });
  await speakText(phrase, effectiveLang, Boolean(params.force));
}
