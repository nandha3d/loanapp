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

/**
 * Converts rupee amounts into natural spoken Indian grouping in the active language:
 * - en: 48000 -> "48 thousand", 4749700 -> "47 lakh 49 thousand 7 hundred"
 * - ml: 48000 -> "48 ആയിരം",    4749700 -> "47 ലക്ഷം 49 ആയിരം 7 നൂറ്"
 */
export function formatIndianNumberForSpeech(amount: number, lang?: string | null): string {
  const n = Math.max(0, Math.round(Number(amount) || 0));
  if (n === 0) return '0';
  const code = normalizeVoiceLanguageCode(lang);
  const u = SPEECH_NUMBER_UNITS[code];
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
  if (hundreds > 0 && rem % 100 === 0) {
    parts.push(`${hundreds} ${u.hundred}`);
    rem = 0;
  } else if (hundreds > 0) {
    parts.push(`${hundreds} ${u.hundred}`);
    rem %= 100;
  }
  if (rem > 0) {
    parts.push(String(rem));
  }
  return parts.join(' ');
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
