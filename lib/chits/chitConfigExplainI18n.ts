/**
 * Plain-language Chit Configuration explanations and complete 6-language (`en`,
 * `ta`, `hi`, `te`, `kn`, `ml`) UI copy for the Chit Group Detail, Ledger,
 * Edit Form, and Wizard screens — avoiding raw internal UPPER_SNAKE_CASE enum codes.
 */
import { resolveChitLang, type SupportedChitLang } from './formTooltipsI18n';

type Tuple6 = Record<SupportedChitLang, string>;

const pick = (t: Tuple6, lang?: string | null): string => t[resolveChitLang(lang)];

function translateFromMap(
  map: Record<string, Tuple6>,
  key: string | null | undefined,
  lang?: string | null,
  fallback?: string,
): string {
  if (!key) return fallback || '—';
  const entry = map[key];
  if (entry) return pick(entry, lang);
  return fallback || key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const REGULATORY_TIERS: Record<string, Tuple6> = {
  REGISTERED_ACT_1982: {
    en: 'Government Registered (Chit Funds Act, 1982 — Registrar regulated)',
    ta: 'அரசு பதிவு பெற்ற சீட்டு (சீட்டு நிதி சட்டம் 1982)',
    hi: 'सरकारी पंजीकृत चिट (चिट फंड अधिनियम 1982)',
    te: 'ప్రభుత్వ నమోదిత చిట్ (చిట్ ఫండ్స్ చట్టం 1982)',
    kn: 'ಸರ್ಕಾರಿ ನೋಂದಾಯಿತ ಚಿಟ್ (ಚಿಟ್ ಫಂಡ್ ಕಾಯ್ದೆ 1982)',
    ml: 'സർക്കാർ രജിസ്റ്റർ ചെയ്ത ചിട്ടി (ചിട്ടി നിയമം 1982)',
  },
  UNORGANIZED_INFORMAL: {
    en: 'Private / Mutual Group (No statutory registrar filing required)',
    ta: 'தனியார் / பரஸ்பர குழு (பதிவாளர் தாக்கல் தேவையில்லை)',
    hi: 'निजी / आपसी समूह (पंजीकरण आवश्यक नहीं)',
    te: 'ప్రైవేట్ / పరస్పర సమూహం (రిజిస్ట్రార్ ఫైలింగ్ అవసరం లేదు)',
    kn: 'ಖಾಸಗಿ / ಪರಸ್ಪರ ಗುಂಪು (ನೋಂದಣಿ ಅಗತ್ಯವಿಲ್ಲ)',
    ml: 'സ്വകാര്യ / പരസ്പര ഗ്രൂപ്പ് (രജിസ്ട്രാർ ഫയലിംഗ് ആവശ്യമില്ല)',
  },
  SHG_COOPERATIVE: {
    en: 'Self-Help Group (SHG / Cooperative Revolving Pool)',
    ta: 'சுய உதவிக்குழு (SHG / கூட்டுறவு சுழல் நிதி)',
    hi: 'स्वयं सहायता समूह (SHG / सहकारी निधि)',
    te: 'స్వయం సహాయక సంఘం (SHG / సహకార నిధి)',
    kn: 'ಸ್ವಸಹಾಯ ಗುಂಪು (SHG / ಸಹಕಾರ ನಿಧಿ)',
    ml: 'സ്വയം സഹായ സംഘം (SHG / സഹകരണ നിധി)',
  },
  MERCHANT_SAVINGS: {
    en: 'Merchant / Jewellery Savings Circle (Gold or Festival Scheme)',
    ta: 'வணிக / நகை சேமிப்பு திட்டம் (தங்கம் அல்லது பண்டிகை சீட்டு)',
    hi: 'व्यापारी / आभूषण बचत योजना (सोना या त्योहार चिट)',
    te: 'వ్యాపార / ఆభరణాల పొదుపు పథకం (బంగారం లేదా పండుగ చిట్)',
    kn: 'ವ್ಯಾಪಾರ / ಆಭರಣ ಉಳಿತಾಯ ಯೋಜನೆ (ಚಿನ್ನ ಅಥವಾ ಹಬ್ಬದ ಚಿಟ್)',
    ml: 'വ്യാപാര / സ്വർണ്ണ നിക്ഷേപ പദ്ധതി (സ്വർണ്ണം അല്ലെങ്കിൽ ഉത്സവ ചിട്ടി)',
  },
};

const SCALE_TIERS: Record<string, Tuple6> = {
  MICRO: {
    en: 'Micro Pool (Small daily/weekly savings up to ₹50,000)',
    ta: 'சிறு நிதி (₹50,000 வரை தினசரி/வார சேமிப்பு)',
    hi: 'लघु पूल (₹50,000 तक दैनिक/साप्ताहिक बचत)',
    te: 'మైక్రో పూల్ (₹50,000 వరకు చిన్న పొదుపు)',
    kn: 'ಮೈಕ್ರೋ ಪೂಲ್ (₹50,000 ವರೆಗೆ ಸಣ್ಣ ಉಳಿತಾಯ)',
    ml: 'മൈക്രോ പൂൾ (₹50,000 വരെ ചെറു സമ്പാദ്യം)',
  },
  HOUSEHOLD: {
    en: 'Household & Family Circle (₹50,000 – ₹5,00,000 pool)',
    ta: 'குடும்ப மற்றும் நடுத்தர சீட்டு (₹50,000 – ₹5 லட்சம்)',
    hi: 'घरेलू और पारिवारिक समूह (₹50,000 – ₹5 लाख पूल)',
    te: 'కుటుంబ మరియు గృహ చిట్ (₹50,000 – ₹5 లక్షలు)',
    kn: 'ಕುಟುಂಬ ಮತ್ತು ಮಧ್ಯಮ ಚಿಟ್ (₹50,000 – ₹5 ಲಕ್ಷ)',
    ml: 'കുടുംബ ചിട്ടി (₹50,000 – ₹5 ലക്ഷം വരെ)',
  },
  SME_TRADER: {
    en: 'Business & Trader Circle (₹5 Lakh – ₹25 Lakh pool)',
    ta: 'வணிகர் மற்றும் தொழில் சீட்டு (₹5 லட்சம் – ₹25 லட்சம்)',
    hi: 'व्यवसाय और व्यापारी पूल (₹5 लाख – ₹25 लाख)',
    te: 'వ్యాపార మరియు వర్తక చిట్ (₹5 లక్షలు – ₹25 లక్షలు)',
    kn: 'ವ್ಯಾಪಾರ ಮತ್ತು ಉದ್ಯಮಿ ಚಿಟ್ (₹5 ಲಕ್ಷ – ₹25 ಲಕ್ಷ)',
    ml: 'ബിസിനസ് & വ്യാപാരി ചിട്ടി (₹5 ലക്ഷം – ₹25 ലക്ഷം)',
  },
  ENTERPRISE: {
    en: 'High-Value Corporate Circle (Above ₹25 Lakh pool)',
    ta: 'பெரிய நிறுவன சீட்டு (₹25 லட்சத்திற்கு மேல்)',
    hi: 'उच्च-मूल्य कॉर्पोरेट पूल (₹25 लाख से ऊपर)',
    te: 'భారీ వాణిజ్య చిట్ (₹25 లక్షలకు పైగా)',
    kn: 'ದೊಡ್ಡ ಕಾರ್ಪೊರೇಟ್ ಚಿಟ್ (₹25 ಲಕ್ಷಕ್ಕೂ ಹೆಚ್ಚು)',
    ml: 'വൻകിട കോർപ്പറേറ്റ് ചിട്ടി (₹25 ലക്ഷത്തിന് മുകളിൽ)',
  },
};

const PAYOUT_ASSETS: Record<string, Tuple6> = {
  CASH: {
    en: 'Cash / Bank transfer payout',
    ta: 'ரொக்கம் / வங்கி பணம் வழங்கல்',
    hi: 'नकद / बैंक ट्रांसफर भुगतान',
    te: 'నగదు / బ్యాంక్ బదిలీ చెల్లింపు',
    kn: 'ನಗದು / ಬ್ಯಾಂಕ್ ವರ್ಗಾವಣೆ ಪಾವತಿ',
    ml: 'പണം / ബാങ്ക് ട്രാൻസ്ഫർ വിതരണം',
  },
  GOLD_WEIGHT: {
    en: 'Physical Gold measured by weight (grams)',
    ta: 'தங்கம் எடை அடிப்படையில் (கிராம்)',
    hi: 'सोना वजन के आधार पर (ग्राम में)',
    te: 'బంగారం బరువు ఆధారంగా (గ్రాములు)',
    kn: 'ಚಿನ್ನ ತೂಕದ ಆಧಾರದ ಮೇಲೆ (ಗ್ರಾಂ)',
    ml: 'സ്വർണ്ണം തൂക്കത്തിന്റെ അടിസ്ഥാനത്തിൽ (ഗ്രാം)',
  },
  GOLD_VALUE: {
    en: 'Gold Jewellery value voucher at market rate',
    ta: 'நகை மதிப்பு வவுச்சர் (சந்தை விலையில்)',
    hi: 'बाजार भाव पर स्वर्ण आभूषण वाउचर',
    te: 'మార్కెట్ ధర వద్ద బంగారు వోచర్',
    kn: 'ಮಾರುಕಟ್ಟೆ ದರದಲ್ಲಿ ಚಿನ್ನದ ವೌಚರ್',
    ml: 'വിപണി നിരക്കിൽ സ്വർണ്ണ വൗച്ചർ',
  },
  COMMODITY_GOODS: {
    en: 'Festival hamper / goods delivery',
    ta: 'பண்டிகை பொருட்கள் / பரிசு வழங்கல்',
    hi: 'त्योहार सामग्री / वस्तु वितरण',
    te: 'పండుగ సరుకులు / వస్తువుల పంపిణీ',
    kn: 'ಹಬ್ಬದ ಸಾಮಗ್ರಿ / ವಸ್ತುಗಳ ವಿತರಣೆ',
    ml: 'ഉത്സവ സാധനങ്ങൾ / സമ്മാന വിതരണം',
  },
};

const FREQUENCIES: Record<string, Tuple6> = {
  DAILY_25: { en: 'Daily (25 days per cycle)', ta: 'தினசரி (25 நாட்கள்)', hi: 'दैनिक (25 दिन)', te: 'రోజువారీ (25 రోజులు)', kn: 'ದೈನಂದಿನ (25 ದಿನಗಳು)', ml: 'ദിവസേന (25 ദിവസം)' },
  DAILY_30: { en: 'Daily (30 days per cycle)', ta: 'தினசரி (30 நாட்கள்)', hi: 'दैनिक (30 दिन)', te: 'రోజువారీ (30 రోజులు)', kn: 'ದೈನಂದಿನ (30 ದಿನಗಳು)', ml: 'ദിവസേന (30 ദിവസം)' },
  daily: { en: 'Daily', ta: 'தினசரி', hi: 'दैनिक', te: 'రోజువారీ', kn: 'ದೈನಂದಿನ', ml: 'ദിവസേന' },
  WEEKLY: { en: 'Weekly', ta: 'வாராந்திர', hi: 'साप्ताहिक', te: 'వారపు', kn: 'ವಾರದ', ml: 'ആഴ്ചതോറും' },
  weekly: { en: 'Weekly', ta: 'வாராந்திர', hi: 'साप्ताहिक', te: 'వారపు', kn: 'ವಾರದ', ml: 'ആഴ്ചതോറും' },
  FORTNIGHTLY: { en: 'Every 2 weeks (Fortnightly)', ta: 'இரு வாரத்திற்கு ஒருமுறை', hi: 'पाक्षिक (हर 14 दिन)', te: 'రెండు వారాలకు ఒకసారి', kn: 'ಹದಿನೈದು ದಿನಗಳಿಗೊಮ್ಮೆ', ml: 'രണ്ടാഴ്ചയിലൊരിക്കൽ' },
  fortnightly: { en: 'Every 2 weeks (Fortnightly)', ta: 'இரு வாரத்திற்கு ஒருமுறை', hi: 'पाक्षिक (हर 14 दिन)', te: 'రెండు వారాలకు ఒకసారి', kn: 'ಹದಿನೈದು ದಿನಗಳಿಗೊಮ್ಮೆ', ml: 'രണ്ടാഴ്ചയിലൊരിക്കൽ' },
  MONTHLY: { en: 'Once every month', ta: 'மாதாந்திரம் (மாதம் ஒருமுறை)', hi: 'मासिक (महीने में एक बार)', te: 'నెలవారీ (నెలకు ఒకసారి)', kn: 'ಮಾಸಿಕ (ತಿಂಗಳಿಗೊಮ್ಮೆ)', ml: 'മാസാമാസം (മാസത്തിലൊരിക്കൽ)' },
  monthly: { en: 'Once every month', ta: 'மாதாந்திரம் (மாதம் ஒருமுறை)', hi: 'मासिक (महीने में एक बार)', te: 'నెలవారీ (నెలకు ఒకసారి)', kn: 'ಮಾಸಿಕ (ತಿಂಗಳಿಗೊಮ್ಮೆ)', ml: 'മാസാമാസം (മാസത്തിലൊരിക്കൽ)' },
  BI_MONTHLY: { en: 'Every 2 months', ta: 'இரண்டு மாதங்களுக்கு ஒருமுறை', hi: 'द्विमासिक (हर 2 महीने)', te: 'రెండు నెలలకు ఒకసారి', kn: 'ಎರಡು ತಿಂಗಳಿಗೊಮ್ಮೆ', ml: 'രണ്ട് മാസത്തിലൊരിക്കൽ' },
  SEASONAL_HARVEST: { en: 'Seasonal / Harvest cycle', ta: 'பருவ / அறுவடை சுழற்சி', hi: 'मौसमी / फसल चक्र', te: 'సీజనల్ / పంట సైకిల్', kn: 'ಋತುಮಾನ / ಸುಗ್ಗಿ ಚಕ್ರ', ml: 'സീസണൽ / വിളവെടുപ്പ് ചക്രം' },
};

const AUCTION_TYPES: Record<string, Tuple6> = {
  open_manual: {
    en: 'In-person / organizer records the winning bid manually',
    ta: 'நேரடி சபை / நிர்வாகி வெற்றியாளர் ஏலத்தை பதிவு செய்வார்',
    hi: 'प्रत्यक्ष बैठक / आयोजक मैनुअल रूप से विजेता बोली दर्ज करता है',
    te: 'నేరుగా సమావేశం / నిర్వాహకుడు విజేత బిడ్ నమోదు చేస్తారు',
    kn: 'ನೇರ ಸಭೆ / ಸಂಘಟಕರು ವಿಜೇತ ಬಿಡ್ ಅನ್ನು ದಾಖಲಿಸುತ್ತಾರೆ',
    ml: 'നേരിട്ടുള്ള ലേലം / ഓർഗനൈസർ വിജയിയെ രേഖപ്പെടുത്തുന്നു',
  },
  open_live: {
    en: 'Online live room where members place descending bids in real time',
    ta: 'ஆன்லைன் நேரடி அறையில் உறுப்பினர்கள் குறைப்பு ஏலம் விடுவார்கள்',
    hi: 'ऑनलाइन लाइव रूम जहाँ सदस्य रीयल-टाइम बोली लगाते हैं',
    te: 'ఆన్‌లైన్ లైవ్ రూమ్ ద్వారా సభ్యులు నేరుగా బిడ్ చేస్తారు',
    kn: 'ಆನ್‌ಲೈನ್ ಲೈವ್ ರೂಮ್‌ನಲ್ಲಿ ಸದಸ್ಯರು ನೇರವಾಗಿ ಬಿಡ್ ಮಾಡುತ್ತಾರೆ',
    ml: 'ഓൺലൈൻ ലൈവ് റൂമിൽ അംഗങ്ങൾ തത്സമയം ലേലം വിളിക്കുന്നു',
  },
  sealed: {
    en: 'Secret sealed bids revealed once bidding window closes',
    ta: 'ரகசிய மூடிய ஏலம் (நேரம் முடிந்தவுடன் திறக்கப்படும்)',
    hi: 'गुप्त सीलबंद बोलियाँ जो समय समाप्त होने पर खुलती हैं',
    te: 'రహస్య సీల్డ్ బిడ్లు (సమయం ముగిసిన తర్వాత తెరుస్తారు)',
    kn: 'ರಹಸ್ಯ ಸೀಲ್ಡ್ ಬಿಡ್‌ಗಳು (ಸಮಯ ಮುಗಿದ ನಂತರ ತೆರೆಯಲಾಗುತ್ತದೆ)',
    ml: 'രഹസ്യ സീൽഡ് ലേലം (സമയം കഴിയുമ്പോൾ തുറക്കും)',
  },
  lottery: {
    en: 'Lucky draw lottery picks a non-prized member randomly',
    ta: 'குலுக்கல் முறையில் பரிசு பெறாத உறுப்பினர் தேர்ந்தெடுக்கப்படுவார்',
    hi: 'लकी ड्रॉ द्वारा बिना जीते सदस्य का चयन',
    te: 'లాటరీ డ్రా ద్వారా విజేతను ఎంపిక చేస్తారు',
    kn: 'ಲಕ್ಕಿ ಡ್ರಾ ಮೂಲಕ ವಿಜೇತರನ್ನು ಆಯ್ಕೆ ಮಾಡಲಾಗುತ್ತದೆ',
    ml: 'നറുക്കെടുപ്പിലൂടെ വിജയിയെ തിരഞ്ഞെടുക്കുന്നു',
  },
  fixed_rotation: {
    en: 'Pre-decided turn order (no auction bidding)',
    ta: 'முன் தீர்மானிக்கப்பட்ட வரிசை முறை (ஏலம் இல்லை)',
    hi: 'पूर्व-निर्धारित बारी क्रम (कोई नीलामी नहीं)',
    te: 'ముందే నిర్ణయించిన క్రమం (బిడ్డింగ్ లేదు)',
    kn: 'ಪೂರ್ವನಿರ್ಧರಿತ ಕ್ರಮ (ಹರಾಜು ಇಲ್ಲ)',
    ml: 'മുൻകൂട്ടി നിശ്ചയിച്ച ക്രമം (ലേലം ഇല്ല)',
  },
};

const COMMISSION_MODES: Record<string, Tuple6> = {
  PERCENTAGE_COMMISSION: {
    en: 'Fixed percentage organizer fee every cycle',
    ta: 'ஒவ்வொரு சுழற்சியிலும் நிலையான சதவீத கமிஷன்',
    hi: 'हर चक्र में निश्चित प्रतिशत आयोजक शुल्क',
    te: 'ప్రతి సైకిల్‌లో స్థిర శాతం కమీషన్',
    kn: 'ಪ್ರತಿ ಸುತ್ತಿನಲ್ಲಿ ನಿಗದಿತ ಶೇಕಡಾ ಕಮಿಷನ್',
    ml: 'ഓരോ ഘട്ടത്തിലും നിശ്ചിത ശതമാനം കമ്മീഷൻ',
  },
  FREE_TICKET_CYCLE_1: {
    en: 'Foreman takes Period 1 pot without fee deduction',
    ta: 'முதல் தவணைத் தொகையை போர்மேன் கட்டணமின்றி பெறுவார்',
    hi: 'फोरमैन बिना कटौती पहला पॉट प्राप्त करता है',
    te: 'మొదటి విడత మొత్తం ఫోర్‌మ్యాన్‌కు చెందుతుంది',
    kn: 'ಮೊದಲ ಸುತ್ತಿನ ಹಣವನ್ನು ಫೋರ್‌ಮ್ಯಾನ್ ಪಡೆಯುತ್ತಾರೆ',
    ml: 'ഒന്നാം ഘട്ടം ഫോർമാന് ലഭിക്കുന്നു',
  },
  FREE_TICKET_CYCLE_2: {
    en: 'Foreman takes Period 2 pot as compensation',
    ta: 'இரண்டாம் தவணைத் தொகையை போர்மேன் பெறுவார்',
    hi: 'दूसरा पॉट फोरमैन शुल्क के रूप में मिलता है',
    te: 'రెండవ విడత మొత్తం ఫోర్‌మ్యాన్‌కు చెందుతుంది',
    kn: 'ಎರಡನೇ ಸುತ್ತಿನ ಹಣವನ್ನು ಫೋರ್‌ಮ್ಯಾನ್ ಪಡೆಯುತ್ತಾರೆ',
    ml: 'രണ്ടാം ഘട്ടം ഫോർമാന് ലഭിക്കുന്നു',
  },
  FLAT_FEE: {
    en: 'Fixed rupee service fee per cycle',
    ta: 'சுழற்சிக்கு நிலையான ரூபாய் சேவை கட்டணம்',
    hi: 'प्रति चक्र निश्चित रुपये सेवा शुल्क',
    te: 'సైకిల్‌కు స్థిర రూపాయల రుసుము',
    kn: 'ಪ್ರತಿ ಸುತ್ತಿಗೆ ನಿಗದಿತ ರೂಪಾಯಿ ಶುಲ್ಕ',
    ml: 'ഓരോ ഘട്ടത്തിലും നിശ്ചിത രൂപ ഫീസ്',
  },
  HYBRID: {
    en: 'Combined flat fee + percentage commission',
    ta: 'நிலையான கட்டணம் + சதவீத கமிஷன் கலப்பு',
    hi: 'निश्चित शुल्क + प्रतिशत कमीशन का संयोजन',
    te: 'స్థిర రుసుము + శాతం కమీషన్ కలయిక',
    kn: 'ನಿಗದಿತ ಶುಲ್ಕ + ಶೇಕಡಾ ಕಮಿಷನ್ ಸಂಯೋಜನೆ',
    ml: 'നിശ്ചിത ഫീസും ശതമാന കമ്മീഷനും ചേർന്നത്',
  },
  ZERO_COMMISSION: {
    en: 'Zero organizer commission (Community / mutual circle)',
    ta: 'கமிஷன் இல்லை (பரஸ்பர சேமிப்பு குழு)',
    hi: 'शून्य कमीशन (आपसी / सामुदायिक चिट)',
    te: 'కమీషన్ లేదు (సహకార పొదుపు సమూహం)',
    kn: 'ಶೂನ್ಯ ಕಮಿಷನ್ (ಸಮುದಾಯ ಉಳಿತಾಯ ಗುಂಪು)',
    ml: 'കമ്മീഷൻ ഇല്ല (സഹകരണ കൂട്ടായ്മ)',
  },
};

const DIVIDEND_POLICIES: Record<string, Tuple6> = {
  ALL_MEMBERS: {
    en: 'Shared equally among all members',
    ta: 'அனைத்து உறுப்பினர்களுக்கும் சமமாகப் பகிரப்படும்',
    hi: 'सभी सदस्यों में बराबर बाँटा जाता है',
    te: 'సభ్యులందరికీ సమానంగా పంచబడుతుంది',
    kn: 'ಎಲ್ಲಾ ಸದಸ್ಯರಿಗೆ ಸಮನಾಗಿ ಹಂಚಲಾಗುತ್ತದೆ',
    ml: 'എല്ലാ അംഗങ്ങൾക്കും തുല്യമായി പങ്കിടുന്നു',
  },
  NON_PRIZED_ONLY: {
    en: 'Shared only with members who have not won yet',
    ta: 'இதுவரை பரிசு பெறாத உறுப்பினர்களுக்கு மட்டும் பகிரப்படும்',
    hi: 'केवल उन सदस्यों को मिलता है जो अभी तक नहीं जीते',
    te: 'ఇంకా గెలవని సభ్యులకు మాత్రమే పంచబడుతుంది',
    kn: 'ಇನ್ನೂ ಗೆಲ್ಲದ ಸದಸ್ಯರಿಗೆ ಮಾತ್ರ ಹಂಚಲಾಗುತ್ತದೆ',
    ml: 'ഇതുവരെ സമ്മാനം ലഭിക്കാത്ത അംഗങ്ങൾക്ക് മാത്രം',
  },
  NON_WINNERS_ONLY: {
    en: 'Shared among everyone except the current cycle winner',
    ta: 'இந்த சுழற்சி வெற்றியாளரைத் தவிர மற்ற அனைவருக்கும்',
    hi: 'वर्तमान विजेता को छोड़कर सभी को मिलता है',
    te: 'ప్రస్తుత విజేత తప్ప మిగిలిన వారందరికీ',
    kn: 'ಪ್ರಸ್ತುತ ವಿಜೇತರನ್ನು ಹೊರತುಪಡಿಸಿ ಎಲ್ಲರಿಗೂ',
    ml: 'ഇപ്പോഴത്തെ വിജയി ഒഴികെ എല്ലാവർക്കും',
  },
  FIXED_POOL: {
    en: 'Follows pre-fixed chart dividend schedule',
    ta: 'முன் நிர்ணயிக்கப்பட்ட அட்டவணை டிவிடெண்ட்',
    hi: 'पूर्व-निर्धारित तालिका के अनुसार लाभांश',
    te: 'ముందే నిర్ణయించిన చార్ట్ డివిడెండ్',
    kn: 'ಪೂರ್ವನಿರ್ಧರಿತ ಚಾರ್ಟ್ ಲಾಭಾಂಶ',
    ml: 'മുൻകൂട്ടി നിശ്ചയിച്ച ചാർട്ട് ലാഭവിഹിതം',
  },
  PROPORTIONAL: {
    en: 'Proportional to ticket share held',
    ta: 'டிக்கெட் பங்கின் விகிதாச்சாரப்படி',
    hi: 'टिकट हिस्सेदारी के अनुपात में',
    te: 'టికెట్ వాటా ప్రకారం దామాషాగా',
    kn: 'ಟಿಕೆಟ್ ಪಾಲಿನ ಅನುಪಾತದಲ್ಲಿ',
    ml: 'ടിക്കറ്റ് വിഹിതത്തിന് ആനുപാതികമായി',
  },
  NONE: {
    en: 'No auction dividend distributed',
    ta: 'ஏல டிவிடெண்ட் பகிர்வு இல்லை',
    hi: 'कोई नीलामी लाभांश नहीं',
    te: 'డివిడెండ్ పంపిణీ లేదు',
    kn: 'ಲಾಭಾಂಶ ಹಂಚಿಕೆ ಇಲ್ಲ',
    ml: 'ലാഭവിഹിതം വിതരണം ചെയ്യുന്നില്ല',
  },
};

const DIVIDEND_DISTRIBUTIONS: Record<string, Tuple6> = {
  ADJUST_NEXT_DUE: {
    en: 'Automatically lowers each member’s next cycle installment',
    ta: 'அடுத்த தவணைத் தொகையிலிருந்து தானாகக் குறைக்கப்படும்',
    hi: 'अगली किस्त की राशि अपने-आप कम हो जाती है',
    te: 'తదుపరి వాయిదా మొత్తాన్ని ఆటోమేటిక్‌గా తగ్గిస్తుంది',
    kn: 'ಮುಂದಿನ ಕಂತಿನ ಮೊತ್ತವನ್ನು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಕಡಿಮೆ ಮಾಡುತ್ತದೆ',
    ml: 'അടുത്ത തവണത്തുകയിൽ നിന്ന് സ്വയമേവ കുറയ്ക്കുന്നു',
  },
  CASH_PAYOUT: {
    en: 'Paid out separately to members',
    ta: 'உறுப்பினர்களுக்கு தனியாக வழங்கப்படும்',
    hi: 'सदस्यों को अलग से नकद दिया जाता है',
    te: 'సభ్యులకు విడిగా చెల్లించబడుతుంది',
    kn: 'ಸದಸ್ಯರಿಗೆ ಪ್ರತ್ಯೇಕವಾಗಿ ಪಾವತಿಸಲಾಗುತ್ತದೆ',
    ml: 'അംഗങ്ങൾക്ക് പ്രത്യേകം പണമായി നൽകുന്നു',
  },
  ACCUMULATE: {
    en: 'Saved and released at chit completion',
    ta: 'சீட்டு முடியும் போது மொத்தமாக வழங்கப்படும்',
    hi: 'चिट पूर्ण होने पर एक साथ दिया जाता है',
    te: 'చిట్ ముగిసే సమయంలో జమ చేసి ఇస్తారు',
    kn: 'ಚಿಟ್ ಮುಗಿಯುವಾಗ ಒಟ್ಟಾಗಿ ನೀಡಲಾಗುತ್ತದೆ',
    ml: 'ചിട്ടി പൂർത്തിയാകുമ്പോൾ ഒരുമിച്ച് നൽകുന്നു',
  },
  DEFERRED_BONUS_POOL: {
    en: 'Held in a maturity bonus pool until final settlement',
    ta: 'இறுதித் தீர்வு வரை போனஸ் நிதியில் சேமிக்கப்படும்',
    hi: 'अंतिम निपटान तक बोनस पूल में संचित होता है',
    te: 'తుది సెటిల్‌మెంట్ వరకు బోనస్ పూల్‌లో ఉంచబడుతుంది',
    kn: 'ಅಂತಿಮ ಇತ್ಯರ್ಥದವರೆಗೆ ಬೋನಸ್ ನಿಧಿಯಲ್ಲಿ ಉಳಿಯುತ್ತದೆ',
    ml: 'അവസാന സെറ്റിൽമെന്റ് വരെ ബോണസ് പൂളിൽ സൂക്ഷിക്കുന്നു',
  },
  NONE: {
    en: 'No separate distribution needed',
    ta: 'தனி விநியோகம் தேவையில்லை',
    hi: 'अलग वितरण आवश्यक नहीं',
    te: 'ప్రత్యేక పంపిణీ అవసరం లేదు',
    kn: 'ಪ್ರತ್ಯೇಕ ವಿತರಣೆ ಅಗತ್ಯವಿಲ್ಲ',
    ml: 'പ്രത്യേക വിതരണം ആവശ്യമില്ല',
  },
};

const TIE_BREAKERS: Record<string, Tuple6> = {
  EARLIEST_BID: {
    en: 'First member to submit that discount wins on a tie',
    ta: 'சம ஏலத்தில் முதலில் ஏலம் கோரியவர் வெல்வார்',
    hi: 'बराबर बोली पर सबसे पहले बोली लगाने वाला जीतता है',
    te: 'సమాన బిడ్ వద్ద ముందుగా వేసిన వారు గెలుస్తారు',
    kn: 'ಸಮಾನ ಬಿಡ್‌ನಲ್ಲಿ ಮೊದಲು ಬಿಡ್ ಮಾಡಿದವರು ಗೆಲ್ಲುತ್ತಾರೆ',
    ml: 'ഒരേ തുക വന്നാൽ ആദ്യം ലേലം വിളിച്ചയാൾ വിജയിക്കും',
  },
  LOTTERY: {
    en: 'Tied bidders are resolved by random lucky draw',
    ta: 'சம ஏலத்தில் குலுக்கல் மூலம் வெற்றியாளர் தேர்வு',
    hi: 'बराबर बोली होने पर लॉटरी द्वारा चयन',
    te: 'సమాన బిడ్ల మధ్య లాటరీ ద్వారా ఎంపిక',
    kn: 'ಸಮಾನ ಬಿಡ್ ಇದ್ದಲ್ಲಿ ಲಾಟರಿ ಮೂಲಕ ಆಯ್ಕೆ',
    ml: 'ഒരേ തുക വന്നാൽ നറുക്കെടുപ്പിലൂടെ തിരഞ്ഞെടുക്കും',
  },
  HIGHEST_CREDIT_SCORE: {
    en: 'Highest on-time payment score wins on a tie',
    ta: 'தவணை ஒழுங்கு மதிப்பெண் அதிகம் உள்ளவர் வெல்வார்',
    hi: 'बेहतर भुगतान स्कोर वाले सदस्य को प्राथमिकता',
    te: 'సమయపాలన క్రెడిట్ స్కోర్ ఎక్కువ ఉన్నవారు గెలుస్తారు',
    kn: 'ಹೆಚ್ಚಿನ ಪಾವತಿ ಸ್ಕೋರ್ ಹೊಂದಿರುವವರು ಗೆಲ್ಲುತ್ತಾರೆ',
    ml: 'മികച്ച തിരിച്ചടവ് സ്കോർ ഉള്ളയാൾ വിജയിക്കും',
  },
};

const LATE_FEE_TYPES: Record<string, Tuple6> = {
  NONE: {
    en: 'No automatic late penalty',
    ta: 'தாமத அபராதம் இல்லை',
    hi: 'कोई स्वचालित विलंब शुल्क नहीं',
    te: 'ఆలస్య రుసుము లేదు',
    kn: 'ವಿಳಂಬ ದಂಡ ಇಲ್ಲ',
    ml: 'വൈകിയതിനുള്ള പിഴയില്ല',
  },
  FLAT_PER_DAY: {
    en: 'Flat daily late fee',
    ta: 'தினசரி நிலையான அபராதம்',
    hi: 'दैनिक निश्चित विलंब शुल्क',
    te: 'రోజువారీ స్థిర ఆలస్య రుసుము',
    kn: 'ದೈನಂದಿನ ನಿಗದಿತ ವಿಳಂಬ ಶುಲ್ಕ',
    ml: 'ദിവസേനയുള്ള നിശ്ചിത പിഴ',
  },
  PERCENTAGE_PA: {
    en: 'Annualized interest late fee',
    ta: 'வருடாந்திர வட்டி சதவீத அபராதம்',
    hi: 'वार्षिक प्रतिशत विलंब शुल्क',
    te: 'వార్షిక వడ్డీ ఆధారిత ఆలస్య రుసుము',
    kn: 'ವಾರ್ಷಿಕ ಬಡ್ಡಿ ಆಧಾರಿತ ವಿಳಂಬ ಶುಲ್ಕ',
    ml: 'വാർഷിക പലിശ നിരക്കിലുള്ള പിഴ',
  },
};

export interface ExplainedChitConfigRow {
  key: string;
  label: string;
  summary: string;
  detail: string;
  helpTitle: string;
  helpText: string;
}

export interface ChitDetailUiStrings {
  statusLabels: Record<string, string>;
  agreementLabels: Record<string, string>;
  payoutLabels: Record<string, string>;
  configSectionTitle: string;
  configSectionSub: string;
  winnerSectionTitle: string;
  totalCollected: string;
  prizeDisbursed: string;
  dividendsShared: string;
  foremanCommission: string;
  agreementsCountLabel: string;
  pendingPayoutsLabel: string;
  nextLabel: string;
  wonSuffix: string;
  noWinnersYet: string;
  editGroupBtn: string;
  activateGroupBtn: string;
  activatingBtn: string;
  cancelGroupBtn: string;
  cancellingBtn: string;
  autoAssignBtn: string;
  assigningBtn: string;
  installmentWord: string;
  auctionHistoryTitle: string;
  draftAuctionsMsg: string;
  payoutCol: string;
  manageBtn: string;
  enterRoomBtn: string;
  rescheduleBtn: string;
  drawBtn: string;
  resolveBtn: string;
  drawingBtn: string;
  pdfLangLabel: string;
  membersExpandedBtn: string;
  membersCollapsedBtn: string;
  membersNeedReviewBadge: string;
  signVerifyAllBtn: string;
  verifyingAllBtn: string;
  signBtn: string;
  verifyBtn: string;
  editBtn: string;
  addOneTicketBtn: string;
  ticketCol: string;
  shareCol: string;
  agreementCol: string;
  nomineeCol: string;
  fullShare: string;
  paymentProofsTitle: string;
  memberPaymentsTitle: string;
  tabCurrent: string;
  tabOverdue: string;
  tabAll: string;
  allPeriodsBtn: string;
  baseCol: string;
  penaltyCol: string;
  netDueCol: string;
  outstandingCol: string;
  receiptCol: string;
  missedBtn: string;
  statutoryTitle: string;
  statutoryDesc: string;
  upgradeEnterpriseBtn: string;
  enterpriseOnlyBtn: string;
  manageForemenBtn: string;
  notAssigned: string;
  forfeitedOnLate: string;
  keptOnLate: string;
  noCap: string;
  uncapped: string;
  commissionFloor: string;
  upToPct: string;
  substCutoffLabel: string;
  ofGrossPot: string;
  ofBidDiscount: string;
  flatFeeSuffix: string;
  foremanFirstPotExplain: string;
  fixedDiscountNone: string;
}

const DETAIL_UI: Record<SupportedChitLang, ChitDetailUiStrings> = {
  en: {
    statusLabels: { draft: 'Draft', active: 'Active', completed: 'Completed', cancelled: 'Cancelled' },
    agreementLabels: { pending: 'Pending', signed: 'Signed', verified: 'Verified', rejected: 'Rejected' },
    payoutLabels: { pending: 'Pending', ready: 'Ready', paid: 'Paid' },
    configSectionTitle: 'How This Chit Group Works (Rules & Settings)',
    configSectionSub: 'Plain-language guide to pool rules, organizer commission, and member protections',
    winnerSectionTitle: 'Winner History & Pool Insights',
    totalCollected: 'Total Collected',
    prizeDisbursed: 'Prize Disbursed',
    dividendsShared: 'Dividends Shared',
    foremanCommission: 'Foreman Commission',
    agreementsCountLabel: 'Agreements Verified',
    pendingPayoutsLabel: 'Pending Payouts',
    nextLabel: 'Next',
    wonSuffix: 'won',
    noWinnersYet: 'No auction winners recorded yet. Once Cycle 1 finishes, winner payout and member savings appear here.',
    editGroupBtn: 'Edit',
    activateGroupBtn: 'Activate Group',
    activatingBtn: 'Activating…',
    cancelGroupBtn: 'Cancel Group',
    cancellingBtn: 'Cancelling…',
    autoAssignBtn: 'Auto-assign Tickets',
    assigningBtn: 'Assigning…',
    installmentWord: 'Installment',
    auctionHistoryTitle: 'Auction History',
    draftAuctionsMsg: 'Auction schedule is generated automatically when the group is activated.',
    payoutCol: 'Payout',
    manageBtn: 'Manage',
    enterRoomBtn: 'Enter room',
    rescheduleBtn: 'Reschedule',
    drawBtn: 'Draw',
    resolveBtn: 'Resolve',
    drawingBtn: 'Drawing…',
    pdfLangLabel: 'PDF Language:',
    membersExpandedBtn: 'Hide Enrollment Table',
    membersCollapsedBtn: 'Manage / Sign Members',
    membersNeedReviewBadge: 'needs sign/verify',
    signVerifyAllBtn: 'Sign & Verify All',
    verifyingAllBtn: 'Verifying…',
    signBtn: 'Sign',
    verifyBtn: 'Verify',
    editBtn: 'Edit',
    addOneTicketBtn: '+1 Ticket',
    ticketCol: 'Ticket',
    shareCol: 'Share',
    agreementCol: 'Agreement',
    nomineeCol: 'Nominee',
    fullShare: 'Full',
    paymentProofsTitle: 'Customer Payment Proofs',
    memberPaymentsTitle: 'Member Installment Collections',
    tabCurrent: 'Current',
    tabOverdue: 'Overdue',
    tabAll: 'All',
    allPeriodsBtn: 'All Periods',
    baseCol: 'Base',
    penaltyCol: 'Penalty',
    netDueCol: 'Net Due',
    outstandingCol: 'Outstanding',
    receiptCol: 'Receipt',
    missedBtn: 'Missed',
    statutoryTitle: 'Statutory Registers (Chit Funds Act, 1982)',
    statutoryDesc: 'State-formatted Form I–VIII PDF & Excel books with signature blocks and filing disclaimer.',
    upgradeEnterpriseBtn: 'Upgrade to Enterprise to Export',
    enterpriseOnlyBtn: 'Enterprise Only',
    manageForemenBtn: 'Manage Foremen',
    notAssigned: 'Not assigned yet',
    forfeitedOnLate: 'Late payers lose this cycle’s dividend share',
    keptOnLate: 'Members keep their dividend even if payment is late',
    noCap: 'No maximum cap',
    uncapped: 'Uncapped (no ceiling)',
    commissionFloor: 'foreman commission floor',
    upToPct: 'to',
    substCutoffLabel: 'Member replacement allowed until',
    ofGrossPot: 'of total chit pot value',
    ofBidDiscount: 'of the winning bid discount',
    flatFeeSuffix: 'flat fee per cycle',
    foremanFirstPotExplain: 'Period 1 pot goes directly to the organizer/foreman without auction',
    fixedDiscountNone: 'No fixed discount (winner receives full chit pot)',
  },
  ta: {
    statusLabels: { draft: 'வரைவு', active: 'செயலில்', completed: 'முடிந்தது', cancelled: 'ரத்து' },
    agreementLabels: { pending: 'நிலுவையில்', signed: 'கையொப்பம்', verified: 'சரிபார்க்கப்பட்டது', rejected: 'நிராகரிக்கப்பட்டது' },
    payoutLabels: { pending: 'நிலுவை', ready: 'தயார்', paid: 'வழங்கப்பட்டது' },
    configSectionTitle: 'இந்த சீட்டு குழுவின் விதிகள் & அமைப்புகள் (விளக்கம்)',
    configSectionSub: 'தவணை, போர்மேன் கமிஷன், டிவிடெண்ட் பகிர்வு மற்றும் பாதுகாப்பு விதிகளின் எளிய விளக்கம்',
    winnerSectionTitle: 'வெற்றியாளர் வரலாறு & நிதி நிலை',
    totalCollected: 'மொத்த வசூல்',
    prizeDisbursed: 'வழங்கிய பரிசு',
    dividendsShared: 'பகிர்ந்த டிவிடெண்ட்',
    foremanCommission: 'போர்மேன் கமிஷன்',
    agreementsCountLabel: 'ஒப்பந்த சரிபார்ப்பு',
    pendingPayoutsLabel: 'நிலுவை பரிசுகள்',
    nextLabel: 'அடுத்து',
    wonSuffix: 'வெற்றி',
    noWinnersYet: 'இன்னும் ஏல வெற்றியாளர் இல்லை. முதல் சுழற்சி முடிந்ததும் பரிசு மற்றும் டிவிடெண்ட் விவரம் இங்கே வரும்.',
    editGroupBtn: 'திருத்து',
    activateGroupBtn: 'குழுவை தொடங்கு',
    activatingBtn: 'தொடங்குகிறது…',
    cancelGroupBtn: 'குழுவை ரத்து செய்',
    cancellingBtn: 'ரத்து ஆகிறது…',
    autoAssignBtn: 'டிக்கெட் எண் கொடு',
    assigningBtn: 'வழங்குகிறது…',
    installmentWord: 'தவணை',
    auctionHistoryTitle: 'ஏல வரலாறு',
    draftAuctionsMsg: 'குழு தொடங்கப்பட்டதும் ஏல அட்டவணை தானாக உருவாகும்.',
    payoutCol: 'பரிசு நிலை',
    manageBtn: 'நிர்வகி',
    enterRoomBtn: 'அறைக்குள் செல்',
    rescheduleBtn: 'நேரம் மாற்று',
    drawBtn: 'குலுக்கல்',
    resolveBtn: 'முடிவு செய்',
    drawingBtn: 'நடக்கிறது…',
    pdfLangLabel: 'PDF மொழி:',
    membersExpandedBtn: 'சேர்க்கை அட்டவணையை மறை',
    membersCollapsedBtn: 'உறுப்பினர் சேர்க்கை / ஒப்பந்தம்',
    membersNeedReviewBadge: 'சரிபார்ப்பு தேவை',
    signVerifyAllBtn: 'அனைத்தையும் சரிபார்',
    verifyingAllBtn: 'சரிபார்க்கிறது…',
    signBtn: 'கையொப்பம்',
    verifyBtn: 'சரிபார்',
    editBtn: 'திருத்து',
    addOneTicketBtn: '+1 டிக்கெட்',
    ticketCol: 'டிக்கெட்',
    shareCol: 'பங்கு',
    agreementCol: 'ஒப்பந்தம்',
    nomineeCol: 'வாரிசுதாரர்',
    fullShare: 'முழு',
    paymentProofsTitle: 'வாடிக்கையாளர் பண ரசீது ஆதாரங்கள்',
    memberPaymentsTitle: 'உறுப்பினர் தவணை வசூல்',
    tabCurrent: 'நடப்பு',
    tabOverdue: 'தாமதம்',
    tabAll: 'அனைத்தும்',
    allPeriodsBtn: 'அனைத்து சுழற்சிகள்',
    baseCol: 'அடிப்படை',
    penaltyCol: 'அபராதம்',
    netDueCol: 'நிகர தொகை',
    outstandingCol: 'பாக்கி',
    receiptCol: 'ரசீது',
    missedBtn: 'தவறியது',
    statutoryTitle: 'சட்டப்பூர்வ பதிவேடுகள் (சீட்டு சட்டம் 1982)',
    statutoryDesc: 'மாநில படிவம் I–VIII PDF மற்றும் Excel புத்தகங்கள் (கையொப்ப இடங்களுடன்).',
    upgradeEnterpriseBtn: 'ஏற்றுமதிக்கு Enterprise திட்டத்திற்கு மாறவும்',
    enterpriseOnlyBtn: 'Enterprise மட்டும்',
    manageForemenBtn: 'போர்மேனை நிர்வகி',
    notAssigned: 'நியமிக்கப்படவில்லை',
    forfeitedOnLate: 'தாமதமாக செலுத்தினால் அந்த சுழற்சி டிவிடெண்ட் கிடைக்காது',
    keptOnLate: 'தாமதமானாலும் உறுப்பினருக்கு டிவிடெண்ட் தள்ளுபடி கிடைக்கும்',
    noCap: 'உச்ச வரம்பு இல்லை',
    uncapped: 'வரம்பற்ற ஏலம்',
    commissionFloor: 'கமிஷன் குறைந்தபட்சம்',
    upToPct: 'முதல்',
    substCutoffLabel: 'பதிலி உறுப்பினர் சேர்க்கை அனுமதி:',
    ofGrossPot: 'மொத்த சீட்டுத் தொகையில்',
    ofBidDiscount: 'ஏலத் தள்ளுபடித் தொகையில்',
    flatFeeSuffix: 'சுழற்சிக்கு நிலையான கட்டணம்',
    foremanFirstPotExplain: 'முதல் சுழற்சித் தொகை ஏலமின்றி போர்மேனுக்கு செல்லும்',
    fixedDiscountNone: 'நிலையான தள்ளுபடி இல்லை (முழு சீட்டுத் தொகை வழங்கப்படும்)',
  },
  hi: {
    statusLabels: { draft: 'ड्राफ्ट', active: 'सक्रिय', completed: 'पूर्ण', cancelled: 'रद्द' },
    agreementLabels: { pending: 'लंबित', signed: 'हस्ताक्षरित', verified: 'सत्यापित', rejected: 'अस्वीकृत' },
    payoutLabels: { pending: 'लंबित', ready: 'तैयार', paid: 'भुगतान हुआ' },
    configSectionTitle: 'चिट समूह के नियम और विवरण',
    configSectionSub: 'पूल नियम, आयोजक शुल्क, लाभांश और सदस्य सुरक्षा की सरल व्याख्या',
    winnerSectionTitle: 'विजेता इतिहास और पूल विवरण',
    totalCollected: 'कुल संग्रह',
    prizeDisbursed: 'वितरित पुरस्कार',
    dividendsShared: 'बांटा गया लाभांश',
    foremanCommission: 'फोरमैन कमीशन',
    agreementsCountLabel: 'अनुबंध सत्यापित',
    pendingPayoutsLabel: 'लंबित भुगतान',
    nextLabel: 'अगला',
    wonSuffix: 'जीते',
    noWinnersYet: 'अभी तक कोई विजेता दर्ज नहीं है। पहला चक्र पूरा होने पर विवरण यहाँ दिखेगा।',
    editGroupBtn: 'संपादित करें',
    activateGroupBtn: 'समूह सक्रिय करें',
    activatingBtn: 'सक्रिय हो रहा है…',
    cancelGroupBtn: 'समूह रद्द करें',
    cancellingBtn: 'रद्द हो रहा है…',
    autoAssignBtn: 'टिकट नंबर दें',
    assigningBtn: 'आवंटन…',
    installmentWord: 'किस्त',
    auctionHistoryTitle: 'नीलामी इतिहास',
    draftAuctionsMsg: 'समूह सक्रिय होने पर नीलामी अनुसूची स्वतः बनेगी।',
    payoutCol: 'भुगतान',
    manageBtn: 'प्रबंधन',
    enterRoomBtn: 'रूम में जाएं',
    rescheduleBtn: 'समय बदलें',
    drawBtn: 'ड्रॉ',
    resolveBtn: 'निर्णय',
    drawingBtn: 'प्रक्रिया में…',
    pdfLangLabel: 'PDF भाषा:',
    membersExpandedBtn: 'सदस्य तालिका छुपाएं',
    membersCollapsedBtn: 'सदस्य प्रबंधन / सत्यापन',
    membersNeedReviewBadge: 'सत्यापन बाकी',
    signVerifyAllBtn: 'सभी सत्यापित करें',
    verifyingAllBtn: 'सत्यापित हो रहा है…',
    signBtn: 'हस्ताक्षर',
    verifyBtn: 'सत्यापित करें',
    editBtn: 'संपादित',
    addOneTicketBtn: '+1 टिकट',
    ticketCol: 'टिकट',
    shareCol: 'हिस्सा',
    agreementCol: 'अनुबंध',
    nomineeCol: 'नामांकित',
    fullShare: 'पूर्ण',
    paymentProofsTitle: 'ग्राहक भुगतान प्रमाण',
    memberPaymentsTitle: 'सदस्य किस्त संग्रह',
    tabCurrent: 'वर्तमान',
    tabOverdue: 'बकाया',
    tabAll: 'सभी',
    allPeriodsBtn: 'सभी चक्र',
    baseCol: 'मूल राशि',
    penaltyCol: 'जुर्माना',
    netDueCol: 'शुद्ध देय',
    outstandingCol: 'बकाया',
    receiptCol: 'रसीद',
    missedBtn: 'चूका',
    statutoryTitle: 'वैधानिक रजिस्टर (चिट फंड अधिनियम 1982)',
    statutoryDesc: 'राज्य-वार फॉर्म I–VIII PDF और Excel रजिस्टर।',
    upgradeEnterpriseBtn: 'निर्यात के लिए Enterprise लें',
    enterpriseOnlyBtn: 'केवल Enterprise',
    manageForemenBtn: 'फोरमैन चुनें',
    notAssigned: 'नियुक्त नहीं',
    forfeitedOnLate: 'देर से भुगतान करने पर उस चक्र का लाभांश नहीं मिलेगा',
    keptOnLate: 'देर से भुगतान पर भी सदस्य को लाभांश मिलता रहेगा',
    noCap: 'अधिकतम सीमा नहीं',
    uncapped: 'असीमित बोली',
    commissionFloor: 'कमीशन न्यूनतम',
    upToPct: 'से',
    substCutoffLabel: 'सदस्य बदलाव की अनुमति:',
    ofGrossPot: 'कुल पूल राशि का',
    ofBidDiscount: 'जीती बोली छूट का',
    flatFeeSuffix: 'निश्चित शुल्क प्रति चक्र',
    foremanFirstPotExplain: 'पहला पॉट बिना नीलामी फोरमैन को जाता है',
    fixedDiscountNone: 'कोई निश्चित छूट नहीं (पूरा पॉट मिलता है)',
  },
  te: {
    statusLabels: { draft: 'డ్రాఫ్ట్', active: 'క్రియాశీల', completed: 'పూర్తయింది', cancelled: 'రద్దు' },
    agreementLabels: { pending: 'పెండింగ్', signed: 'సంతకం', verified: 'ధృవీకరించబడింది', rejected: 'తిరస్కరించబడింది' },
    payoutLabels: { pending: 'పెండింగ్', ready: 'సిద్ధం', paid: 'చెల్లించబడింది' },
    configSectionTitle: 'చిట్ సమూహ నియమాలు & వివరణ',
    configSectionSub: 'చిట్ నిబంధనలు, ఫోర్‌మ్యాన్ కమీషన్ మరియు సభ్యుల రక్షణల వివరణ',
    winnerSectionTitle: 'విజేతల చరిత్ర & పూల్ వివరాలు',
    totalCollected: 'మొత్తం వసూలు',
    prizeDisbursed: 'పంపిణీ చేసిన బహుమతి',
    dividendsShared: 'పంచిపెట్టిన డివిడెండ్',
    foremanCommission: 'ఫోర్‌మ్యాన్ కమీషన్',
    agreementsCountLabel: 'ఒప్పందాలు ధృవీకరించబడ్డాయి',
    pendingPayoutsLabel: 'పెండింగ్ చెల్లింపులు',
    nextLabel: 'తరువాతి',
    wonSuffix: 'గెలిచారు',
    noWinnersYet: 'ఇంకా విజేతలు లేరు. మొదటి విడత పూర్తయిన తర్వాత వివరాలు ఇక్కడ కనిపిస్తాయి.',
    editGroupBtn: 'సవరించు',
    activateGroupBtn: 'గ్రూప్ ప్రారంభించు',
    activatingBtn: 'ప్రారంభిస్తోంది…',
    cancelGroupBtn: 'గ్రూప్ రద్దు చేయి',
    cancellingBtn: 'రద్దవుతోంది…',
    autoAssignBtn: 'టికెట్ నంబర్లు కేటాయించు',
    assigningBtn: 'కేటాయిస్తోంది…',
    installmentWord: 'వాయిదా',
    auctionHistoryTitle: 'వేలం చరిత్ర',
    draftAuctionsMsg: 'గ్రూప్ ప్రారంభించిన తర్వాత వేలం షెడ్యూల్ స్వయంచాలకంగా తయారవుతుంది.',
    payoutCol: 'చెల్లింపు',
    manageBtn: 'నిర్వహించు',
    enterRoomBtn: 'గదిలోకి వెళ్ళు',
    rescheduleBtn: 'సమయం మార్చు',
    drawBtn: 'డ్రా',
    resolveBtn: 'నిర్ణయించు',
    drawingBtn: 'జరుగుతోంది…',
    pdfLangLabel: 'PDF భాష:',
    membersExpandedBtn: 'సభ్యుల పట్టికను దాచు',
    membersCollapsedBtn: 'సభ్యులు / ఒప్పంద ధృవీకరణ',
    membersNeedReviewBadge: 'ధృవీకరణ అవసరం',
    signVerifyAllBtn: 'అందరినీ ధృవీకరించు',
    verifyingAllBtn: 'ధృవీకరిస్తోంది…',
    signBtn: 'సంతకం',
    verifyBtn: 'ధృవీకరించు',
    editBtn: 'సవరించు',
    addOneTicketBtn: '+1 టికెట్',
    ticketCol: 'టికెట్',
    shareCol: 'వాటా',
    agreementCol: 'ఒప్పందం',
    nomineeCol: 'నామినీ',
    fullShare: 'పూర్తి',
    paymentProofsTitle: 'చెల్లింపు ఆధారాలు',
    memberPaymentsTitle: 'సభ్యుల వాయిదా వసూళ్లు',
    tabCurrent: 'ప్రస్తుత',
    tabOverdue: 'బకాయి',
    tabAll: 'అన్నీ',
    allPeriodsBtn: 'అన్ని విడతలు',
    baseCol: 'ప్రాథమిక',
    penaltyCol: 'అపరాధ రుసుము',
    netDueCol: 'నికర మొత్తం',
    outstandingCol: 'బకాయి',
    receiptCol: 'రసీదు',
    missedBtn: 'తప్పింది',
    statutoryTitle: 'చట్టబద్ధమైన రిజిస్టర్లు (చట్టం 1982)',
    statutoryDesc: 'రాష్ట్ర నియమాల ప్రకారం Form I–VIII PDF మరియు Excel పుస్తకాలు.',
    upgradeEnterpriseBtn: 'ఎగుమతి కోసం Enterprise కి అప్‌గ్రేడ్ చేయండి',
    enterpriseOnlyBtn: 'Enterprise మాత్రమే',
    manageForemenBtn: 'ఫోర్‌మ్యాన్‌ను ఎంచుకోండి',
    notAssigned: 'కేటాయించలేదు',
    forfeitedOnLate: 'ఆలస్యంగా చెల్లిస్తే ఆ విడత డివిడెండ్ రద్దవుతుంది',
    keptOnLate: 'ఆలస్యమైనా సభ్యులకు డివిడెండ్ తగ్గింపు వర్తిస్తుంది',
    noCap: 'గరిష్ట పరిమితి లేదు',
    uncapped: 'పరిమితి లేని బిడ్',
    commissionFloor: 'కమీషన్ కనీసం',
    upToPct: 'నుండి',
    substCutoffLabel: 'సభ్యుని మార్పు అనుమతి:',
    ofGrossPot: 'మొత్తం చిట్ విలువలో',
    ofBidDiscount: 'వేలం తగ్గింపు మొత్తంలో',
    flatFeeSuffix: 'విడతకు స్థిర రుసుము',
    foremanFirstPotExplain: 'మొదటి విడత మొత్తం వేలం లేకుండా ఫోర్‌మ్యాన్‌కు చెందుతుంది',
    fixedDiscountNone: 'స్థిర తగ్గింపు లేదు (పూర్తి చిట్ మొత్తం లభిస్తుంది)',
  },
  kn: {
    statusLabels: { draft: 'ಕರಡು', active: 'ಸಕ್ರಿಯ', completed: 'ಪೂರ್ಣ', cancelled: 'ರದ್ದು' },
    agreementLabels: { pending: 'ಬಾಕಿ', signed: 'ಸಹಿ', verified: 'ಪರಿಶೀಲಿತ', rejected: 'ತಿರಸ್ಕೃತ' },
    payoutLabels: { pending: 'ಬಾಕಿ', ready: 'ಸಿದ್ಧ', paid: 'ಪಾವತಿಸಲಾಗಿದೆ' },
    configSectionTitle: 'ಚಿಟ್ ಗುಂಪಿನ ನಿಯಮಗಳು ಮತ್ತು ವಿವರಣೆ',
    configSectionSub: 'ಗುಂಪಿನ ನಿಯಮಗಳು, ಫೋರ್‌ಮ್ಯಾನ್ ಕಮಿಷನ್ ಮತ್ತು ಸದಸ್ಯರ ರಕ್ಷಣೆಯ ಸರಳ ವಿವರಣೆ',
    winnerSectionTitle: 'ವಿಜೇತರ ಇತಿಹಾಸ ಮತ್ತು ನಿಧಿ ವಿವರ',
    totalCollected: 'ಒಟ್ಟು ಸಂಗ್ರಹ',
    prizeDisbursed: 'ನೀಡಿದ ಬಹುಮಾನ',
    dividendsShared: 'ಹಂಚಿದ ಲಾಭಾಂಶ',
    foremanCommission: 'ಫೋರ್‌ಮ್ಯಾನ್ ಕಮಿಷನ್',
    agreementsCountLabel: 'ಒಪ್ಪಂದ ಪರಿಶೀಲನೆ',
    pendingPayoutsLabel: 'ಬಾಕಿ ಪಾವತಿಗಳು',
    nextLabel: 'ಮುಂದಿನದು',
    wonSuffix: 'ಗೆದ್ದಿದ್ದಾರೆ',
    noWinnersYet: 'ಇನ್ನೂ ವಿಜೇತರು ದಾಖಲಾಗಿಲ್ಲ. ಮೊದಲ ಸುತ್ತು ಮುಗಿದ ನಂತರ ವಿವರಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.',
    editGroupBtn: 'ತಿದ್ದುಪಡಿ',
    activateGroupBtn: 'ಗುಂಪು ಪ್ರಾರಂಭಿಸಿ',
    activatingBtn: 'ಪ್ರಾರಂಭವಾಗುತ್ತಿದೆ…',
    cancelGroupBtn: 'ಗುಂಪು ರದ್ದುಮಾಡಿ',
    cancellingBtn: 'ರದ್ದಾಗುತ್ತಿದೆ…',
    autoAssignBtn: 'ಟಿಕೆಟ್ ಸಂಖ್ಯೆ ನೀಡಿ',
    assigningBtn: 'ನೀಡಲಾಗುತ್ತಿದೆ…',
    installmentWord: 'ಕಂತು',
    auctionHistoryTitle: 'ಹರಾಜು ಇತಿಹಾಸ',
    draftAuctionsMsg: 'ಗುಂಪು ಸಕ್ರಿಯವಾದಾಗ ಹರಾಜು ವೇಳಾಪಟ್ಟಿ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ರಚನೆಯಾಗುತ್ತದೆ.',
    payoutCol: 'ಪಾವತಿ',
    manageBtn: 'ನಿರ್ವಹಿಸಿ',
    enterRoomBtn: 'ಕೊಠಡಿಗೆ ಹೋಗಿ',
    rescheduleBtn: 'ಸಮಯ ಬದಲಿಸಿ',
    drawBtn: 'ಡ್ರಾ',
    resolveBtn: 'ನಿರ್ಧರಿಸಿ',
    drawingBtn: 'ನಡೆಯುತ್ತಿದೆ…',
    pdfLangLabel: 'PDF ಭಾಷೆ:',
    membersExpandedBtn: 'ಸದಸ್ಯರ ಪಟ್ಟಿ ಮರೆಮಾಡಿ',
    membersCollapsedBtn: 'ಸದಸ್ಯರು / ಒಪ್ಪಂದ ಪರಿಶೀಲನೆ',
    membersNeedReviewBadge: 'ಪರಿಶೀಲನೆ ಬಾಕಿ',
    signVerifyAllBtn: 'ಎಲ್ಲರನ್ನೂ ಪರಿಶೀಲಿಸಿ',
    verifyingAllBtn: 'ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…',
    signBtn: 'ಸಹಿ',
    verifyBtn: 'ಪರಿಶೀಲಿಸಿ',
    editBtn: 'ತಿದ್ದುಪಡಿ',
    addOneTicketBtn: '+1 ಟಿಕೆಟ್',
    ticketCol: 'ಟಿಕೆಟ್',
    shareCol: 'ಪಾಲು',
    agreementCol: 'ಒಪ್ಪಂದ',
    nomineeCol: 'ನಾಮನಿರ್ದೇಶಿತ',
    fullShare: 'ಪೂರ್ಣ',
    paymentProofsTitle: 'ಪಾವತಿ ಪುರಾವೆಗಳು',
    memberPaymentsTitle: 'ಸದಸ್ಯರ ಕಂತು ಸಂಗ್ರಹ',
    tabCurrent: 'ಪ್ರಸ್ತುತ',
    tabOverdue: 'ಬಾಕಿ',
    tabAll: 'ಎಲ್ಲಾ',
    allPeriodsBtn: 'ಎಲ್ಲಾ ಸುತ್ತುಗಳು',
    baseCol: 'ಮೂಲ',
    penaltyCol: 'ದಂಡ',
    netDueCol: 'ನಿವ್ವಳ ಬಾಕಿ',
    outstandingCol: 'ಬಾಕಿ ಮೊತ್ತ',
    receiptCol: 'ರಸೀದಿ',
    missedBtn: 'ತಪ್ಪಿದೆ',
    statutoryTitle: 'ಶಾಸನಬದ್ಧ ರಿಜಿಸ್ಟರ್‌ಗಳು (ಕಾಯ್ದೆ 1982)',
    statutoryDesc: 'ರಾಜ್ಯ ನಿಯಮಗಳ ಪ್ರಕಾರ Form I–VIII PDF ಮತ್ತು Excel ಪುಸ್ತಕಗಳು.',
    upgradeEnterpriseBtn: 'ರಫ್ತು ಮಾಡಲು Enterprise ಗೆ ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ',
    enterpriseOnlyBtn: 'Enterprise ಮಾತ್ರ',
    manageForemenBtn: 'ಫೋರ್‌ಮ್ಯಾನ್ ಆಯ್ಕೆ',
    notAssigned: 'ನಿಯೋಜಿಸಲಾಗಿಲ್ಲ',
    forfeitedOnLate: 'ತಡವಾಗಿ ಪಾವತಿಸಿದರೆ ಆ ಸುತ್ತಿನ ಲಾಭಾಂಶ ಸಿಗುವುದಿಲ್ಲ',
    keptOnLate: 'ತಡವಾದರೂ ಸದಸ್ಯರಿಗೆ ಲಾಭಾಂಶ ದೊರೆಯುತ್ತದೆ',
    noCap: 'ಗರಿಷ್ಠ ಮಿತಿ ಇಲ್ಲ',
    uncapped: 'ಮಿತಿರಹಿತ ಬಿಡ್',
    commissionFloor: 'ಕಮಿಷನ್ ಕನಿಷ್ಠ',
    upToPct: 'ರಿಂದ',
    substCutoffLabel: 'ಸದಸ್ಯರ ಬದಲಾವಣೆ ಅನುಮತಿ:',
    ofGrossPot: 'ಒಟ್ಟು ಚಿಟ್ ಮೊತ್ತದ',
    ofBidDiscount: 'ಗೆದ್ದ ಬಿಡ್ ರಿಯಾಯಿತಿಯ',
    flatFeeSuffix: 'ಪ್ರತಿ ಸುತ್ತಿಗೆ ನಿಗದಿತ ಶುಲ್ಕ',
    foremanFirstPotExplain: 'ಮೊದಲ ಸುತ್ತಿನ ಮೊತ್ತ ಹರಾಜು ಇಲ್ಲದೆ ಫೋರ್‌ಮ್ಯಾನ್‌ಗೆ ಸೇರುತ್ತದೆ',
    fixedDiscountNone: 'ನಿಗದಿತ ರಿಯಾಯಿತಿ ಇಲ್ಲ (ಪೂರ್ಣ ಮೊತ್ತ ಸಿಗುತ್ತದೆ)',
  },
  ml: {
    statusLabels: { draft: 'ഡ്രാഫ്റ്റ്', active: 'സജീവം', completed: 'പൂർത്തിയായി', cancelled: 'റദ്ദാക്കി' },
    agreementLabels: { pending: 'ബാക്കി', signed: 'ഒപ്പിട്ടു', verified: 'പരിശോധിച്ചു', rejected: 'നിരസിച്ചു' },
    payoutLabels: { pending: 'ബാക്കി', ready: 'തയ്യാർ', paid: 'നൽകി' },
    configSectionTitle: 'ചിട്ടി നിയമങ്ങളും വിശദാംശങ്ങളും',
    configSectionSub: 'ചിട്ടി രീതി, ഫോർമാൻ കമ്മീഷൻ, ഡിവിഡന്റ്, സുരക്ഷാ നിയമങ്ങളുടെ ലളിതമായ വിവരണം',
    winnerSectionTitle: 'വിജയികളുടെ ചരിത്രവും പൂൾ വിവരങ്ങളും',
    totalCollected: 'ആകെ പിരിവ്',
    prizeDisbursed: 'നൽകിയ സമ്മാനം',
    dividendsShared: 'പങ്കിട്ട ഡിവിഡന്റ്',
    foremanCommission: 'ഫോർമാൻ കമ്മീഷൻ',
    agreementsCountLabel: 'കരാർ പരിശോധന',
    pendingPayoutsLabel: 'നൽകാനുള്ള സമ്മാനം',
    nextLabel: 'അടുത്തത്',
    wonSuffix: 'ജയിച്ചു',
    noWinnersYet: 'ഇതുവരെ വിജയികളില്ല. ഒന്നാം ഘട്ടം കഴിയുമ്പോൾ വിവരങ്ങൾ ഇവിടെ വരും.',
    editGroupBtn: 'തിരുത്തുക',
    activateGroupBtn: 'ഗ്രൂപ്പ് ആരംഭിക്കുക',
    activatingBtn: 'ആരംഭിക്കുന്നു…',
    cancelGroupBtn: 'ഗ്രൂപ്പ് റദ്ദാക്കുക',
    cancellingBtn: 'റദ്ദാക്കുന്നു…',
    autoAssignBtn: 'ടിക്കറ്റ് നമ്പർ നൽകുക',
    assigningBtn: 'നൽകുന്നു…',
    installmentWord: 'തവണ',
    auctionHistoryTitle: 'ലേല ചരിത്രം',
    draftAuctionsMsg: 'ഗ്രൂപ്പ് ആരംഭിക്കുമ്പോൾ ലേല സമയക്രമം സ്വയമേവ തയ്യാറാകും.',
    payoutCol: 'വിതരണം',
    manageBtn: 'നിയന്ത്രിക്കുക',
    enterRoomBtn: 'മുറിയിൽ പ്രവേശിക്കുക',
    rescheduleBtn: 'സമയം മാറ്റുക',
    drawBtn: 'നറുക്കെടുപ്പ്',
    resolveBtn: 'തീർപ്പാക്കുക',
    drawingBtn: 'നടക്കുന്നു…',
    pdfLangLabel: 'PDF ഭാഷ:',
    membersExpandedBtn: 'അംഗങ്ങളുടെ പട്ടിക മറയ്ക്കുക',
    membersCollapsedBtn: 'അംഗങ്ങൾ / കരാർ പരിശോധന',
    membersNeedReviewBadge: 'പരിശോധന ബാക്കി',
    signVerifyAllBtn: 'എല്ലാം പരിശോധിക്കുക',
    verifyingAllBtn: 'പരിശോധിക്കുന്നു…',
    signBtn: 'ഒപ്പിടുക',
    verifyBtn: 'പരിശോധിക്കുക',
    editBtn: 'തിരുത്തുക',
    addOneTicketBtn: '+1 ടിക്കറ്റ്',
    ticketCol: 'ടിക്കറ്റ്',
    shareCol: 'ഓഹരി',
    agreementCol: 'കരാർ',
    nomineeCol: 'നോമിനി',
    fullShare: 'മുഴുവൻ',
    paymentProofsTitle: 'പേയ്‌മെന്റ് തെളിവുകൾ',
    memberPaymentsTitle: 'തവണ പിരിവ്',
    tabCurrent: 'നിലവിലുള്ളത്',
    tabOverdue: 'കുടിശ്ശിക',
    tabAll: 'എല്ലാം',
    allPeriodsBtn: 'എല്ലാ ഘട്ടങ്ങളും',
    baseCol: 'അടിസ്ഥാനം',
    penaltyCol: 'പിഴ',
    netDueCol: 'അടയ്‌ക്കേണ്ടത്',
    outstandingCol: 'ബാക്കി',
    receiptCol: 'രസീത്',
    missedBtn: 'മുടങ്ങി',
    statutoryTitle: 'നിയമപരമായ രജിസ്റ്ററുകൾ (ആക്ട് 1982)',
    statutoryDesc: 'സംസ്ഥാന ഫോം I–VIII PDF, Excel രേഖകൾ.',
    upgradeEnterpriseBtn: 'എക്സ്പോർട്ടിനായി Enterprise എടുക്കുക',
    enterpriseOnlyBtn: 'Enterprise മാത്രം',
    manageForemenBtn: 'ഫോർമാനെ തിരഞ്ഞെടുക്കുക',
    notAssigned: 'നിയമിച്ചിട്ടില്ല',
    forfeitedOnLate: 'വൈകി അടച്ചാൽ ആ ഘട്ടത്തിലെ ഡിവിഡന്റ് നഷ്ടമാകും',
    keptOnLate: 'വൈകിയാലും അംഗങ്ങൾക്ക് ഡിവിഡന്റ് ലഭിക്കും',
    noCap: 'പരമാവധി പരിധിയില്ല',
    uncapped: 'പരിധിയില്ലാത്ത ലേലം',
    commissionFloor: 'കമ്മീഷൻ കുറഞ്ഞ പരിധി',
    upToPct: 'മുതൽ',
    substCutoffLabel: 'പകരം അംഗത്തെ ചേർക്കാവുന്നത്:',
    ofGrossPot: 'ആകെ ചിട്ടി തുകയുടെ',
    ofBidDiscount: 'ലേല കിഴിവിന്റെ',
    flatFeeSuffix: 'ഒരു ഘട്ടത്തിന് നിശ്ചിത ഫീസ്',
    foremanFirstPotExplain: 'ഒന്നാം ഘട്ടം ലേലമില്ലാതെ ഫോർമാന് ലഭിക്കും',
    fixedDiscountNone: 'നിശ്ചിത കിഴിവില്ല (മുഴുവൻ ചിട്ടി തുകയും ലഭിക്കും)',
  },
};

export function getChitDetailUi(lang?: string | null): ChitDetailUiStrings {
  return DETAIL_UI[resolveChitLang(lang)];
}

export interface LedgerUiStrings {
  period: string;
  dueDate: string;
  ticket: string;
  member: string;
  share: string;
  won: string;
  prize: string;
  grossDue: string;
  dividendEarned: string;
  deferredForfeited: string;
  premInt: string;
  netPayable: string;
  paid: string;
  outstanding: string;
  netOutcome: string;
  savingsPct: string;
  forfeited: string;
  viewPeriods: string;
  hidePeriods: string;
  cycleRegisterTitle: string;
  dateCol: string;
  winnersCol: string;
  discountCol: string;
  commissionCol: string;
  distributableCol: string;
  dividendTicketCol: string;
  netInstalmentCol: string;
  roundingCol: string;
  deferredCol: string;
  premiumCol: string;
  interestCol: string;
  penaltyCol: string;
  statusCol: string;
}

const LEDGER_UI: Record<SupportedChitLang, LedgerUiStrings> = {
  en: {
    period: 'Period',
    dueDate: 'Due Date',
    ticket: 'Ticket',
    member: 'Member',
    share: 'Share',
    won: 'Won',
    prize: 'Prize',
    grossDue: 'Gross Due',
    dividendEarned: 'Dividend Earned',
    deferredForfeited: 'Deferred / Forfeited',
    premInt: 'Prem. / Int.',
    netPayable: 'Net Payable',
    paid: 'Paid',
    outstanding: 'Outstanding',
    netOutcome: 'Net Outcome',
    savingsPct: 'Savings %',
    forfeited: 'forfeited',
    viewPeriods: 'View Periods',
    hidePeriods: 'Hide',
    cycleRegisterTitle: 'Cycle-by-Cycle Calculation & Dividend Register',
    dateCol: 'Date',
    winnersCol: 'Winner(s)',
    discountCol: 'Discount',
    commissionCol: 'Commission',
    distributableCol: 'Distributable',
    dividendTicketCol: 'Dividend / Ticket',
    netInstalmentCol: 'Net Instalment',
    roundingCol: 'Rounding',
    deferredCol: 'Deferred',
    premiumCol: 'Premium',
    interestCol: 'Interest',
    penaltyCol: 'Penalty',
    statusCol: 'Status',
  },
  ta: {
    period: 'சுழற்சி',
    dueDate: 'கடைசி தேதி',
    ticket: 'டிக்கெட்',
    member: 'உறுப்பினர்',
    share: 'பங்கு',
    won: 'வெற்றி',
    prize: 'பரிசு',
    grossDue: 'மொத்த தவணை',
    dividendEarned: 'கிடைத்த டிவிடெண்ட்',
    deferredForfeited: 'சேமிப்பு / இழப்பு',
    premInt: 'பிரீமியம் / வட்டி',
    netPayable: 'செலுத்த வேண்டியது',
    paid: 'செலுத்தியது',
    outstanding: 'பாக்கி',
    netOutcome: 'நிகர லாபம்',
    savingsPct: 'சேமிப்பு %',
    forfeited: 'இழந்தது',
    viewPeriods: 'விவரம் பார்',
    hidePeriods: 'மறை',
    cycleRegisterTitle: 'சுழற்சி வாரியான கணக்கீடு & டிவிடெண்ட் பதிவேடு',
    dateCol: 'தேதி',
    winnersCol: 'வெற்றியாளர்(கள்)',
    discountCol: 'தள்ளுபடி',
    commissionCol: 'கமிஷன்',
    distributableCol: 'பகிரத்தக்கது',
    dividendTicketCol: 'டிவிடெண்ட் / டிக்கெட்',
    netInstalmentCol: 'நிகர தவணை',
    roundingCol: 'முழுமைப்படுத்தல்',
    deferredCol: 'ஒத்திவைப்பு',
    premiumCol: 'பிரீமியம்',
    interestCol: 'வட்டி',
    penaltyCol: 'அபராதம்',
    statusCol: 'நிலை',
  },
  hi: {
    period: 'चक्र',
    dueDate: 'नियत तिथि',
    ticket: 'टिकट',
    member: 'सदस्य',
    share: 'हिस्सा',
    won: 'जीता',
    prize: 'पुरस्कार',
    grossDue: 'कुल देय',
    dividendEarned: 'अर्जित लाभांश',
    deferredForfeited: 'संचित / जब्त',
    premInt: 'प्रीमियम / ब्याज',
    netPayable: 'शुद्ध देय',
    paid: 'भुगतान',
    outstanding: 'बकाया',
    netOutcome: 'शुद्ध परिणाम',
    savingsPct: 'बचत %',
    forfeited: 'जब्त',
    viewPeriods: 'चक्र देखें',
    hidePeriods: 'छुपाएं',
    cycleRegisterTitle: 'चक्र-वार गणना एवं लाभांश रजिस्टर',
    dateCol: 'तिथि',
    winnersCol: 'विजेता',
    discountCol: 'छूट',
    commissionCol: 'कमीशन',
    distributableCol: 'वितरणीय',
    dividendTicketCol: 'लाभांश / टिकट',
    netInstalmentCol: 'शुद्ध किस्त',
    roundingCol: 'राउंडिंग',
    deferredCol: 'स्थगित',
    premiumCol: 'प्रीमियम',
    interestCol: 'ब्याज',
    penaltyCol: 'जुर्माना',
    statusCol: 'स्थिति',
  },
  te: {
    period: 'విడత',
    dueDate: 'గడువు తేదీ',
    ticket: 'టికెట్',
    member: 'సభ్యుడు',
    share: 'వాటా',
    won: 'గెలుపు',
    prize: 'బహుమతి',
    grossDue: 'మొత్తం చెల్లింపు',
    dividendEarned: 'పొందిన డివిడెండ్',
    deferredForfeited: 'వాయిదా / రద్దు',
    premInt: 'ప్రీమియం / వడ్డీ',
    netPayable: 'నికర చెల్లింపు',
    paid: 'చెల్లించినది',
    outstanding: 'బకాయి',
    netOutcome: 'నికర ఫలితం',
    savingsPct: 'ఆదా %',
    forfeited: 'రద్దయింది',
    viewPeriods: 'వివరాలు చూడు',
    hidePeriods: 'దాచు',
    cycleRegisterTitle: 'విడతల వారీగా గణన & డివిడెండ్ రిజిస్టర్',
    dateCol: 'తేదీ',
    winnersCol: 'విజేత(లు)',
    discountCol: 'తగ్గింపు',
    commissionCol: 'కమీషన్',
    distributableCol: 'పంచదగినది',
    dividendTicketCol: 'డివిడెండ్ / టికెట్',
    netInstalmentCol: 'నికర వాయిదా',
    roundingCol: 'రౌండింగ్',
    deferredCol: 'వాయిదా',
    premiumCol: 'ప్రీమియం',
    interestCol: 'వడ్డీ',
    penaltyCol: 'అపరాధం',
    statusCol: 'స్థితి',
  },
  kn: {
    period: 'ಸುತ್ತು',
    dueDate: 'ಕೊನೆಯ ದಿನಾಂಕ',
    ticket: 'ಟಿಕೆಟ್',
    member: 'ಸದಸ್ಯರು',
    share: 'ಪಾಲು',
    won: 'ಗೆಲುವು',
    prize: 'ಬಹುಮಾನ',
    grossDue: 'ಒಟ್ಟು ಬಾಕಿ',
    dividendEarned: 'ಗಳಿಸಿದ ಲಾಭಾಂಶ',
    deferredForfeited: 'ಮುಂದೂಡಿದ / ಕಳೆದುಕೊಂಡ',
    premInt: 'ಪ್ರೀಮಿಯಂ / ಬಡ್ಡಿ',
    netPayable: 'ನಿವ್ವಳ ಪಾವತಿ',
    paid: 'ಪಾವತಿಸಿದ',
    outstanding: 'ಬಾಕಿ',
    netOutcome: 'ನಿವ್ವಳ ಫಲಿತಾಂಶ',
    savingsPct: 'ಉಳಿತಾಯ %',
    forfeited: 'ಕಳೆದುಕೊಂಡಿದೆ',
    viewPeriods: 'ವಿವರ ನೋಡಿ',
    hidePeriods: 'ಮರೆಮಾಡಿ',
    cycleRegisterTitle: 'ಸುತ್ತುವಾರು ಲೆಕ್ಕಾಚಾರ ಮತ್ತು ಲಾಭಾಂಶ ವಹಿ',
    dateCol: 'ದಿನಾಂಕ',
    winnersCol: 'ವಿಜೇತರು',
    discountCol: 'ರಿಯಾಯಿತಿ',
    commissionCol: 'ಕಮಿಷನ್',
    distributableCol: 'ಹಂಚಬಹುದಾದ',
    dividendTicketCol: 'ಲಾಭಾಂಶ / ಟಿಕೆಟ್',
    netInstalmentCol: 'ನಿವ್ವಳ ಕಂತು',
    roundingCol: 'ಪೂರ್ಣಾಂಕ',
    deferredCol: 'ಮುಂದೂಡಿದ',
    premiumCol: 'ಪ್ರೀಮಿಯಂ',
    interestCol: 'ಬಡ್ಡಿ',
    penaltyCol: 'ದಂಡ',
    statusCol: 'ಸ್ಥಿತಿ',
  },
  ml: {
    period: 'ഘട്ടം',
    dueDate: 'അവസാന തീയതി',
    ticket: 'ടിക്കറ്റ്',
    member: 'അംഗം',
    share: 'ഓഹരി',
    won: 'ജയിച്ചത്',
    prize: 'സമ്മാനം',
    grossDue: 'ആകെ തുക',
    dividendEarned: 'ലഭിച്ച ഡിവിഡന്റ്',
    deferredForfeited: 'മാറ്റിവെച്ചത് / നഷ്ടമായത്',
    premInt: 'പ്രീമിയം / പലിശ',
    netPayable: 'നൽകേണ്ടത്',
    paid: 'നൽകിയത്',
    outstanding: 'ബാക്കി',
    netOutcome: 'അന്തിമ ഫലം',
    savingsPct: 'ലാഭം %',
    forfeited: 'നഷ്ടമായി',
    viewPeriods: 'വിവരം കാണുക',
    hidePeriods: 'മറയ്ക്കുക',
    cycleRegisterTitle: 'ഘട്ടം തിരിച്ചുള്ള കണക്കും ഡിവിഡന്റ് രജിസ്റ്ററും',
    dateCol: 'തീയതി',
    winnersCol: 'വിജയി(കൾ)',
    discountCol: 'കിഴിവ്',
    commissionCol: 'കമ്മീഷൻ',
    distributableCol: 'പങ്കിടാവുന്നത്',
    dividendTicketCol: 'ഡിവിഡന്റ് / ടിക്കറ്റ്',
    netInstalmentCol: 'അന്തിമ തവണ',
    roundingCol: 'റൗണ്ടിംഗ്',
    deferredCol: 'മാറ്റിവെച്ചത്',
    premiumCol: 'പ്രീമിയം',
    interestCol: 'പലിശ',
    penaltyCol: 'പിഴ',
    statusCol: 'നില',
  },
};

export function getLedgerUi(lang?: string | null): LedgerUiStrings {
  return LEDGER_UI[resolveChitLang(lang)];
}

export function explainRegulatoryTier(key: string, lang?: string | null): string {
  return translateFromMap(REGULATORY_TIERS, key, lang);
}
export function explainScaleTier(key: string, lang?: string | null): string {
  return translateFromMap(SCALE_TIERS, key, lang);
}
export function explainPayoutAsset(key: string, lang?: string | null): string {
  return translateFromMap(PAYOUT_ASSETS, key, lang);
}
export function explainFrequency(key: string, lang?: string | null): string {
  return translateFromMap(FREQUENCIES, key, lang);
}
export function explainAuctionType(key: string, lang?: string | null): string {
  return translateFromMap(AUCTION_TYPES, key, lang);
}
export function explainCommissionMode(key: string, lang?: string | null): string {
  return translateFromMap(COMMISSION_MODES, key, lang);
}
export function explainDividendPolicy(key: string, lang?: string | null): string {
  return translateFromMap(DIVIDEND_POLICIES, key, lang);
}
export function explainDividendDistribution(key: string, lang?: string | null): string {
  return translateFromMap(DIVIDEND_DISTRIBUTIONS, key, lang);
}
export function explainTieBreak(key: string, lang?: string | null): string {
  return translateFromMap(TIE_BREAKERS, key, lang);
}
export function explainLateFeeType(key: string, lang?: string | null): string {
  return translateFromMap(LATE_FEE_TYPES, key, lang);
}

const CONFIG_ROW_META: Record<
  SupportedChitLang,
  {
    engineLabel: string;
    engineHelpTitle: string;
    engineHelp: string;
    scaleLabel: string;
    scaleHelpTitle: string;
    scaleHelp: string;
    commissionLabel: string;
    commissionHelpTitle: string;
    commissionHelp: string;
    foremenLabel: string;
    foremenHelpTitle: string;
    foremenHelp: string;
    dividendLabel: string;
    dividendHelpTitle: string;
    dividendHelp: string;
    timeLabel: string;
    timeHelpTitle: string;
    timeHelp: string;
    winnerIntLabel: string;
    winnerIntHelpTitle: string;
    winnerIntHelp: string;
    defaultSecLabel: string;
    defaultSecHelpTitle: string;
    defaultSecHelp: string;
    bidRulesLabel: string;
    bidRulesHelpTitle: string;
    bidRulesHelp: string;
    fixedDiscLabel: string;
    foremanTicketLabel: string;
    bylawLabel: string;
  }
> = {
  en: {
    engineLabel: 'Chit Style & Legal Rules',
    engineHelpTitle: 'How This Chit Operates',
    engineHelp: 'Shows the prize calculation formula, whether this group is registered under the 1982 Act or run privately, and how the winner is chosen each cycle.',
    scaleLabel: 'Group Size, Payout & Repeat Plan',
    scaleHelpTitle: 'Pool Scale & Collection Schedule',
    scaleHelp: 'Explains the target circle size, whether prizes are paid in cash/gold/goods, and how often members pay and hold a draw.',
    commissionLabel: 'Organizer Fee (Foreman Commission)',
    commissionHelpTitle: 'How the Organizer Earns Commission',
    commissionHelp: 'Percentage or flat fee earned by the foreman per cycle, and whether it is calculated on total pot value or the winning bid discount.',
    foremenLabel: 'Assigned Foremen / Conductors',
    foremenHelpTitle: 'Authorized Chit Conductors',
    foremenHelp: 'Staff members authorized to start auctions, ring bells, collect installments, and sign statutory registers.',
    dividendLabel: 'How Savings (Dividend) Are Shared',
    dividendHelpTitle: 'Auction Discount & Dividend Rule',
    dividendHelp: 'After subtracting foreman commission from the winning discount, the remainder is shared with subscribers according to this rule.',
    timeLabel: 'Usual Auction Start Time',
    timeHelpTitle: 'Scheduled Cycle Time',
    timeHelp: 'Default time of day when auctions or lucky draws begin for this group.',
    winnerIntLabel: 'Post-Prize Winner Interest',
    winnerIntHelpTitle: 'Winner Extra Charge',
    winnerIntHelp: 'Optional interest added to a member’s remaining installments after they win and take the prize early.',
    defaultSecLabel: 'Late Payment & Safety Rules',
    defaultSecHelpTitle: 'Subscriber Default Safeguards',
    defaultSecHelp: 'Controls whether late payers lose that cycle’s dividend, any late penalty fee, and up to what pool completion % defaulting seats can be replaced.',
    bidRulesLabel: 'Bidding Discount Limits & Tie Rule',
    bidRulesHelpTitle: 'Fair Bidding Guardrails',
    bidRulesHelp: 'Sets minimum and maximum discount allowed during live bidding so the prize stays fair, plus how exact ties are decided.',
    fixedDiscLabel: 'Fixed Prize Discount',
    foremanTicketLabel: 'Foreman First Turn',
    bylawLabel: 'Registration & Bylaw Ref.',
  },
  ta: {
    engineLabel: 'சீட்டு வகை & சட்ட விதி',
    engineHelpTitle: 'சீட்டு செயல்படும் முறை',
    engineHelp: 'பரிசுக் கணக்கீட்டு முறை, அரசு 1982 சட்டப் பதிவா அல்லது தனியார் சீட்டா, மற்றும் வெற்றியாளர் தேர்வு முறையை விளக்குகிறது.',
    scaleLabel: 'குழு அளவு, வழங்கல் & கால அட்டவணை',
    scaleHelpTitle: 'சீட்டு அளவு & தவணை சுழற்சி',
    scaleHelp: 'குழுவின் அளவு, பணம்/தங்கம்/பொருள் வடிவம் மற்றும் எத்தனை நாட்களுக்கு ஒருமுறை தவணை என்பதை காட்டுகிறது.',
    commissionLabel: 'போர்மேன் கமிஷன் விதி',
    commissionHelpTitle: 'நிர்வாகி கமிஷன் கணக்கீடு',
    commissionHelp: 'ஒவ்வொரு சுழற்சியிலும் போர்மேன் பெறும் கமிஷன் சதவீதம் (மொத்த சீட்டுத் தொகையா அல்லது ஏலத் தள்ளுபடியா).',
    foremenLabel: 'நியமிக்கப்பட்ட போர்மேன்கள்',
    foremenHelpTitle: 'அங்கீகரிக்கப்பட்ட போர்மேன்கள்',
    foremenHelp: 'ஏலம் நடத்தவும், மணி அடிக்கவும், பதிவேடுகளில் கையொப்பமிடவும் அதிகாரம் பெற்ற ஊழியர்கள்.',
    dividendLabel: 'டிவிடெண்ட் (சேமிப்பு) பகிர்வு',
    dividendHelpTitle: 'ஏலத் தள்ளுபடி பகிர்வு விதி',
    dividendHelp: 'ஏலத் தள்ளுபடியில் போர்மேன் கமிஷன் போக மீதமுள்ள தொகை உறுப்பினர்களுக்கு எவ்வாறு குறைக்கப்படும் என்பதை விளக்குகிறது.',
    timeLabel: 'வழக்கமான ஏல நேரம்',
    timeHelpTitle: 'சுழற்சி தொடங்கும் நேரம்',
    timeHelp: 'இந்த குழுவின் ஏலம் அல்லது குலுக்கல் தொடங்கும் நிலையான நேரம்.',
    winnerIntLabel: 'வெற்றியாளர் கூடுதல் வட்டி',
    winnerIntHelpTitle: 'பரிசு பெற்ற பின் வட்டி விதி',
    winnerIntHelp: 'பரிசு பெற்ற உறுப்பினர் மீதமுள்ள தவணைகளில் கூடுதல் வட்டி செலுத்த வேண்டுமா என்பதை காட்டுகிறது.',
    defaultSecLabel: 'தாமதக் கட்டணம் & பாதுகாப்பு விதி',
    defaultSecHelpTitle: 'தவணை தாமத பாதுகாப்புகள்',
    defaultSecHelp: 'தாமதமாக செலுத்தினால் டிவிடெண்ட் இழப்பு உள்ளதா, அபராதம் எவ்வளவு, மற்றும் எந்த நிலையில் புதிய உறுப்பினர் மாற்றலாம்.',
    bidRulesLabel: 'ஏலத் தள்ளுபடி வரம்பு & சமநிலை விதி',
    bidRulesHelpTitle: 'ஏலப் பாதுகாப்பு வரம்புகள்',
    bidRulesHelp: 'ஏலத்தில் அனுமதிக்கப்படும் குறைந்தபட்ச மற்றும் அதிகபட்ச தள்ளுபடி சதவீதம் மற்றும் சம ஏலம் ஏற்பட்டால் தீர்க்கும் முறை.',
    fixedDiscLabel: 'நிலையான தள்ளுபடி',
    foremanTicketLabel: 'போர்மேன் முதல் சுழற்சி',
    bylawLabel: 'பதிவு & துணைவிதி எண்',
  },
  hi: {
    engineLabel: 'चिट प्रकार और कानूनी नियम',
    engineHelpTitle: 'चिट संचालन का तरीका',
    engineHelp: 'यह बताता है कि पुरस्कार कैसे तय होता है, समूह अधिनियम 1982 के तहत पंजीकृत है या निजी है।',
    scaleLabel: 'समूह आकार, भुगतान माध्यम और आवृत्ति',
    scaleHelpTitle: 'पूल आकार और संग्रह चक्र',
    scaleHelp: 'चिट का स्तर, नकद/सोना/वस्तु भुगतान और किस्त जमा करने का अंतराल दर्शाता है।',
    commissionLabel: 'आयोजक शुल्क (फोरमैन कमीशन)',
    commissionHelpTitle: 'कमीशन की गणना',
    commissionHelp: 'प्रत्येक चक्र में फोरमैन का शुल्क प्रतिशत या निश्चित राशि और उसका आधार।',
    foremenLabel: 'नियुक्त फोरमैन',
    foremenHelpTitle: 'अधिकृत संचालक',
    foremenHelp: 'नीलामी संचालित करने और रजिस्टर प्रमाणित करने वाले अधिकृत कर्मचारी।',
    dividendLabel: 'बचत (लाभांश) वितरण नियम',
    dividendHelpTitle: 'लाभांश साझा करने का नियम',
    dividendHelp: 'कमीशन घटाने के बाद बची बोली छूट सदस्यों के बीच कैसे बांटी जाती है।',
    timeLabel: 'सामान्य नीलामी समय',
    timeHelpTitle: 'नियमित समय',
    timeHelp: 'नीलामी या ड्रॉ शुरू होने का निर्धारित समय।',
    winnerIntLabel: 'विजेता अतिरिक्त ब्याज',
    winnerIntHelpTitle: 'पुरस्कार के बाद ब्याज',
    winnerIntHelp: 'पहले पुरस्कार लेने वाले विजेता की शेष किस्तों पर कोई अतिरिक्त ब्याज लागू है या नहीं।',
    defaultSecLabel: 'विलंब और सुरक्षा नियम',
    defaultSecHelpTitle: 'डिफ़ॉल्ट सुरक्षा नियम',
    defaultSecHelp: 'देर से भुगतान पर लाभांश नियम, विलंब शुल्क और सदस्य प्रतिस्थापन सीमा।',
    bidRulesLabel: 'बोली छूट सीमा और टाई नियम',
    bidRulesHelpTitle: 'बोली सीमा नियम',
    bidRulesHelp: 'न्यूनतम व अधिकतम बोली छूट और समान बोली आने पर विजेता चुनने का तरीका।',
    fixedDiscLabel: 'निश्चित छूट',
    foremanTicketLabel: 'फोरमैन पहला टिकट',
    bylawLabel: 'पंजीकरण और उप-नियम सं.',
  },
  te: {
    engineLabel: 'చిట్ రకం & చట్టపరమైన నియమం',
    engineHelpTitle: 'చిట్ నిర్వహణ విధానం',
    engineHelp: 'బహుమతి లెక్కింపు సూత్రం, ప్రభుత్వ చట్టం 1982 నమోదు మరియు విజేత ఎంపిక విధానాన్ని వివరిస్తుంది.',
    scaleLabel: 'సమూహ పరిమాణం, చెల్లింపు & వ్యవధి',
    scaleHelpTitle: 'పూల్ పరిమాణం & వసూలు సమయం',
    scaleHelp: 'నగదు/బంగారం రకం మరియు ఎంత కాలానికోసారి వాయిదా కట్టాలో సూచిస్తుంది.',
    commissionLabel: 'ఫోర్‌మ్యాన్ కమీషన్',
    commissionHelpTitle: 'నిర్వాహక కమీషన్ లెక్క',
    commissionHelp: 'ప్రతి విడతలో ఫోర్‌మ్యాన్ తీసుకునే కమీషన్ మరియు దాని ఆధారం.',
    foremenLabel: 'నియమించబడిన ఫోర్‌మెన్',
    foremenHelpTitle: 'అధికారిక నిర్వాహకులు',
    foremenHelp: 'వేలం నిర్వహించడానికి మరియు రిజిస్టర్లపై సంతకం చేయడానికి అనుమతి ఉన్న సిబ్బంది.',
    dividendLabel: 'డివిడెండ్ (పొదుపు) పంపిణీ',
    dividendHelpTitle: 'డివిడెండ్ భాగస్వామ్య నియమం',
    dividendHelp: 'కమీషన్ పోగా మిగిలిన వేలం తగ్గింపును సభ్యులందరికీ ఎలా పంచుతారో వివరిస్తుంది.',
    timeLabel: 'సాధారణ వేలం సమయం',
    timeHelpTitle: 'నిర్ణీత సమయం',
    timeHelp: 'వేలం లేదా లాటరీ ప్రారంభమయ్యే రోజువారీ సమయం.',
    winnerIntLabel: 'విజేత అదనపు వడ్డీ',
    winnerIntHelpTitle: 'బహుమతి తర్వాత వడ్డీ',
    winnerIntHelp: 'బహుమతి తీసుకున్న తర్వాత మిగిలిన వాయిదాలపై వడ్డీ ఉందా లేదా అని చూపిస్తుంది.',
    defaultSecLabel: 'ఆలస్య చెల్లింపు & భద్రత నియమాలు',
    defaultSecHelpTitle: 'భద్రతా నిబంధనలు',
    defaultSecHelp: 'ఆలస్య రుసుము, డివిడెండ్ నిబంధనలు మరియు సభ్యుల మార్పు పరిమితి.',
    bidRulesLabel: 'బిడ్డింగ్ పరిమితులు & టై నియమం',
    bidRulesHelpTitle: 'బిడ్ నియంత్రణలు',
    bidRulesHelp: 'కనీస మరియు గరిష్ట తగ్గింపు పరిమితులు మరియు సమాన బిడ్ పరిష్కారం.',
    fixedDiscLabel: 'స్థిర తగ్గింపు',
    foremanTicketLabel: 'ఫోర్‌మ్యాన్ మొదటి విడత',
    bylawLabel: 'నమోదు & బైలా నం.',
  },
  kn: {
    engineLabel: 'ಚಿಟ್ ಶೈಲಿ ಮತ್ತು ಕಾನೂನು ನಿಯಮ',
    engineHelpTitle: 'ಚಿಟ್ ನಡೆಯುವ ವಿಧಾನ',
    engineHelp: 'ಬಹುಮಾನ ಲೆಕ್ಕಾಚಾರ, 1982 ಕಾಯ್ದೆ ನೋಂದಣಿ ಮತ್ತು ವಿಜೇತರ ಆಯ್ಕೆ ವಿಧಾನವನ್ನು ವಿವರಿಸುತ್ತದೆ.',
    scaleLabel: 'ಗುಂಪಿನ ಗಾತ್ರ, ಪಾವತಿ ಮತ್ತು ಅವಧಿ',
    scaleHelpTitle: 'ಪೂಲ್ ಗಾತ್ರ ಮತ್ತು ಕಂತು ವೇಳಾಪಟ್ಟಿ',
    scaleHelp: 'ನಗದು/ಚಿನ್ನದ ವಿಧಾನ ಮತ್ತು ಸದಸ್ಯರು ಎಷ್ಟು ದಿನಗಳಿಗೊಮ್ಮೆ ಪಾವತಿಸುತ್ತಾರೆ ಎಂಬುದನ್ನು ತೋರಿಸುತ್ತದೆ.',
    commissionLabel: 'ಫೋರ್‌ಮ್ಯಾನ್ ಕಮಿಷನ್',
    commissionHelpTitle: 'ಸಂಘಟಕರ ಶುಲ್ಕದ ಲೆಕ್ಕ',
    commissionHelp: 'ಪ್ರತಿ ಸುತ್ತಿನಲ್ಲಿ ಫೋರ್‌ಮ್ಯಾನ್ ಪಡೆಯುವ ಕಮಿಷನ್ ಶೇಕಡಾ ಮತ್ತು ಆಧಾರ.',
    foremenLabel: 'ನಿಯೋಜಿತ ಫೋರ್‌ಮ್ಯಾನ್‌ಗಳು',
    foremenHelpTitle: 'ಅಧಿಕೃತ ನಿರ್ವಾಹಕರು',
    foremenHelp: 'ಹರಾಜು ನಡೆಸಲು ಮತ್ತು ವಹಿಗಳಿಗೆ ಸಹಿ ಮಾಡಲು ಅಧಿಕಾರ ಹೊಂದಿರುವ ಸಿಬ್ಬಂದಿ.',
    dividendLabel: 'ಲಾಭಾಂಶ ಹಂಚಿಕೆ ನಿಯಮ',
    dividendHelpTitle: 'ಉಳಿತಾಯ ಹಂಚಿಕೆ ವಿಧಾನ',
    dividendHelp: 'ಕಮಿಷನ್ ಕಳೆದ ನಂತರ ಉಳಿದ ಬಿಡ್ ರಿಯಾಯಿತಿಯನ್ನು ಸದಸ್ಯರಿಗೆ ಹೇಗೆ ನೀಡಲಾಗುತ್ತದೆ.',
    timeLabel: 'ಸಾಮಾನ್ಯ ಹರಾಜು ಸಮಯ',
    timeHelpTitle: 'ನಿಗದಿತ ಸಮಯ',
    timeHelp: 'ಹರಾಜು ಅಥವಾ ಲಾಟರಿ ಪ್ರಾರಂಭವಾಗುವ ಸಮಯ.',
    winnerIntLabel: 'ವಿಜೇತರ ಹೆಚ್ಚುವರಿ ಬಡ್ಡಿ',
    winnerIntHelpTitle: 'ಬಹುಮಾನದ ನಂತರದ ಬಡ್ಡಿ',
    winnerIntHelp: 'ಬಹುಮಾನ ಪಡೆದ ನಂತರ ಉಳಿದ ಕಂತುಗಳಿಗೆ ಹೆಚ್ಚುವರಿ ಬಡ್ಡಿ ಇದೆಯೇ ಎಂಬುದನ್ನು ತೋರಿಸುತ್ತದೆ.',
    defaultSecLabel: 'ವಿಳಂಬ ಮತ್ತು ಸುರಕ್ಷತಾ ನಿಯಮಗಳು',
    defaultSecHelpTitle: 'ಸುರಕ್ಷತಾ ನಿಯಮಗಳು',
    defaultSecHelp: 'ವಿಳಂಬ ಶುಲ್ಕ, ಲಾಭಾಂಶ ನಿಯಮ ಮತ್ತು ಸದಸ್ಯರ ಬದಲಾವಣೆ ಮಿತಿ.',
    bidRulesLabel: 'ಬಿಡ್ ಮಿತಿಗಳು ಮತ್ತು ಟೈ ನಿಯಮ',
    bidRulesHelpTitle: 'ಬಿಡ್ಡಿಂಗ್ ನಿಯಮಗಳು',
    bidRulesHelp: 'ಕನಿಷ್ಠ ಹಾಗೂ ಗರಿಷ್ಠ ರಿಯಾಯಿತಿ ಮಿತಿ ಮತ್ತು ಸಮಾನ ಬಿಡ್ ನಿರ್ಧಾರ.',
    fixedDiscLabel: 'ನಿಗದಿತ ರಿಯಾಯಿತಿ',
    foremanTicketLabel: 'ಫೋರ್‌ಮ್ಯಾನ್ ಮೊದಲ ಸುತ್ತು',
    bylawLabel: 'ನೋಂದಣಿ ಮತ್ತು ಬೈಲಾ ಸಂಖ್ಯೆ',
  },
  ml: {
    engineLabel: 'ചിട്ടി രീതിയും നിയമങ്ങളും',
    engineHelpTitle: 'ചിട്ടി പ്രവർത്തിക്കുന്ന വിധം',
    engineHelp: 'സമ്മാന കണക്കുകൂട്ടൽ, 1982 നിയമ പ്രകാരമുള്ള രജിസ്ട്രേഷൻ, വിജയിയെ തിരഞ്ഞെടുക്കുന്ന രീതി എന്നിവ വ്യക്തമാക്കുന്നു.',
    scaleLabel: 'ഗ്രൂപ്പ് വലുപ്പം, വിതരണം & ഇടവേള',
    scaleHelpTitle: 'പൂൾ വലുപ്പവും പിരിവ് ഇടവേളയും',
    scaleHelp: 'സമ്മാനം പണമാണോ സ്വർണ്ണമാണോ എന്നും തവണകൾ എത്ര ദിവസത്തിലൊരിക്കലാണെന്നും കാണിക്കുന്നു.',
    commissionLabel: 'ഫോർമാൻ കമ്മീഷൻ',
    commissionHelpTitle: 'ഓർഗനൈസർ ഫീസ് കണക്ക്',
    commissionHelp: 'ഓരോ ഘട്ടത്തിലും ഫോർമാന് ലഭിക്കുന്ന കമ്മീഷൻ നിരക്കും അടിസ്ഥാനവും.',
    foremenLabel: 'നിയമിച്ച ഫോർമാൻമാർ',
    foremenHelpTitle: 'അംഗീകൃത നടത്തിപ്പുകാർ',
    foremenHelp: 'ലേലം നടത്താനും രജിസ്റ്ററുകളിൽ ഒപ്പിടാനും അധികാരമുള്ള ജീവനക്കാർ.',
    dividendLabel: 'ഡിവിഡന്റ് (ലാഭവിഹിതം) പങ്കിടൽ',
    dividendHelpTitle: 'ലാഭവിഹിതം നൽകുന്ന വിധം',
    dividendHelp: 'കമ്മീഷൻ കിഴിച്ച ശേഷമുള്ള ലേല കിഴിവ് അംഗങ്ങൾക്ക് എങ്ങനെ ലഭിക്കുമെന്ന് വിശദീകരിക്കുന്നു.',
    timeLabel: 'ലേല സമയം',
    timeHelpTitle: 'നിശ്ചിത സമയം',
    timeHelp: 'ലേലമോ നറുക്കെടുപ്പോ തുടങ്ങുന്ന സാധാരണ സമയം.',
    winnerIntLabel: 'വിജയിയുടെ അധിക പലിശ',
    winnerIntHelpTitle: 'സമ്മാനത്തിന് ശേഷമുള്ള പലിശ',
    winnerIntHelp: 'സമ്മാനം വാങ്ങിയ ശേഷം ബാക്കി തവണകളിൽ പലിശ ഉണ്ടോ എന്ന് വ്യക്തമാക്കുന്നു.',
    defaultSecLabel: 'വൈകിയ പേയ്‌മെന്റും സുരക്ഷാ നിയമങ്ങളും',
    defaultSecHelpTitle: 'സുരക്ഷാ ക്രമീകരണങ്ങൾ',
    defaultSecHelp: 'വൈകി അടച്ചാലുള്ള പിഴ, ഡിവിഡന്റ് നിയമം, അംഗത്തെ മാറ്റാനുള്ള പരിധി.',
    bidRulesLabel: 'ലേല കിഴിവ് പരിധിയും ടൈ നിയമവും',
    bidRulesHelpTitle: 'ലേല നിയന്ത്രണങ്ങൾ',
    bidRulesHelp: 'കുറഞ്ഞതും കൂടിയതുമായ കിഴിവ് പരിധികളും ഒരേ തുക വന്നാൽ തീരുമാനിക്കുന്ന രീതിയും.',
    fixedDiscLabel: 'നിശ്ചിത കിഴിവ്',
    foremanTicketLabel: 'ഫോർമാൻ ഒന്നാം ഘട്ടം',
    bylawLabel: 'രജിസ്ട്രേഷൻ & ബൈലോ നം.',
  },
};

export function getChitConfigMeta(lang?: string | null) {
  return CONFIG_ROW_META[resolveChitLang(lang)];
}

export interface ChitWizardUiStrings {
  steps: [string, string, string, string];
  guides: [string, string, string, string];
  allPlans: string;
  catAuction: string;
  catFixed: string;
  catMicroGold: string;
  catEnterprise: string;
  scrollCards: string;
  usePlanContinue: string;
  regSectionTitle: string;
  regSectionDesc: string;
  poolSectionTitle: string;
  poolSectionDesc: string;
  rulesSectionTitle: string;
  rulesSectionDesc: string;
  membersSectionTitle: string;
  membersSectionDesc: string;
  reviewGroupTitle: string;
  reviewMoneyTitle: string;
  editStepBtn: string;
  potLabel: string;
  membersUnit: string;
  feeLabel: string;
  groupNameRequiredErr: string;
}

const WIZARD_UI: Record<SupportedChitLang, ChitWizardUiStrings> = {
  en: {
    steps: ['1. Pick Chit Style', '2. Legal & Pool Money', '3. Rules & Members', '4. Review & Create'],
    guides: [
      'Pick a plan card below — scroll sideways to compare options, or tap the "i" icon on any plan to see how it works.',
      'Choose whether this chit is a Private circle or Government Registered (Act 1982), then confirm group name, pot value, and schedule.',
      'These rules are pre-filled safely from your chosen plan. Change anything if needed, or add members now (or Quick-Add later).',
      'Double-check your summary in plain language below, then click Create Chit Group. Groups start safely in Draft mode.',
    ],
    allPlans: 'All Chit Plans',
    catAuction: 'Bidding & Auction',
    catFixed: 'Fixed & Lucky Draw',
    catMicroGold: 'Daily & Gold',
    catEnterprise: 'Enterprise & Business',
    scrollCards: 'Scroll cards →',
    usePlanContinue: 'Use This Plan & Continue →',
    regSectionTitle: 'A. Government Registration Type',
    regSectionDesc: 'Pick the legal type that matches how this group is run.',
    poolSectionTitle: 'B. Pool Money, Members & Schedule',
    poolSectionDesc: 'Give this group a clear name, confirm pool value, member count, and when collections repeat.',
    rulesSectionTitle: 'A. Foreman Commission, Dividend Sharing & Security',
    rulesSectionDesc: 'Control foreman fee, how savings are shared with subscribers, and live bidding safeguards.',
    membersSectionTitle: 'B. Add Members Now (Optional)',
    membersSectionDesc: 'Click + next to a customer to assign one or more tickets.',
    reviewGroupTitle: 'Group & Schedule',
    reviewMoneyTitle: 'Money & Members',
    editStepBtn: 'Edit',
    potLabel: 'Pot',
    membersUnit: 'members',
    feeLabel: 'fee',
    groupNameRequiredErr: 'Please enter a name for your chit group before continuing.',
  },
  ta: {
    steps: ['1. சீட்டு வகை தேர்வு', '2. சட்டம் & நிதி விவரம்', '3. விதிகள் & உறுப்பினர்கள்', '4. சரிபார்த்து உருவாக்கு'],
    guides: [
      'கீழே உள்ள திட்ட அட்டைகளில் ஒன்றைத் தேர்ந்தெடுக்கவும் — பக்கவாட்டில் நகர்த்தி ஒப்பிடலாம் அல்லது "i" குறியை அழுத்தி விளக்கம் பார்க்கலாம்.',
      'இது தனியார் குழுவா அல்லது அரசு பதிவு (சட்டம் 1982) சீட்டா என்பதைத் தேர்ந்தெடுத்து, குழு பெயர், சீட்டுத் தொகை மற்றும் அட்டவணையை உறுதிப்படுத்தவும்.',
      'உங்கள் திட்டத்திற்கேற்ப விதிகள் தானாக நிரப்பப்பட்டுள்ளன. தேவையானால் மாற்றவும் அல்லது உறுப்பினர்களை இப்போதே சேர்க்கவும்.',
      'கீழே உள்ள சுருக்கத்தைச் சரிபார்த்து "குழுவை உருவாக்கு" பொத்தானை அழுத்தவும். குழு முதலில் வரைவு (Draft) நிலையில் தொடங்கும்.',
    ],
    allPlans: 'அனைத்து திட்டங்கள்',
    catAuction: 'ஏல முறை சீட்டு',
    catFixed: 'நிலையான & குலுக்கல்',
    catMicroGold: 'தினசரி & தங்கம்',
    catEnterprise: 'வணிக & பெருநிறுவனம்',
    scrollCards: 'பக்கவாட்டில் நகர்த்தவும் →',
    usePlanContinue: 'இந்த திட்டத்தை தேர்ந்து தொடரவும் →',
    regSectionTitle: 'A. அரசு பதிவு வகை',
    regSectionDesc: 'இந்த சீட்டு குழு எந்த முறையில் நடத்தப்படுகிறது என்பதைத் தேர்ந்தெடுக்கவும்.',
    poolSectionTitle: 'B. சீட்டுத் தொகை, உறுப்பினர்கள் & அட்டவணை',
    poolSectionDesc: 'குழு பெயர், மொத்த சீட்டுத் தொகை, உறுப்பினர் எண்ணிக்கை மற்றும் தவணை காலத்தை உள்ளிடவும்.',
    rulesSectionTitle: 'A. போர்மேன் கமிஷன், டிவிடெண்ட் & பாதுகாப்பு விதிகள்',
    rulesSectionDesc: 'போர்மேன் கமிஷன், லாபப் பகிர்வு மற்றும் பிணை விதிகளை அமைக்கவும்.',
    membersSectionTitle: 'B. உறுப்பினர்களைச் சேர் (விருப்பம்)',
    membersSectionDesc: 'டிக்கெட் ஒதுக்க வாடிக்கையாளர் அருகிலுள்ள + பொத்தானை அழுத்தவும்.',
    reviewGroupTitle: 'குழு & அட்டவணை',
    reviewMoneyTitle: 'நிதி & உறுப்பினர்கள்',
    editStepBtn: 'திருத்து',
    potLabel: 'தொகை',
    membersUnit: 'உறுப்பினர்கள்',
    feeLabel: 'கமிஷன்',
    groupNameRequiredErr: 'தொடர்வதற்கு முன் சீட்டு குழுவின் பெயரை உள்ளிடவும்.',
  },
  hi: {
    steps: ['1. चिट प्लान चुनें', '2. पंजीकरण व राशि', '3. नियम व सदस्य', '4. समीक्षा व निर्माण'],
    guides: [
      'नीचे दिए गए किसी प्लान कार्ड को चुनें — बाएँ/दाएँ स्क्रॉल करें या विवरण देखने के लिए "i" आइकन दबाएँ।',
      'चुनें कि यह निजी समूह है या सरकारी पंजीकृत (अधिनियम 1982), फिर समूह नाम, राशि और समय-सारणी तय करें।',
      'ये नियम आपके प्लान के अनुसार पहले से भरे हैं। आवश्यकता अनुसार बदलें या अभी सदस्य जोड़ें।',
      'नीचे सरल सारांश जांचें और चिट समूह बनाएं पर क्लिक करें। नया समूह ड्राफ्ट स्थिति में बनेगा।',
    ],
    allPlans: 'सभी प्लान',
    catAuction: 'नीलामी व बोली',
    catFixed: 'निश्चित व लकी ड्रॉ',
    catMicroGold: 'दैनिक व सोना',
    catEnterprise: 'व्यापार व एंटरप्राइज',
    scrollCards: 'आगे स्क्रॉल करें →',
    usePlanContinue: 'यह प्लान चुनें और आगे बढ़ें →',
    regSectionTitle: 'A. पंजीकरण प्रकार',
    regSectionDesc: 'समूह के संचालन का कानूनी प्रकार चुनें।',
    poolSectionTitle: 'B. पूल राशि, सदस्य व समय-सारणी',
    poolSectionDesc: 'समूह का नाम, कुल राशि, सदस्य संख्या और संग्रह चक्र दर्ज करें।',
    rulesSectionTitle: 'A. फोरमैन कमीशन, लाभांश व सुरक्षा नियम',
    rulesSectionDesc: 'फोरमैन शुल्क, बचत वितरण और जमानत नियम नियंत्रित करें।',
    membersSectionTitle: 'B. अभी सदस्य जोड़ें (वैकल्पिक)',
    membersSectionDesc: 'टिकट देने के लिए ग्राहक के सामने + पर क्लिक करें।',
    reviewGroupTitle: 'समूह व समय-सारणी',
    reviewMoneyTitle: 'राशि व सदस्य',
    editStepBtn: 'संपादित',
    potLabel: 'राशि',
    membersUnit: 'सदस्य',
    feeLabel: 'शुल्क',
    groupNameRequiredErr: 'आगे बढ़ने से पहले कृपया चिट समूह का नाम दर्ज करें।',
  },
  te: {
    steps: ['1. చిట్ రకం ఎంచుకోండి', '2. చట్టం & నగదు', '3. నియమాలు & సభ్యులు', '4. సమీక్ష & సృష్టించు'],
    guides: [
      'క్రింది ప్లాన్ కార్డులలో ఒకదాన్ని ఎంచుకోండి — పక్కకు స్క్రోల్ చేసి పోల్చండి లేదా "i" ఐకాన్ నొక్కి వివరాలు చూడండి.',
      'ఇది ప్రైవేట్ చిట్ లేదా ప్రభుత్వ నమోదిత (చట్టం 1982) చిట్ అని ఎంచుకుని, పేరు మరియు మొత్తాన్ని నిర్ధారించండి.',
      'మీ ప్లాన్ ప్రకారం నియమాలు ముందుగానే నింపబడ్డాయి. అవసరమైతే మార్చండి లేదా ఇప్పుడే సభ్యులను చేర్చండి.',
      'క్రింది సారాంశాన్ని పరిశీలించి చిట్ గ్రూప్ సృష్టించండి క్లిక్ చేయండి.',
    ],
    allPlans: 'అన్ని ప్లాన్లు',
    catAuction: 'వేలం & బిడ్డింగ్',
    catFixed: 'స్థిర & లక్కీ డ్రా',
    catMicroGold: 'రోజువారీ & బంగారం',
    catEnterprise: 'వ్యాపార & ఎంటర్‌ప్రైజ్',
    scrollCards: 'పక్కకు స్క్రోల్ చేయండి →',
    usePlanContinue: 'ఈ ప్లాన్ ఎంచుకుని కొనసాగండి →',
    regSectionTitle: 'A. ప్రభుత్వ నమోదు రకం',
    regSectionDesc: 'ఈ గ్రూప్ నడిపే చట్టపరమైన విధానాన్ని ఎంచుకోండి.',
    poolSectionTitle: 'B. పూల్ మొత్తం, సభ్యులు & షెడ్యూల్',
    poolSectionDesc: 'గ్రూప్ పేరు, మొత్తం విలువ, సభ్యుల సంఖ్య మరియు వాయిదా సమయాన్ని నమోదు చేయండి.',
    rulesSectionTitle: 'A. ఫోర్‌మ్యాన్ కమీషన్, డివిడెండ్ & భద్రత',
    rulesSectionDesc: 'కమీషన్, పొదుపు పంపిణీ మరియు వేలం భద్రతా నియమాలను సర్దుబాటు చేయండి.',
    membersSectionTitle: 'B. ఇప్పుడే సభ్యులను చేర్చండి (ఐచ్ఛికం)',
    membersSectionDesc: 'టికెట్ కేటాయించడానికి కస్టమర్ పక్కన + క్లిక్ చేయండి.',
    reviewGroupTitle: 'గ్రూప్ & షెడ్యూల్',
    reviewMoneyTitle: 'డబ్బు & సభ్యులు',
    editStepBtn: 'మార్చు',
    potLabel: 'మొత్తం',
    membersUnit: 'సభ్యులు',
    feeLabel: 'రుసుము',
    groupNameRequiredErr: 'కొనసాగే ముందు దయచేసి చిట్ గ్రూప్ పేరును నమోదు చేయండి.',
  },
  kn: {
    steps: ['1. ಚಿಟ್ ಶೈಲಿ ಆಯ್ಕೆ', '2. ಕಾನೂನು & ಮೊತ್ತ', '3. ನಿಯಮಗಳು & ಸದಸ್ಯರು', '4. ಪರಿಶೀಲಿಸಿ ರಚಿಸಿ'],
    guides: [
      'ಕೆಳಗಿನ ಯೋಜನೆ ಕಾರ್ಡ್‌ಗಳಲ್ಲಿ ಒಂದನ್ನು ಆಯ್ಕೆಮಾಡಿ — ಪಕ್ಕಕ್ಕೆ ಸ್ಕ್ರಾಲ್ ಮಾಡಿ ಅಥವಾ ವಿವರಕ್ಕಾಗಿ "i" ಐಕಾನ್ ಒತ್ತಿ.',
      'ಇದು ಖಾಸಗಿ ಗುಂಪೇ ಅಥವಾ ಸರ್ಕಾರಿ ನೋಂದಾಯಿತ (ಕಾಯ್ದೆ 1982) ಗುಂಪೇ ಎಂಬುದನ್ನು ಆರಿಸಿ, ಹೆಸರು ಮತ್ತು ಮೊತ್ತವನ್ನು ಖಚಿತಪಡಿಸಿ.',
      'ಆಯ್ಕೆ ಮಾಡಿದ ಯೋಜನೆಗೆ ತಕ್ಕಂತೆ ನಿಯಮಗಳನ್ನು ತುಂಬಲಾಗಿದೆ. ಬೇಕಿದ್ದರೆ ಬದಲಾಯಿಸಿ ಅಥವಾ ಈಗಲೇ ಸದಸ್ಯರನ್ನು ಸೇರಿಸಿ.',
      'ಕೆಳಗಿನ ಸಾರಾಂಶವನ್ನು ಪರಿಶೀಲಿಸಿ ಚಿಟ್ ಗುಂಪು ರಚಿಸಿ ಕ್ಲಿಕ್ ಮಾಡಿ.',
    ],
    allPlans: 'ಎಲ್ಲಾ ಯೋಜನೆಗಳು',
    catAuction: 'ಹರಾಜು & ಬಿಡ್ಡಿಂಗ್',
    catFixed: 'ನಿಗದಿತ & ಲಕ್ಕಿ ಡ್ರಾ',
    catMicroGold: 'ದೈನಂದಿನ & ಚಿನ್ನ',
    catEnterprise: 'ವ್ಯಾಪಾರ & ಎಂಟರ್‌ಪ್ರೈಸ್',
    scrollCards: 'ಪಕ್ಕಕ್ಕೆ ಸ್ಕ್ರಾಲ್ ಮಾಡಿ →',
    usePlanContinue: 'ಈ ಯೋಜನೆಯನ್ನು ಆರಿಸಿ ಮುಂದುವರಿಯಿರಿ →',
    regSectionTitle: 'A. ಸರ್ಕಾರಿ ನೋಂದಣಿ ಪ್ರಕಾರ',
    regSectionDesc: 'ಈ ಗುಂಪು ನಡೆಯುವ ಕಾನೂನು ವಿಧಾನವನ್ನು ಆಯ್ಕೆಮಾಡಿ.',
    poolSectionTitle: 'B. ಪೂಲ್ ಮೊತ್ತ, ಸದಸ್ಯರು & ವೇಳಾಪಟ್ಟಿ',
    poolSectionDesc: 'ಗುಂಪಿನ ಹೆಸರು, ಒಟ್ಟು ಮೊತ್ತ, ಸದಸ್ಯರ ಸಂಖ್ಯೆ ಮತ್ತು ಕಂತಿನ ಅವಧಿಯನ್ನು ನಮೂದಿಸಿ.',
    rulesSectionTitle: 'A. ಫೋರ್‌ಮ್ಯಾನ್ ಕಮಿಷನ್, ಲಾಭಾಂಶ & ಸುರಕ್ಷತೆ',
    rulesSectionDesc: 'ಕಮಿಷನ್, ಉಳಿತಾಯ ಹಂಚಿಕೆ ಮತ್ತು ಹರಾಜು ಸುರಕ್ಷತಾ ನಿಯಮಗಳನ್ನು ಹೊಂದಿಸಿ.',
    membersSectionTitle: 'B. ಈಗಲೇ ಸದಸ್ಯರನ್ನು ಸೇರಿಸಿ (ಐಚ್ಛಿಕ)',
    membersSectionDesc: 'ಟಿಕೆಟ್ ನೀಡಲು ಗ್ರಾಹಕರ ಪಕ್ಕದ + ಕ್ಲಿಕ್ ಮಾಡಿ.',
    reviewGroupTitle: 'ಗುಂಪು & ವೇಳಾಪಟ್ಟಿ',
    reviewMoneyTitle: 'ಹಣ & ಸದಸ್ಯರು',
    editStepBtn: 'ತಿದ್ದು',
    potLabel: 'ಮೊತ್ತ',
    membersUnit: 'ಸದಸ್ಯರು',
    feeLabel: 'ಶುಲ್ಕ',
    groupNameRequiredErr: 'ಮುಂದುವರಿಯುವ ಮೊದಲು ಚಿಟ್ ಗುಂಪಿನ ಹೆಸರನ್ನು ನಮೂದಿಸಿ.',
  },
  ml: {
    steps: ['1. ചിട്ടി രീതി തിരഞ്ഞെടുക്കുക', '2. നിയമവും തുകയും', '3. നിയമങ്ങളും അംഗങ്ങളും', '4. പരിശോധിച്ച് നിർമ്മിക്കുക'],
    guides: [
      'താഴെയുള്ള പ്ലാൻ കാർഡുകളിൽ ഒന്ന് തിരഞ്ഞെടുക്കുക — വശങ്ങളിലേക്ക് സ്ക്രോൾ ചെയ്യുക അല്ലെങ്കിൽ വിശദാംശങ്ങൾക്ക് "i" അമർത്തുക.',
      'ഇത് സ്വകാര്യ ചിട്ടിയാണോ സർക്കാർ രജിസ്റ്റർ ചെയ്ത (ആക്ട് 1982) ചിട്ടിയാണോ എന്ന് തിരഞ്ഞെടുത്ത് തുകയും സമയക്രമവും ഉറപ്പാക്കുക.',
      'നിങ്ങളുടെ പ്ലാൻ അനുസരിച്ച് നിയമങ്ങൾ സ്വയമേവ പൂരിപ്പിച്ചിട്ടുണ്ട്. ആവശ്യമെങ്കിൽ മാറ്റം വരുത്തുകയോ അംഗങ്ങളെ ചേർക്കുകയോ ചെയ്യാം.',
      'താഴെയുള്ള വിവരങ്ങൾ പരിശോധിച്ച് ചിട്ടി ഗ്രൂപ്പ് സൃഷ്ടിക്കുക ക്ലിക്ക് ചെയ്യുക.',
    ],
    allPlans: 'എല്ലാ പ്ലാനുകളും',
    catAuction: 'ലേല രീതി',
    catFixed: 'നിശ്ചിതവും നറുക്കെടുപ്പും',
    catMicroGold: 'ദിവസേനയും സ്വർണ്ണവും',
    catEnterprise: 'ബിസിനസ്സ് & എന്റർപ്രൈസ്',
    scrollCards: 'വശത്തേക്ക് സ്ക്രോൾ ചെയ്യുക →',
    usePlanContinue: 'ഈ പ്ലാൻ തിരഞ്ഞെടുത്ത് തുടരുക →',
    regSectionTitle: 'A. സർക്കാർ രജിസ്ട്രേഷൻ തരം',
    regSectionDesc: 'ഈ ഗ്രൂപ്പ് പ്രവർത്തിക്കുന്ന നിയമപരമായ രീതി തിരഞ്ഞെടുക്കുക.',
    poolSectionTitle: 'B. ചിട്ടി തുക, അംഗങ്ങൾ & സമയക്രമം',
    poolSectionDesc: 'ഗ്രൂപ്പിന്റെ പേര്, ആകെ തുക, അംഗങ്ങളുടെ എണ്ണം, ഇടവേള എന്നിവ നൽകുക.',
    rulesSectionTitle: 'A. ഫോർമാൻ കമ്മീഷൻ, ഡിവിഡന്റ് & സുരക്ഷ',
    rulesSectionDesc: 'ഫോർമാൻ ഫീസും ലാഭവിഹിതവും ലേല സുരക്ഷാ നിയമങ്ങളും ക്രമീകരിക്കുക.',
    membersSectionTitle: 'B. ഇപ്പോൾ അംഗങ്ങളെ ചേർക്കുക (ഐച്ഛികം)',
    membersSectionDesc: 'ടിക്കറ്റ് നൽകാൻ ഉപഭോക്താവിന് അടുത്തുള്ള + ക്ലിക്ക് ചെയ്യുക.',
    reviewGroupTitle: 'ഗ്രൂപ്പും സമയക്രമവും',
    reviewMoneyTitle: 'തുകയും അംഗങ്ങളും',
    editStepBtn: 'തിരുത്തുക',
    potLabel: 'തുക',
    membersUnit: 'അംഗങ്ങൾ',
    feeLabel: 'ഫീസ്',
    groupNameRequiredErr: 'തുടരുന്നതിന് മുമ്പ് ദയവായി ചിട്ടി ഗ്രൂപ്പിന് ഒരു പേര് നൽകുക.',
  },
};

export function getChitWizardUi(lang?: string | null): ChitWizardUiStrings {
  return WIZARD_UI[resolveChitLang(lang)];
}
