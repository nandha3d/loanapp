'use client';

import React, { useEffect, useState } from 'react';
import { en } from '@/i18n/en';
import { ta } from '@/i18n/ta';
import { hi } from '@/i18n/hi';
import { te } from '@/i18n/te';
import { kn } from '@/i18n/kn';
import { ml } from '@/i18n/ml';
import { CHIT_ENGINE_CATALOG, type ChitEngineType } from '@/lib/chits/engineTypes';
import type { ChitTemplateDefinition } from '@/lib/chits/templates';

type LocaleKey = 'en' | 'ta' | 'hi' | 'te' | 'kn' | 'ml';

const LOCALE_META: { code: LocaleKey; nativeName: string; englishName: string; accent: string; bg: string }[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', accent: '#1d4ed8', bg: '#eff6ff' },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', accent: '#047857', bg: '#ecfdf5' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', accent: '#b45309', bg: '#fffbeb' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu', accent: '#7c3aed', bg: '#f5f3ff' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada', accent: '#be123c', bg: '#fff1f2' },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam', accent: '#0f766e', bg: '#f0fdfa' },
];

const ALL_DICTS: Record<LocaleKey, any> = { en, ta, hi, te, kn, ml };

interface EngineVisualBlueprint {
  formulaText: string;
  payoutPct: number;
  dividendPct: number;
  commissionPct: number;
  stepIcons: [string, string, string, string];
  exampleRows: {
    cycle: string;
    pot: string;
    discountOrRule: string;
    winnerGets: string;
    memberNextDue: string;
  }[];
  flowSteps: Record<LocaleKey, [string, string, string, string]>;
  bestFor: Record<LocaleKey, string>;
}

const ENGINE_VISUAL_BLUEPRINTS: Record<ChitEngineType, EngineVisualBlueprint> = {
  AUCTION_STANDARD: {
    formulaText: 'Prize = V − D  |  Commission = 5% × V  |  Dividend/Ticket = (D − Comm) ÷ N',
    payoutPct: 80,
    dividendPct: 15,
    commissionPct: 5,
    stepIcons: ['account_balance_wallet', 'gavel', 'percent', 'savings'],
    exampleRows: [
      { cycle: 'Month 1 (High Need)', pot: '₹1,00,000', discountOrRule: '₹20,000 Bid Discount', winnerGets: '₹80,000', memberNextDue: '₹8,500 (₹1,500 Div)' },
      { cycle: 'Month 5 (Mid Cycle)', pot: '₹1,00,000', discountOrRule: '₹12,000 Bid Discount', winnerGets: '₹88,000', memberNextDue: '₹9,300 (₹700 Div)' },
      { cycle: 'Month 10 (Last Cycle)', pot: '₹1,00,000', discountOrRule: '₹5,000 Floor (5%)', winnerGets: '₹95,000', memberNextDue: '₹10,000 (₹0 Div)' },
    ],
    flowSteps: {
      en: ['10 members contribute ₹10,000 base pot (₹1,00,000)', 'Non-prized members bid discount in live room', '5% Foreman commission (₹5,000) deducted from discount', 'Winner gets ₹80,000; ₹15,000 shared as ₹1,500 dividend/member'],
      ta: ['10 உறுப்பினர்கள் தலா ₹10,000 சந்தா (மொத்தம் ₹1,00,000)', 'பரிசு பெறாதவர்கள் ஏலத்தில் தள்ளுபடி கோருவர்', '5% நடத்துனர் கமிஷன் (₹5,000) தள்ளுபடியில் கழிக்கப்படும்', 'வெற்றியாளருக்கு ₹80,000; மீதி ₹15,000 தலா ₹1,500 டிவிடெண்டாகக் கழியும்'],
      hi: ['10 सदस्य ₹10,000 मासिक जमा करते हैं (कुल ₹1,00,000)', 'गैर-विजेता सदस्य लाइव नीलामी में छूट की बोली लगाते हैं', '5% फोरमैन कमीशन (₹5,000) छूट से काटा जाता है', 'विजेता को ₹80,000 मिलते हैं; ₹15,000 सभी में ₹1,500 लाभांश बँटता है'],
      te: ['10 మంది సభ్యులు తలా ₹10,000 జమ చేస్తారు (మొత్తం ₹1,00,000)', 'బహుమతి పొందని సభ్యులు వేలంలో డిస్కౌంట్ పాడుతారు', '5% ఫోర్‌మన్ కమిషన్ (₹5,000) డిస్కౌంట్ నుండి తగ్గించబడుతుంది', 'విజేతకు ₹80,000 అందుతుంది; ₹15,000 తలా ₹1,500 డివిడెండ్‌గా తగ్గుతుంది'],
      kn: ['10 ಸದಸ್ಯರು ತಲಾ ₹10,000 ಪಾವತಿಸುತ್ತಾರೆ (ಒಟ್ಟು ₹1,00,000)', 'ಬಹುಮಾನ ಪಡೆಯದ ಸದಸ್ಯರು ಹರಾಜಿನಲ್ಲಿ ರಿಯಾಯಿತಿ ಕೂಗುತ್ತಾರೆ', '5% ಫೋರ್‌ಮನ್ ಕಮಿಷನ್ (₹5,000) ರಿಯಾಯಿತಿಯಿಂದ ಕಡಿತಗೊಳ್ಳುತ್ತದೆ', 'ವಿಜೇತರಿಗೆ ₹80,000 ಸಿಗುತ್ತದೆ; ₹15,000 ತಲಾ ₹1,500 ಲಾಭಾಂಶವಾಗಿ ಕಡಿತವಾಗುತ್ತದೆ'],
      ml: ['10 അംഗങ്ങൾ ₹10,000 വീതം അടയ്ക്കുന്നു (ആകെ ₹1,00,000)', 'സമ്മാനം ലഭിക്കാത്തവർ ലേലത്തിൽ കിഴിവ് വിളിക്കുന്നു', '5% ഫോർമാൻ കമ്മീഷൻ (₹5,000) കിഴിവിൽ നിന്ന് കുറയ്ക്കുന്നു', 'വിജയിക്ക് ₹80,000 ലഭിക്കുന്നു; ₹15,000 ആളൊന്നിന് ₹1,500 വീതം ഡിവിഡന്റായി കുറയും'],
    },
    bestFor: {
      en: 'Best for standard registered & commercial chit groups needing transparent dividend reduction.',
      ta: 'வணிக மற்றும் பதிவு செய்யப்பட்ட ஏலச் சீட்டு குழுக்களுக்கு மிகவும் ஏற்றது.',
      hi: 'पारदर्शी लाभांश कटौती वाले व्यावसायिक और पंजीकृत चिट समूहों के लिए सर्वोत्तम।',
      te: 'పారదర్శక డివిడెండ్ తగ్గింపు కోరుకునే వ్యాపార మరియు రిజిస్టర్డ్ చిట్ గ్రూపులకు ఉత్తమం.',
      kn: 'ಪಾರದರ್ಶಕ ಲಾಭಾಂಶ ಕಡಿತ ಬಯಸುವ ವಾಣಿಜ್ಯ ಮತ್ತು ನೋಂದಾಯಿತ ಚಿಟ್ ಗುಂಪುಗಳಿಗೆ ಸೂಕ್ತ.',
      ml: 'സുതാര്യമായ ലാഭവിഹിതമുള്ള വാണിജ്യ-രജിസ്റ്റേർഡ് ചിട്ടികൾക്ക് ഏറ്റവും അനുയോജ്യം.',
    },
  },
  AUCTION_RESERVE_PRICE: {
    formulaText: 'Reserve Floor R_t = (x% × V) × (N − t + 1)  |  Bid must be ≥ R_t',
    payoutPct: 85,
    dividendPct: 10,
    commissionPct: 5,
    stepIcons: ['trending_down', 'gavel', 'casino', 'payments'],
    exampleRows: [
      { cycle: 'Month 1 (10 rem)', pot: '₹1,00,000', discountOrRule: 'Min Floor 15% (₹15,000)', winnerGets: '≤ ₹85,000', memberNextDue: '≤ ₹9,000 (≥₹1,000 Div)' },
      { cycle: 'Month 5 (6 rem)', pot: '₹1,00,000', discountOrRule: 'Min Floor 9% (₹9,000)', winnerGets: '≤ ₹91,000', memberNextDue: '≤ ₹9,600 (≥₹400 Div)' },
      { cycle: 'Month 10 (1 rem)', pot: '₹1,00,000', discountOrRule: 'Min Floor 1.5% (₹1,500)', winnerGets: '₹95,000', memberNextDue: '₹10,000' },
    ],
    flowSteps: {
      en: ['System computes declining reserve floor R_t for current month', 'Bidders must bid at or above R_t (or lottery runs at R_t)', '5% commission deducted; remaining discount forms dividend pool', 'Guarantees fair minimum dividend in early months without cartel under-bidding'],
      ta: ['ஒவ்வொரு மாதமும் குறையும் குறைந்தபட்ச ஏல வரம்பு R_t கணக்கிடப்படும்', 'உறுப்பினர்கள் R_t-க்கு மேல் ஏலம் கேட்க வேண்டும் (இல்லையெனில் குலுக்கல்)', '5% கமிஷன் போக மீதித் தொகை டிவிடெண்டாகப் பகிரப்படும்', 'ஆரம்ப மாதங்களில் குறைந்தபட்ச டிவிடெண்ட் உறுதியாகக் கிடைக்கும்'],
      hi: ['सिस्टम प्रत्येक माह के लिए घटती न्यूनतम बोली सीमा R_t तय करता है', 'सदस्यों को R_t या उससे अधिक बोली लगानी होती है (वरना लॉटरी)', '5% कमीशन काटकर शेष छूट लाभांश में बाँटी जाती है', 'शुरुआती महीनों में सभी सदस्यों को निश्चित न्यूनतम लाभांश मिलता है'],
      te: ['ప్రతి నెలా తగ్గుతూ వచ్చే కనీస వేలం పరిమితి R_t లెక్కించబడుతుంది', 'సభ్యులు R_t కంటే ఎక్కువ పాడాలి (లేదంటే లాటరీ ద్వారా ఎంపిక)', '5% కమిషన్ పోగా మిగిలిన మొత్తం డివిడెండ్‌గా పంచబడుతుంది', 'మొదటి నెలల్లో అందరికీ కనీస డివిడెండ్ గ్యారంటీగా లభిస్తుంది'],
      kn: ['ಪ್ರತಿ ತಿಂಗಳು ಇಳಿಕೆಯಾಗುವ ಕನಿಷ್ಠ ಬಿಡ್ ಮಿತಿ R_t ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತದೆ', 'ಸದಸ್ಯರು R_t ಗಿಂತ ಹೆಚ್ಚು ಬಿಡ್ ಮಾಡಬೇಕು (ಇಲ್ಲದಿದ್ದರೆ ಲಾಟರಿ ಆಯ್ಕೆ)', '5% ಕಮಿಷನ್ ಕಳೆದು ಉಳಿದ ರಿಯಾಯಿತಿ ಲಾಭಾಂಶವಾಗಿ ಹಂಚಿಕೆಯಾಗುತ್ತದೆ', 'ಆರಂಭಿಕ ತಿಂಗಳುಗಳಲ್ಲಿ ಖಚಿತ ಕನಿಷ್ಠ ಲಾಭಾಂಶವನ್ನು ಖಾತರಿಪಡಿಸುತ್ತದೆ'],
      ml: ['ഓരോ മാസവും കുറയുന്ന കുറഞ്ഞ ലേല പരിധി R_t കണക്കാക്കുന്നു', 'അംഗങ്ങൾ R_t-ൽ കൂടുതൽ ലേലം വിളിക്കണം (അല്ലെങ്കിൽ നറുക്കെടുപ്പ്)', '5% കമ്മീഷൻ കഴിഞ്ഞ് ബാക്കി തുക ഡിവിഡന്റായി പങ്കിടുന്നു', 'ആദ്യ മാസങ്ങളിൽ ഉറപ്പായ ലാഭവിഹിതം എല്ലാവർക്കും ലഭിക്കുന്നു'],
    },
    bestFor: {
      en: 'Prevents bidder rings/cartels from taking early pots at rock-bottom discounts.',
      ta: 'குறைந்த தள்ளுபடியில் ஆரம்ப மாதச் சீட்டை எடுப்பதைத் தடுக்கும் பாதுகாப்பான முறை.',
      hi: 'शुरुआती महीनों में कम छूट पर पॉट उठाने से रोकने के लिए उत्तम मॉडल।',
      te: 'మొదటి నెలల్లో తక్కువ డిస్కౌంట్‌కు పాట పోకుండా నివారించే సురక్షిత విధానం.',
      kn: 'ಆರಂಭಿಕ ತಿಂಗಳುಗಳಲ್ಲಿ ಕಡಿಮೆ ರಿಯಾಯಿತಿಗೆ ಚೀಟಿ ಹೋಗುವುದನ್ನು ತಡೆಯಲು ಉತ್ತಮ.',
      ml: 'ആദ്യ മാസങ്ങളിൽ കുറഞ്ഞ കിഴിവിൽ ചിട്ടി പോകുന്നത് തടയാൻ ഏറ്റവും മികച്ചത്.',
    },
  },
  AUCTION_MULTI_DIVISION: {
    formulaText: '1 Lottery Winner (95% Pot) + 3 Auction Winners  |  Total Dividend = Σ(D_j − Comm) ÷ N',
    payoutPct: 82,
    dividendPct: 13,
    commissionPct: 5,
    stepIcons: ['groups', 'casino', 'gavel', 'Call_Split'],
    exampleRows: [
      { cycle: 'Division A (Lottery)', pot: '₹2,00,000', discountOrRule: 'Lucky Draw (5% Comm only)', winnerGets: '₹1,90,000', memberNextDue: 'Shares Pooled Div' },
      { cycle: 'Divisions B, C, D', pot: '₹2,00,000 × 3', discountOrRule: '3 Competitive Auctions', winnerGets: '₹1,50,000–₹1,75,000', memberNextDue: 'Pooled Div Credited' },
    ],
    flowSteps: {
      en: ['Large group collects 4 pots per cycle (1 Lottery + 3 Auctions)', '1 Lucky draw winner receives full pot minus 5% commission', '3 Auction winners bid competitively; their net discounts are pooled', 'Combined dividend pool is divided equally across all members'],
      ta: ['ஒவ்வொரு மாதமும் 4 பிரிவுகள் (1 குலுக்கல் + 3 ஏலம்) நடைபெறும்', 'குலுக்கல் வெற்றியாளருக்கு 5% கமிஷன் போக முழுத் தொகை (₹1,90,000) கிடைக்கும்', '3 ஏல வெற்றியாளர்களின் தள்ளுபடி ஒன்றாகத் தொகுக்கப்படும்', 'மொத்த டிவிடெண்ட் அனைத்து உறுப்பினர்களுக்கும் சமமாகப் பகிரப்படும்'],
      hi: ['प्रत्येक चक्र में 4 विजेता (1 लॉटरी + 3 नीलामी) चुने जाते हैं', 'लॉटरी विजेता को केवल 5% कमीशन काटकर पूरी राशि मिलती है', '3 नीलामी विजेताओं की छूट को एक साथ जोड़ा जाता है', 'कुल लाभांश पूल सभी सदस्यों में बराबर बाँटा जाता है'],
      te: ['ప్రతి నెల 4 విభాగాలు (1 లాటరీ + 3 వేలంపాటలు) జరుగుతాయి', 'లాటరీ విజేతకు 5% కమిషన్ పోగా పూర్తి మొత్తం లభిస్తుంది', '3 వేలం విజేతల డిస్కౌంట్లు కలిపి ఒకే డివిడెండ్ పూల్ అవుతుంది', 'మొత్తం డివిడెండ్ అందరు సభ్యులకు సమానంగా పంచబడుతుంది'],
      kn: ['ಪ್ರತಿ ತಿಂಗಳು 4 ವಿಜೇತರು (1 ಲಾಟರಿ + 3 ಹರಾಜು) ಆಯ್ಕೆಯಾಗುತ್ತಾರೆ', 'ಲಾಟರಿ ವಿಜೇತರಿಗೆ 5% ಕಮಿಷನ್ ಕಳೆದು ಪೂರ್ಣ ಮೊತ್ತ ಸಿಗುತ್ತದೆ', '3 ಹರಾಜು ವಿಜೇತರ ರಿಯಾಯಿತಿಗಳನ್ನು ಒಟ್ಟಾಗಿ ಸೇರಿಸಲಾಗುತ್ತದೆ', 'ಒಟ್ಟು ಲಾಭಾಂಶವನ್ನು ಎಲ್ಲಾ ಸದಸ್ಯರಿಗೆ ಸಮಾನವಾಗಿ ಹಂಚಲಾಗುತ್ತದೆ'],
      ml: ['ഓരോ മാസവും 4 വിജയികൾ (1 നറുക്കെടുപ്പ് + 3 ലേലം)', 'നറുക്കെടുപ്പ് വിജയിക്ക് 5% കമ്മീഷൻ കഴിഞ്ഞ് മുഴുവൻ തുകയും ലഭിക്കും', '3 ലേല വിജയികളുടെ കിഴിവുകൾ ഒരുമിച്ച് ചേർക്കുന്നു', 'ആകെ ലാഭവിഹിതം എല്ലാ അംഗങ്ങൾക്കും തുല്യമായി വീതിക്കുന്നു'],
    },
    bestFor: {
      en: 'Ideal for KSFE-style large multi-division chitties combining lucky draw excitement with auction dividends.',
      ta: 'KSFE பாணி பெரிய பல்பிரிவு சீட்டு நிறுவனங்களுக்கு மிகவும் ஏற்றது.',
      hi: 'KSFE शैली के बड़े सिंडिकेट समूहों के लिए आदर्श जहाँ लॉटरी और नीलामी दोनों का लाभ मिलता है।',
      te: 'లాటరీ మరియు వేలం రెండింటి ప్రయోజనాలు అందించే KSFE తరహా పెద్ద చిట్టీలకు ఉత్తమం.',
      kn: 'ಲಾಟರಿ ಮತ್ತು ಹರಾಜು ಎರಡರ ಲಾಭ ನೀಡುವ KSFE ಮಾದರಿಯ ದೊಡ್ಡ ಚಿಟ್‌ಗಳಿಗೆ ಸೂಕ್ತ.',
      ml: 'നറുക്കെടുപ്പും ലേലവും ഒത്തുചേരുന്ന KSFE മാതൃകയിലുള്ള മൾട്ടി-ഡിവിഷൻ ചിട്ടികൾക്ക് ഉത്തമം.',
    },
  },
  AUCTION_UNCAPPED_ENTERPRISE: {
    formulaText: 'Uncapped Discount (No 30%–40% Ceiling)  |  Strict Collateral Gate before Payout',
    payoutPct: 68,
    dividendPct: 27,
    commissionPct: 5,
    stepIcons: ['business_center', 'Trending_Up', 'verified_user', 'account_balance'],
    exampleRows: [
      { cycle: 'Cycle 1 (Urgent ROI)', pot: '₹5,00,000', discountOrRule: '45% Bid Discount (₹2,25,000)', winnerGets: '₹2,75,000', memberNextDue: '₹30,000 (₹20,000 Div)' },
      { cycle: 'Cycle 6 (Moderate)', pot: '₹5,00,000', discountOrRule: '20% Bid Discount (₹1,00,000)', winnerGets: '₹4,00,000', memberNextDue: '₹42,500 (₹7,500 Div)' },
    ],
    flowSteps: {
      en: ['High-ticket trader pool (₹5,00,000+) collected from verified business members', 'Open bidding without 30%–40% statutory discount cap', 'Mandatory property/gold/guarantor collateral verification gate', 'Massive early dividends for savers; immediate working capital for traders'],
      ta: ['வணிகர்களுக்கான உயர் மதிப்பு சீட்டு தொகுப்பு (₹5,00,000+)', '30%–40% உச்ச வரம்பின்றி திறந்தவெளி ஏலம் நடைபெறும்', 'பரிசுத் தொகை வழங்கும் முன் சொத்து/ஜாமீன் ஆவண சரிபார்ப்பு கட்டாயம்', 'சேமிப்பாளர்களுக்கு அதிக டிவிடெண்ட்; வியாபாரிகளுக்கு உடனடி மூலதனம்'],
      hi: ['व्यापारियों के लिए उच्च-मूल्य पूल (₹5,00,000+) एकत्र किया जाता है', '30%–40% छूट सीमा के बिना खुली प्रतिस्पर्धी बोली लगती है', 'भुगतान से पहले संपत्ति/गहने/गारंटर सुरक्षा सत्यापन अनिवार्य है', 'निवेशकों को भारी लाभांश और व्यापारियों को तुरंत कार्यशील पूँजी मिलती है'],
      te: ['వ్యాపారుల కోసం అధిక విలువ గల చిట్ ఫండ్ (₹5,00,000+)', '30%–40% గరిష్ట పరిమితి లేకుండా స్వేచ్ఛా వేలంపాట జరుగుతుంది', 'పేఅవుట్‌కు ముందు ఆస్తి/బంగారం/జామీను ధృవీకరణ తప్పనిసరి', 'పొదుపు చేసేవారికి భారీ డివిడెండ్, వ్యాపారులకు తక్షణ పెట్టుబడి లభిస్తుంది'],
      kn: ['ವ್ಯಾಪಾರಿಗಳಿಗಾಗಿ ಹೆಚ್ಚಿನ ಮೌಲ್ಯದ ಚಿಟ್ ನಿಧಿ (₹5,00,000+)', '30%–40% ರಿಯಾಯಿತಿ ಮಿತಿಯಿಲ್ಲದೆ ಮುಕ್ತ ಸ್ಪರ್ಧಾತ್ಮಕ ಹರಾಜು', 'ಹಣ ಬಿಡುಗಡೆಗೆ ಮುನ್ನ ಆಸ್ತಿ/ಚಿನ್ನ/ಜಾಮೀನು ದಾಖಲೆ ಪರಿಶೀಲನೆ ಕಡ್ಡಾಯ', 'ಉಳಿತಾಯದಾರರಿಗೆ ಹೆಚ್ಚಿನ ಲಾಭಾಂಶ ಮತ್ತು ವ್ಯಾಪಾರಿಗಳಿಗೆ ತಕ್ಷಣದ ಬಂಡವಾಳ'],
      ml: ['വ്യാപാരികൾക്കായുള്ള ഉയർന്ന മൂല്യമുള്ള ചിട്ടി (₹5,00,000+)', '30%–40% കിഴിവ് പരിധിയില്ലാതെ തുറന്ന ലേലം നടക്കുന്നു', 'തുക നൽകുന്നതിന് മുമ്പ് വസ്തു/സ്വർണ്ണം/ജാമ്യ പരിശോധന നിർബന്ധം', 'നിക്ഷേപകർക്ക് ഉയർന്ന ലാഭവിഹിതവും വ്യാപാരികൾക്ക് വേഗത്തിൽ മൂലധനവും'],
    },
    bestFor: {
      en: 'Built for wholesale market traders & Bishi syndicates needing fast high-yield working capital.',
      ta: 'மொத்த வியாபாரிகள் மற்றும் வர்த்தக சிண்டிகேட் குழுக்களுக்கு ஏற்றது.',
      hi: 'थोक व्यापारियों और बिशी सिंडिकेट समूहों के लिए विशेष रूप से निर्मित।',
      te: 'హోల్‌సేల్ వ్యాపారులు మరియు బిషి సిండికేట్ గ్రూపులకు ప్రత్యేకంగా రూపొందించబడింది.',
      kn: 'ಸಗಟು ವ್ಯಾಪಾರಿಗಳು ಮತ್ತು ಬಿಶಿ ಸಿಂಡಿಕೇಟ್ ಗುಂಪುಗಳಿಗೆ ವಿಶೇಷವಾಗಿ ನಿರ್ಮಿಸಲಾಗಿದೆ.',
      ml: 'മൊത്തവ്യാപാരികൾക്കും ബിസിനസ് സിൻഡിക്കേറ്റുകൾക്കും അനുയോജ്യം.',
    },
  },
  BASE_PLUS_PREMIUM: {
    formulaText: 'Non-Prized Due = Base (B)  |  Prized Due = Base (B) + Premium (P)  |  Pool = B×N + P×k',
    payoutPct: 90,
    dividendPct: 5,
    commissionPct: 5,
    stepIcons: ['layers', 'gavel', 'add_chart', 'price_check'],
    exampleRows: [
      { cycle: 'Before Winning', pot: '₹1,00,000', discountOrRule: 'Pay Base Due Only', winnerGets: 'Bids in Auction', memberNextDue: '₹9,000 / month' },
      { cycle: 'After Winning', pot: '₹1,00,000+', discountOrRule: 'Base + ₹2,000 Premium', winnerGets: 'Already Prized', memberNextDue: '₹11,000 / month' },
    ],
    flowSteps: {
      en: ['Unprized members pay lower Base instalment B (₹9,000/mo)', 'Winner lifts pot via auction or draw', 'From next cycle, prized winner pays Base + Premium B + P (₹11,000/mo)', 'Extra premium from prized members boosts the pool and reduces burden on late savers'],
      ta: ['பரிசு பெறாதவர்கள் குறைந்த அடிப்படைத் தவணை ₹9,000 மட்டும் செலுத்துவர்', 'ஏலம் அல்லது குலுக்கல் மூலம் வெற்றியாளர் தேர்வு செய்யப்படுவார்', 'பரிசு பெற்ற அடுத்த மாதம் முதல் வெற்றியாளர் ₹9,000 + ₹2,000 = ₹11,000 செலுத்துவார்', 'முதலில் எடுத்தவர்களின் கூடுதல் தவணை கடைசி வரை காத்திருப்பவர்களுக்கு லாபம் தரும்'],
      hi: ['गैर-पुरस्कृत सदस्य कम मूल किस्त B (₹9,000/माह) देते हैं', 'नीलामी या ड्रॉ द्वारा विजेता पॉट उठाता है', 'अगले महीने से विजेता मूल + प्रीमियम (₹9,000 + ₹2,000 = ₹11,000) देता है', 'विजेताओं के अतिरिक्त प्रीमियम से देर तक रुकने वाले सदस्यों को सीधा लाभ मिलता है'],
      te: ['పాట పాడని సభ్యులు తక్కువ బేస్ వాయిదా (₹9,000) మాత్రమే చెల్లిస్తారు', 'వేలం లేదా డ్రా ద్వారా విజేత ఎంపిక చేయబడతారు', 'గెలిచిన తదుపరి నెల నుండి విజేత ₹9,000 + ₹2,000 ప్రీమియం = ₹11,000 కడతారు', 'ముందుగా పాడినవారి అదనపు ప్రీమియం చివరి వరకు ఉండేవారికి లాభం చేకూరుస్తుంది'],
      kn: ['ಬಹುಮಾನ ಪಡೆಯದವರು ಕಡಿಮೆ ಮೂಲ ಕಂತು (₹9,000) ಮಾತ್ರ ಪಾವತಿಸುತ್ತಾರೆ', 'ಹರಾಜು ಅಥವಾ ಡ್ರಾ ಮೂಲಕ ವಿಜೇತರನ್ನು ಆಯ್ಕೆ ಮಾಡಲಾಗುತ್ತದೆ', 'ಗೆದ್ದ ಮುಂದಿನ ತಿಂಗಳಿನಿಂದ ವಿಜೇತರು ₹9,000 + ₹2,000 ಪ್ರೀಮಿಯಂ = ₹11,000 ಪಾವತಿಸುತ್ತಾರೆ', 'ಮೊದಲು ಪಡೆದವರ ಹೆಚ್ಚುವರಿ ಪ್ರೀಮಿಯಂ ಕೊನೆಯವರೆಗೆ ಉಳಿಯುವವರಿಗೆ ಲಾಭ ನೀಡುತ್ತದೆ'],
      ml: ['സമ്മാനം ലഭിക്കാത്തവർ കുറഞ്ഞ അടിസ്ഥാന ഗഡു (₹9,000) മാത്രം അടയ്ക്കുന്നു', 'ലേലം അല്ലെങ്കിൽ നറുക്കെടുപ്പിലൂടെ വിജയിയെ തിരഞ്ഞെടുക്കുന്നു', 'വിജയിച്ച അടുത്ത മാസം മുതൽ ₹9,000 + ₹2,000 പ്രീമിയം = ₹11,000 അടയ്ക്കണം', 'ആദ്യം എടുത്തവരുടെ അധിക പ്രീമിയം അവസാനം വരെ കാത്തിരിക്കുന്നവർക്ക് ഗുണമാകും'],
    },
    bestFor: {
      en: 'Popular in Theni, Madurai & Kongu belt where winners pay a fixed post-win interest premium.',
      ta: 'தேனி, மதுரை மற்றும் கொங்கு பகுதியில் பிரபலமான வட்டி/பிரீமியம் சீட்டு முறை.',
      hi: 'दक्षिण भारत में लोकप्रिय मॉडल जहाँ विजेता पॉट लेने के बाद निश्चित प्रीमियम जोड़कर किस्त देता है।',
      te: 'పాట తీసుకున్న తర్వాత విజేత స్థిర ప్రీమియం చెల్లించే ప్రసిద్ధ దక్షిణ భారత చిట్ మోడల్.',
      kn: 'ಚೀಟಿ ಪಡೆದ ನಂತರ ವಿಜೇತರು ನಿಗದಿತ ಪ್ರೀಮಿಯಂ ಪಾವತಿಸುವ ಜನಪ್ರಿಯ ಮಾದರಿ.',
      ml: 'ചിട്ടി ലഭിച്ച ശേഷം നിശ്ചിത പ്രീമിയം അധികമായി അടയ്ക്കുന്ന ജനപ്രിയ മാതൃക.',
    },
  },
  FIXED_CHART_ESCALATING: {
    formulaText: 'Fixed Due Every Month  |  Pre-Printed Escalating Payout Chart P_1 < P_2 < … < P_N',
    payoutPct: 92,
    dividendPct: 8,
    commissionPct: 0,
    stepIcons: ['table_chart', 'casino', 'trending_up', 'paid'],
    exampleRows: [
      { cycle: 'Month 1', pot: '₹1,00,000', discountOrRule: 'Chart Row #1', winnerGets: '₹84,000', memberNextDue: '₹10,000 (Fixed)' },
      { cycle: 'Month 5', pot: '₹1,00,000', discountOrRule: 'Chart Row #5', winnerGets: '₹96,000', memberNextDue: '₹10,000 (Fixed)' },
      { cycle: 'Month 10', pot: '₹1,00,000', discountOrRule: 'Chart Row #10 (Bonus)', winnerGets: '₹1,12,000', memberNextDue: '₹10,000 (Fixed)' },
    ],
    flowSteps: {
      en: ['Every member pays the exact same fixed monthly instalment (₹10,000)', 'No noisy bidding — winner is picked by lottery or mutual request', 'Payout follows a pre-printed escalating chart (early gets less, late gets bonus > ₹1L)', '100% predictable cash flow for both subscriber and foreman'],
      ta: ['அனைத்து உறுப்பினர்களும் பிரதி மாதம் நிலையான ₹10,000 செலுத்துவர்', 'ஏலம் கிடையாது — குலுக்கல் அல்லது வரிசைப்படி வெற்றியாளர் தேர்வு', 'அச்சிடப்பட்ட அட்டவணைப்படி பரிசு உயரும் (மாதம் 1: ₹84,000 → மாதம் 10: ₹1,12,000)', 'கடைசி மாதங்களில் எடுப்பவர்களுக்கு ₹1 லட்சத்திற்கு மேல் ஊக்கத்தொகை கிடைக்கும்'],
      hi: ['प्रत्येक सदस्य हर महीने समान निश्चित किस्त (₹10,000) देता है', 'कोई बोली नहीं — लॉटरी या सहमति से विजेता चुना जाता है', 'पूर्व-मुद्रित चार्ट के अनुसार इनाम बढ़ता है (माह 1: ₹84,000 → माह 10: ₹1,12,000)', 'देर से लेने वाले सदस्यों को ₹1 लाख से अधिक बोनस भुगतान मिलता है'],
      te: ['సభ్యులందరూ ప్రతి నెలా ఒకే స్థిర వాయిదా (₹10,000) చెల్లిస్తారు', 'వేలం ఉండదు — లాటరీ ద్వారా విజేతను ఎంపిక చేస్తారు', 'ముందుగా ముద్రించిన చార్ట్ ప్రకారం పేఅవుట్ పెరుగుతుంది (నెల 1: ₹84k → నెల 10: ₹1.12L)', 'చివరి నెలల్లో తీసుకునేవారికి బోనస్‌తో కలిపి ₹1 లక్ష కంటే ఎక్కువ లభిస్తుంది'],
      kn: ['ಎಲ್ಲಾ ಸದಸ್ಯರು ಪ್ರತಿ ತಿಂಗಳು ಒಂದೇ ನಿಗದಿತ ಕಂತು (₹10,000) ಪಾವತಿಸುತ್ತಾರೆ', 'ಹರಾಜು ಇರುವುದಿಲ್ಲ — ಲಾಟರಿ ಮೂಲಕ ವಿಜೇತರ ಆಯ್ಕೆ', 'ಮುದ್ರಿತ ಚಾರ್ಟ್ ಪ್ರಕಾರ ಬಹುಮಾನ ಏರಿಕೆಯಾಗುತ್ತದೆ (ತಿಂಗಳು 1: ₹84k → ತಿಂಗಳು 10: ₹1.12L)', 'ಕೊನೆಯ ತಿಂಗಳುಗಳಲ್ಲಿ ಪಡೆಯುವವರಿಗೆ ಬೋನಸ್ ಸಹಿತ ₹1 ಲಕ್ಷಕ್ಕಿಂತ ಹೆಚ್ಚು ಸಿಗುತ್ತದೆ'],
      ml: ['എല്ലാ അംഗങ്ങളും പ്രതിമാസം നിശ്ചിത ₹10,000 ഗഡു അടയ്ക്കുന്നു', 'ലേലമില്ല — നറുക്കെടുപ്പിലൂടെ വിജയിയെ നിശ്ചയിക്കുന്നു', 'മുൻകൂട്ടി നിശ്ചയിച്ച ചാർട്ട് പ്രകാരം തുക ഉയരുന്നു (മാസം 1: ₹84k → മാസം 10: ₹1.12L)', 'അവസാന മാസങ്ങളിൽ ലഭിക്കുന്നവർക്ക് ബോണസ് സഹിതം ₹1 ലക്ഷത്തിലധികം ലഭിക്കും'],
    },
    bestFor: {
      en: 'Zero-dispute "Chart Chit" where every month\'s exact prize amount is printed on the passbook.',
      ta: 'பாஸ்புக்கில் ஒவ்வொரு மாதப் பரிசுத் தொகையும் முன்கூட்டியே அச்சிடப்படும் அட்டவணைச் சீட்டு.',
      hi: 'पासबुक पर हर महीने की इनाम राशि पहले से छपी होने के कारण शून्य विवाद वाला चार्ट चिट।',
      te: 'పాస్‌బుక్‌లో ప్రతి నెల బహుమతి మొత్తం ముందే ముద్రించి ఉండే వివాదాలు లేని చార్ట్ చిట్.',
      kn: 'ಪಾಸ್‌ಬುಕ್‌ನಲ್ಲಿ ಪ್ರತಿ ತಿಂಗಳ ಮೊತ್ತ ಮೊದಲೇ ಮುದ್ರಿತವಾಗಿರುವ ವಿವಾದರಹಿತ ಚಾರ್ಟ್ ಚಿಟ್.',
      ml: 'പാസ്ബുക്കിൽ ഓരോ മാസത്തെയും തുക മുൻകൂട്ടി അച്ചടിച്ച തർക്കമില്ലാത്ത ചാർട്ട് ചിട്ടി.',
    },
  },
  FIXED_DIVIDEND: {
    formulaText: 'Fixed Dividend Schedule D_t  |  Net Due = Base Instalment − D_t',
    payoutPct: 85,
    dividendPct: 10,
    commissionPct: 5,
    stepIcons: ['event_note', 'redeem', 'percent', 'check_circle'],
    exampleRows: [
      { cycle: 'Month 1', pot: '₹1,00,000', discountOrRule: 'Fixed Div ₹1,500/ticket', winnerGets: '₹80,000', memberNextDue: '₹8,500' },
      { cycle: 'Month 5', pot: '₹1,00,000', discountOrRule: 'Fixed Div ₹800/ticket', winnerGets: '₹87,000', memberNextDue: '₹9,200' },
      { cycle: 'Month 10', pot: '₹1,00,000', discountOrRule: 'Fixed Div ₹0/ticket', winnerGets: '₹95,000', memberNextDue: '₹10,000' },
    ],
    flowSteps: {
      en: ['Foreman publishes fixed per-month dividend table on Day 1', 'Members know their exact net monthly payable in advance', 'Winner is chosen by draw/request at the pre-calculated prize', 'Removes auction volatility while keeping monthly dividend discounts'],
      ta: ['முதல் நாளே ஒவ்வொரு மாதத்திற்குமான நிலையான டிவிடெண்ட் பட்டியல் வெளியிடப்படும்', 'உறுப்பினர்கள் ஒவ்வொரு மாதமும் செலுத்த வேண்டிய நிகரத் தொகையை முன்கூட்டியே அறிவர்', 'குலுக்கல் மூலம் வெற்றியாளர் தேர்வு செய்யப்பட்டு பரிசு வழங்கப்படும்', 'ஏலப் போட்டியின்றி மாதாந்திர டிவிடெண்ட் தள்ளுபடி கிடைக்கும்'],
      hi: ['पहले दिन ही प्रत्येक माह की निश्चित लाभांश तालिका प्रकाशित की जाती है', 'सदस्यों को हर महीने देय शुद्ध किस्त पहले से पता रहती है', 'ड्रॉ या सहमति से विजेता चुनकर पूर्व-निर्धारित इनाम दिया जाता है', 'बिना नीलामी की अनिश्चितता के हर महीने निश्चित लाभांश छूट मिलती है'],
      te: ['మొదటి రోజే ప్రతి నెలా ఇచ్చే స్థిర డివిడెండ్ పట్టిక ప్రకటించబడుతుంది', 'సభ్యులు ప్రతి నెలా కట్టాల్సిన నికర వాయిదాను ముందే తెలుసుకుంటారు', 'లాటరీ ద్వారా విజేతను ఎంపిక చేసి నిర్ణీత బహుమతి అందిస్తారు', 'వేలం హెచ్చుతగ్గులు లేకుండా ప్రతి నెలా స్థిర డివిడెండ్ తగ్గింపు లభిస్తుంది'],
      kn: ['ಮೊದಲ ದಿನವೇ ಪ್ರತಿ ತಿಂಗಳ ನಿಗದಿತ ಲಾಭಾಂಶ ಪಟ್ಟಿಯನ್ನು ಪ್ರಕಟಿಸಲಾಗುತ್ತದೆ', 'ಸದಸ್ಯರಿಗೆ ಪ್ರತಿ ತಿಂಗಳು ಕಟ್ಟಬೇಕಾದ ನಿವ್ವಳ ಮೊತ್ತ ಮೊದಲೇ ತಿಳಿದಿರುತ್ತದೆ', 'ಡ್ರಾ ಮೂಲಕ ವಿಜೇತರನ್ನು ಆಯ್ಕೆ ಮಾಡಿ ಪೂರ್ವನಿರ್ಧರಿತ ಬಹುಮಾನ ನೀಡಲಾಗುತ್ತದೆ', 'ಹರಾಜು ಏರಿಳಿತವಿಲ್ಲದೆ ಪ್ರತಿ ತಿಂಗಳು ನಿಗದಿತ ಲಾಭಾಂಶ ರಿಯಾಯಿತಿ ಸಿಗುತ್ತದೆ'],
      ml: ['ആദ്യ ദിവസം തന്നെ ഓരോ മാസത്തെയും നിശ്ചിത ഡിവിഡന്റ് പട്ടിക പ്രസിദ്ധീകരിക്കുന്നു', 'അംഗങ്ങൾക്ക് ഓരോ മാസവും അടയ്ക്കേണ്ട തുക മുൻകൂട്ടി അറിയാം', 'നറുക്കെടുപ്പിലൂടെ വിജയിയെ കണ്ടെത്തി നിശ്ചിത തുക നൽകുന്നു', 'ലേലത്തിലെ ഏറ്റക്കുറച്ചിലുകൾ ഇല്ലാതെ സ്ഥിരമായ ഡിവിഡന്റ് കിഴിവ് ലഭിക്കുന്നു'],
    },
    bestFor: {
      en: 'Salaried subscribers who want a guaranteed monthly due schedule with built-in dividend discounts.',
      ta: 'மாதச் சம்பளதாரர்களுக்கு ஏற்ற முன்கூட்டியே தெரிந்த தவணை மற்றும் டிவிடெண்ட் முறை.',
      hi: 'वेतनभोगी सदस्यों के लिए उत्तम जो पहले से तय मासिक किस्त और लाभांश चाहते हैं।',
      te: 'ముందే తెలిసిన నెలవారీ వాయిదా కోరుకునే ఉద్యోగులు మరియు మధ్యతరగతి వారికి ఉత్తమం.',
      kn: 'ಮೊದಲೇ ತಿಳಿದಿರುವ ಮಾಸಿಕ ಕಂತು ಮತ್ತು ಲಾಭಾಂಶ ಬಯಸುವ ವೇತನದಾರರಿಗೆ ಸೂಕ್ತ.',
      ml: 'മുൻകൂട്ടി നിശ്ചയിച്ച പ്രതിമാസ ഗഡു ആഗ്രഹിക്കുന്ന ശമ്പളക്കാർക്ക് അനുയോജ്യം.',
    },
  },
  FIXED_PAYOUT_VARIABLE_PAY: {
    formulaText: 'Winner Always Gets 100% Pot (₹1,00,000)  |  Prized vs Non-Prized Instalments Vary by Table',
    payoutPct: 100,
    dividendPct: 0,
    commissionPct: 0,
    stepIcons: ['workspace_premium', 'tune', 'swap_horiz', 'account_balance_wallet'],
    exampleRows: [
      { cycle: 'Cycle 1', pot: '₹1,00,000', discountOrRule: 'Non-Prized: ₹8,500 | Prized: ₹11,500', winnerGets: '₹1,00,000', memberNextDue: 'Per Status Table' },
      { cycle: 'Cycle 5', pot: '₹1,00,000', discountOrRule: 'Non-Prized: ₹9,500 | Prized: ₹10,500', winnerGets: '₹1,00,000', memberNextDue: 'Per Status Table' },
    ],
    flowSteps: {
      en: ['Every cycle winner receives full 100% pot (₹1,00,000) without discount haircut', 'Non-prized members pay a lower scheduled due; prized members pay a higher scheduled due', 'Variable instalment table balances the total cash inflow each month', 'Eliminates prize deduction shock when a member needs the full ₹1,00,000'],
      ta: ['வெற்றியாளருக்கு எந்தத் தள்ளுபடியும் இன்றி முழு ₹1,00,000 பரிசுத் தொகை கிடைக்கும்', 'பரிசு பெறாதவர்களுக்கு குறைந்த தவணையும், பெற்றவர்களுக்கு கூடுதல் தவணையும் நிர்ணயிக்கப்படும்', 'மாறுபடும் தவணை அட்டவணை மூலம் மாதாந்திரத் தொகுப்பு சமன் செய்யப்படும்', 'முழுப் பரிசுத் தொகையும் கையில் கிடைக்க விரும்புவோருக்குச் சிறந்த முறை'],
      hi: ['प्रत्येक चक्र के विजेता को बिना किसी कटौती के पूरा 100% पॉट (₹1,00,000) मिलता है', 'गैर-विजेता कम किस्त और विजेता तालिका के अनुसार अधिक किस्त देते हैं', 'परिवर्तनीय किस्त तालिका हर महीने कुल संग्रह को संतुलित रखती है', 'पूरा ₹1,00,000 हाथ में पाने की चाह रखने वाले सदस्यों के लिए उत्तम'],
      te: ['ప్రతి నెల విజేతకు ఎలాంటి కోత లేకుండా పూర్తి 100% మొత్తం (₹1,00,000) అందుతుంది', 'పాట పాడనివారు తక్కువ వాయిదా, పాడినవారు ఎక్కువ వాయిదా పట్టిక ప్రకారం కడతారు', 'మారుతూ ఉండే వాయిదాల పట్టిక ప్రతి నెలా నిధిని బ్యాలెన్స్ చేస్తుంది', 'చేతికి పూర్తి ₹1,00,000 రావాలనుకునే సభ్యులకు అత్యుత్తమ విధానం'],
      kn: ['ಪ್ರತಿ ತಿಂಗಳ ವಿಜೇತರಿಗೆ ಯಾವುದೇ ಕಡಿತವಿಲ್ಲದೆ ಪೂರ್ಣ 100% ಮೊತ್ತ (₹1,00,000) ಸಿಗುತ್ತದೆ', 'ಬಹುಮಾನ ಪಡೆಯದವರು ಕಡಿಮೆ ಕಂತು ಮತ್ತು ಪಡೆದವರು ಹೆಚ್ಚಿನ ಕಂತು ಪಾವತಿಸುತ್ತಾರೆ', 'ಬದಲಾಗುವ ಕಂತುಗಳ ಪಟ್ಟಿಯು ಪ್ರತಿ ತಿಂಗಳ ಒಟ್ಟು ಮೊತ್ತವನ್ನು ಸಮತೋಲನಗೊಳಿಸುತ್ತದೆ', 'ಕೈಗೆ ಪೂರ್ಣ ₹1,00,000 ಬಯಸುವ ಸದಸ್ಯರಿಗೆ ಅತ್ಯುತ್ತಮ ಆಯ್ಕೆ'],
      ml: ['ഓരോ മാസവും വിജയിക്ക് കിഴിവുകളില്ലാതെ മുഴുവൻ തുകയും (₹1,00,000) ലഭിക്കുന്നു', 'സമ്മാനം ലഭിക്കാത്തവർ കുറഞ്ഞ ഗഡുവും ലഭിച്ചവർ ഉയർന്ന ഗഡുവും പട്ടിക പ്രകാരം അടയ്ക്കുന്നു', 'വ്യത്യസ്ത ഗഡു പട്ടിക പ്രതിമാസ കളക്ഷൻ കൃത്യമായി ബാലൻസ് ചെയ്യുന്നു', 'കയ്യിൽ മുഴുവൻ ₹1,00,000 തുകയും ലഭിക്കാൻ ആഗ്രഹിക്കുന്നവർക്ക് ഉത്തമം'],
    },
    bestFor: {
      en: 'Members who need the exact round ₹1,00,000 payout in hand without auction deductions.',
      ta: 'ஏலக் கழிவின்றி முழு ₹1,00,000 தொகையும் கையில் பெற விரும்பும் உறுப்பினர்களுக்கு.',
      hi: 'बिना किसी नीलामी कटौती के पूरे ₹1,00,000 हाथ में चाहने वाले सदस्यों के लिए।',
      te: 'వేలం కోతలు లేకుండా పూర్తి ₹1,00,000 చేతికి రావాలనుకునే సభ్యులకు.',
      kn: 'ಹರಾಜು ಕಡಿತವಿಲ್ಲದೆ ಪೂರ್ಣ ₹1,00,000 ಕೈಗೆ ಪಡೆಯಲು ಬಯಸುವವರಿಗೆ.',
      ml: 'ലേലക്കിഴിവില്ലാതെ മുഴുവൻ ₹1,00,000 തുകയും കയ്യിൽ കിട്ടേണ്ടവർക്ക്.',
    },
  },
  PURE_LOTTERY: {
    formulaText: 'Random Audited Token Draw (SHA-256)  |  Prize = V − Commission (5%)  |  Equal ₹10,000 Due',
    payoutPct: 95,
    dividendPct: 0,
    commissionPct: 5,
    stepIcons: ['confirmation_number', 'casino', 'percent', 'emoji_events'],
    exampleRows: [
      { cycle: 'Every Month (1..10)', pot: '₹1,00,000', discountOrRule: 'Lucky Token Draw (5% Fee)', winnerGets: '₹95,000', memberNextDue: '₹10,000' },
    ],
    flowSteps: {
      en: ['All 10 members pay fixed ₹10,000 monthly contribution', 'System runs cryptographic random draw among remaining non-prized tickets', 'Foreman deducts flat 5% commission (₹5,000)', 'Lucky winner takes ₹95,000 every single month — even in Month 1!'],
      ta: ['10 உறுப்பினர்களும் மாதம் ₹10,000 நிலையான சந்தா செலுத்துவர்', 'பரிசு பெறாத டிக்கெட்டுகளில் குலுக்கல் மூலம் ஒரு வெற்றியாளர் தேர்வு செய்யப்படுவார்', '5% நடத்துனர் கமிஷன் (₹5,000) மட்டும் கழிக்கப்படும்', 'முதல் மாதத்திலேயே வெற்றியாளருக்கு ₹95,000 முழுமையாகக் கிடைக்கும்!'],
      hi: ['सभी 10 सदस्य हर महीने ₹10,000 की निश्चित किस्त जमा करते हैं', 'शेष गैर-पुरस्कृत टिकटों में से पारदर्शी लॉटरी ड्रॉ निकाला जाता है', 'केवल 5% फोरमैन कमीशन (₹5,000) काटा जाता है', 'पहले ही महीने से भाग्यशाली विजेता को ₹95,000 मिलते हैं!'],
      te: ['10 మంది సభ్యులు ప్రతి నెలా ₹10,000 స్థిర వాయిదా చెల్లిస్తారు', 'బహుమతి రాని టికెట్ల మధ్య పారదర్శక లాటరీ డ్రా తీస్తారు', 'కేవలం 5% ఫోర్‌మన్ కమిషన్ (₹5,000) మాత్రమే తగ్గిస్తారు', 'మొదటి నెలలోనే లక్కీ విజేతకు ₹95,000 చేతికి అందుతుంది!'],
      kn: ['ಎಲ್ಲಾ 10 ಸದಸ್ಯರು ಪ್ರತಿ ತಿಂಗಳು ₹10,000 ನಿಗದಿತ ಕಂತು ಪಾವತಿಸುತ್ತಾರೆ', 'ಉಳಿದ ಟಿಕೆಟ್‌ಗಳ ನಡುವೆ ಪಾರದರ್ಶಕ ಲಾಟರಿ ಡ್ರಾ ನಡೆಸಲಾಗುತ್ತದೆ', 'ಕೇವಲ 5% ಫೋರ್‌ಮನ್ ಕಮಿಷನ್ (₹5,000) ಮಾತ್ರ ಕಡಿತಗೊಳಿಸಲಾಗುತ್ತದೆ', 'ಮೊದಲ ತಿಂಗಳಲ್ಲೇ ಅದೃಷ್ಟಶಾಲಿ ವಿಜೇತರಿಗೆ ₹95,000 ಸಿಗುತ್ತದೆ!'],
      ml: ['10 അംഗങ്ങളും പ്രതിമാസം ₹10,000 നിശ്ചിത വരിസംഖ്യ അടയ്ക്കുന്നു', 'സമ്മാനം ലഭിക്കാത്ത ടിക്കറ്റുകളിൽ നിന്ന് നറുക്കെടുപ്പിലൂടെ വിജയിയെ കണ്ടെത്തുന്നു', '5% ഫോർമാൻ കമ്മീഷൻ (₹5,000) മാത്രം കുറയ്ക്കുന്നു', 'ആദ്യ മാസത്തിൽ തന്നെ വിജയിക്ക് ₹95,000 ലഭിക്കുന്നു!'],
    },
    bestFor: {
      en: 'Neighbourhood "Kulakkal" / Lucky Draw chits where members want a 95% pot without deep auction cuts.',
      ta: 'ஏல நஷ்டமின்றி 95% பரிசுத் தொகை தரும் பாரம்பரிய குலுக்கல் சீட்டு.',
      hi: 'बिना बड़ी नीलामी कटौती के 95% इनाम राशि देने वाला लोकप्रिय लकी ड्रॉ चिट।',
      te: 'వేలం నష్టం లేకుండా 95% బహుమతి అందించే సాంప్రదాయ లక్కీ డ్రా చిట్.',
      kn: 'ಹರಾಜು ನಷ್ಟವಿಲ್ಲದೆ 95% ಬಹುಮಾನ ನೀಡುವ ಜನಪ್ರಿಯ ಲಕ್ಕಿ ಡ್ರಾ ಚೀಟಿ.',
      ml: 'ലേല നഷ്ടമില്ലാതെ 95% തുകയും ലഭിക്കുന്ന പരമ്പരാഗത നറുക്കെടുപ്പ് ചിട്ടി.',
    },
  },
  FIXED_ROTATION: {
    formulaText: '0% Commission  |  0% Discount  |  Ticket #t Receives 100% Pot in Period t',
    payoutPct: 100,
    dividendPct: 0,
    commissionPct: 0,
    stepIcons: ['format_list_numbered', 'autorenew', 'money_off', 'handshake'],
    exampleRows: [
      { cycle: 'Month 1 → Ticket #1', pot: '₹1,00,000', discountOrRule: 'Pre-Assigned Turn #1', winnerGets: '₹1,00,000', memberNextDue: '₹10,000' },
      { cycle: 'Month 2 → Ticket #2', pot: '₹1,00,000', discountOrRule: 'Pre-Assigned Turn #2', winnerGets: '₹1,00,000', memberNextDue: '₹10,000' },
    ],
    flowSteps: {
      en: ['Payout order (Ticket #1 to #10) is locked on Day 1 by mutual agreement', 'Each month every member contributes ₹10,000', '0% commission and 0% discount — full ₹1,00,000 goes to that month\'s scheduled ticket', 'Pure zero-interest peer-to-peer ROSCA / Kameti rotation'],
      ta: ['முதல் நாளே உறுப்பினர்களின் பரிசு பெறும் வரிசை (#1 முதல் #10) முடிவு செய்யப்படும்', 'ஒவ்வொரு மாதமும் அனைவரும் ₹10,000 செலுத்துவர்', '0% கமிஷன், 0% தள்ளுபடி — அந்த மாத வரிசை உறுப்பினருக்கு முழு ₹1,00,000 வழங்கப்படும்', 'வட்டி மற்றும் கமிஷன் இல்லாத நட்பு வட்ட முறைச் சீட்டு'],
      hi: ['पहले ही दिन सहमति से भुगतान क्रम (टिकट #1 से #10) तय हो जाता है', 'हर महीने सभी सदस्य ₹10,000 जमा करते हैं', '0% कमीशन और 0% छूट — उस महीने के निर्धारित सदस्य को पूरे ₹1,00,000 मिलते हैं', 'बिना ब्याज और बिना शुल्क की शुद्ध आपसी कमेटी (ROSCA)'],
      te: ['మొదటి రోజే సభ్యుల బహుమతి క్రమం (#1 నుండి #10) నిర్ణయించబడుతుంది', 'ప్రతి నెలా అందరూ ₹10,000 చొప్పున జమ చేస్తారు', '0% కమిషన్, 0% డిస్కౌంట్ — ఆ నెల వంతు వచ్చిన సభ్యునికి పూర్తి ₹1,00,000 అందుతుంది', 'వడ్డీ మరియు కమిషన్ లేని స్వచ్ఛమైన పరస్పర రొటేషన్ చిట్'],
      kn: ['ಮೊದಲ ದಿನವೇ ಸದಸ್ಯರ ಪಾವತಿ ಸರದಿ (#1 ರಿಂದ #10) ನಿಗದಿಯಾಗುತ್ತದೆ', 'ಪ್ರತಿ ತಿಂಗಳು ಎಲ್ಲರೂ ₹10,000 ಪಾವತಿಸುತ್ತಾರೆ', '0% ಕಮಿಷನ್, 0% ರಿಯಾಯಿತಿ — ಆ ತಿಂಗಳ ಸರದಿಯ ಸದಸ್ಯರಿಗೆ ಪೂರ್ಣ ₹1,00,000 ಸಿಗುತ್ತದೆ', 'ಬಡ್ಡಿ ಮತ್ತು ಶುಲ್ಕವಿಲ್ಲದ ಶುದ್ಧ ಪರಸ್ಪರ ಸರದಿ ಚೀಟಿ'],
      ml: ['ആദ്യ ദിവസം തന്നെ അംഗങ്ങളുടെ ഊഴം (#1 മുതൽ #10 വരെ) നിശ്ചയിക്കുന്നു', 'എല്ലാ മാസവും എല്ലാവരും ₹10,000 വീതം അടയ്ക്കുന്നു', '0% കമ്മീഷൻ, 0% കിഴിവ് — ആ മാസത്തെ ഊഴക്കാരന് മുഴുവൻ ₹1,00,000 ലഭിക്കുന്നു', 'പലിശയും കമ്മീഷനുമില്ലാത്ത സൗഹൃദ റൊട്ടേഷൻ ചിട്ടി'],
    },
    bestFor: {
      en: 'Office colleagues, family circles & peer Kametis planning fixed-month wedding/tuition expenses.',
      ta: 'அலுவலக நண்பர்கள் மற்றும் குடும்பத்தினர் நடத்தும் முறைச் சீட்டுக்கு ஏற்றது.',
      hi: 'ऑफिस सहकर्मियों और परिवार के बीच चलने वाली पारंपरिक जीरो-कमीशन कमेटी।',
      te: 'ఆఫీసు ఉద్యోగులు, కుటుంబ సభ్యుల మధ్య నడిచే జీరో-కమిషన్ రొటేషన్ చిట్.',
      kn: 'ಕಚೇರಿ ಸಹೋದ್ಯೋಗಿಗಳು ಮತ್ತು ಕುಟುಂಬದವರ ನಡುವಿನ ಶೂನ್ಯ-ಕಮಿಷನ್ ಸರದಿ ಚೀಟಿ.',
      ml: 'ഓഫീസ് സുഹൃത്തുക്കൾക്കും കുടുംബാംഗങ്ങൾക്കും ഇടയിലുള്ള സീറോ-കമ്മീഷൻ ചിട്ടി.',
    },
  },
  NEED_BASED_CONSENSUS: {
    formulaText: 'Mutual Consensus Selection + Recorded Reason  |  100% Pot to Urgent Need Member',
    payoutPct: 100,
    dividendPct: 0,
    commissionPct: 0,
    stepIcons: ['volunteer_activism', 'forum', 'fact_check', 'favorite'],
    exampleRows: [
      { cycle: 'Any Cycle t', pot: '₹1,00,000', discountOrRule: 'Medical / Education Priority', winnerGets: '₹1,00,000', memberNextDue: '₹10,000' },
    ],
    flowSteps: {
      en: ['Members contribute ₹10,000 each into the community trust pot', 'Group meets and reviews members with urgent medical, marriage, or school needs', 'Organizer records the consensus winner and documented reason in audit minutes', 'Full pot is released immediately as a community safety net'],
      ta: ['உறுப்பினர்கள் தலா ₹10,000 சமூக நலத் தொகுப்பில் செலுத்துவர்', 'மருத்துவம், கல்வி அல்லது திருமண அவசரத் தேவை உள்ளவரை குழு கூடித் தேர்வு செய்யும்', 'தேர்வுக்கான காரணம் தீர்மானப் பதிவேட்டில் பதிவு செய்யப்படும்', 'கமிஷன் இன்றி முழு ₹1,00,000 தொகையும் உடனடியாக வழங்கப்படும்'],
      hi: ['सभी सदस्य सामुदायिक ट्रस्ट पॉट में ₹10,000 जमा करते हैं', 'समूह मिलकर चिकित्सा, शिक्षा या विवाह की तत्काल आवश्यकता वाले सदस्य को चुनता है', 'सहमति का कारण आधिकारिक मिनट्स में दर्ज किया जाता है', 'बिना कटौती पूरी राशि तुरंत सहायता के रूप में दी जाती है'],
      te: ['సభ్యులందరూ తలా ₹10,000 కమ్యూనిటీ ట్రస్ట్ నిధిలో జమ చేస్తారు', 'వైద్యం, విద్య లేదా వివాహ అత్యవసర అవసరం ఉన్నవారిని ఏకగ్రీవంగా ఎన్నుకుంటారు', 'ఎంపిక కారణం ఆడిట్ మినిట్స్‌లో నమోదు చేయబడుతుంది', 'ఎలాంటి కోత లేకుండా పూర్తి ₹1,00,000 తక్షణమే అందజేస్తారు'],
      kn: ['ಸದಸ್ಯರೆಲ್ಲರೂ ತಲಾ ₹10,000 ಸಮುದಾಯ ನಿಧಿಗೆ ಪಾವತಿಸುತ್ತಾರೆ', 'ವೈದ್ಯಕೀಯ, ಶಿಕ್ಷಣ ಅಥವಾ ವಿವಾಹದ ತುರ್ತು ಅಗತ್ಯವಿರುವವರನ್ನು ಒಮ್ಮತದಿಂದ ಆಯ್ಕೆ ಮಾಡಲಾಗುತ್ತದೆ', 'ಆಯ್ಕೆಯ ಕಾರಣವನ್ನು ಅಧಿಕೃತ ನಡಾವಳಿಯಲ್ಲಿ ದಾಖಲಿಸಲಾಗುತ್ತದೆ', 'ಯಾವುದೇ ಕಡಿತವಿಲ್ಲದೆ ಪೂರ್ಣ ₹1,00,000 ತಕ್ಷಣವೇ ಬಿಡುಗಡೆಯಾಗುತ್ತದೆ'],
      ml: ['അംഗങ്ങൾ ₹10,000 വീതം കമ്മ്യൂണിറ്റി ട്രസ്റ്റ് ഫണ്ടിലേക്ക് അടയ്ക്കുന്നു', 'ചികിത്സ, വിദ്യാഭ്യാസം, വിവാഹം തുടങ്ങിയ അടിയന്തര ആവശ്യമുള്ളവരെ കൂട്ടായി തിരഞ്ഞെടുക്കുന്നു', 'തിരഞ്ഞെടുത്ത കാരണം ഔദ്യോഗിക മിനിറ്റ്സിൽ രേഖപ്പെടുത്തുന്നു', 'കിഴിവുകളില്ലാതെ മുഴുവൻ ₹1,00,000 തുകയും ഉടൻ നൽകുന്നു'],
    },
    bestFor: {
      en: 'Community welfare associations, church/temple sabhas, and extended family emergency funds.',
      ta: 'சமூக நலச் சங்கங்கள் மற்றும் கூட்டுக் குடும்ப அவசரகால நிதிக்கு ஏற்றது.',
      hi: 'सामुदायिक कल्याण समितियों और पारिवारिक आपातकालीन सहायता कोष के लिए सर्वोत्तम।',
      te: 'కమ్యూనిటీ సంక్షేమ సంఘాలు మరియు ఉమ్మడి కుటుంబ అత్యవసర నిధికి ఉత్తమం.',
      kn: 'ಸಮುದಾಯ ಕಲ್ಯಾಣ ಸಂಘಗಳು ಮತ್ತು ಕುಟುಂಬ ತುರ್ತು ನಿಧಿಗೆ ಅತ್ಯುತ್ತಮ.',
      ml: 'സമുദായ ക്ഷേമ സംഘങ്ങൾക്കും കുടുംബ അടിയന്തര സഹായ നിധികൾക്കും ഉത്തമം.',
    },
  },
  MICRO_DAILY_COLLECTION: {
    formulaText: 'Daily ₹1,000 × 25 Days = ₹25,000 Cycle  |  Doorstep Agent Collection + 3% Fee',
    payoutPct: 87,
    dividendPct: 10,
    commissionPct: 3,
    stepIcons: ['storefront', 'directions_walk', 'gavel', 'bolt'],
    exampleRows: [
      { cycle: 'Day 1..25 (Cycle 1)', pot: '₹25,000', discountOrRule: '₹1,000/day · ₹3,250 Bid', winnerGets: '₹21,750', memberNextDue: '₹900/day (₹100 Div)' },
    ],
    flowSteps: {
      en: ['25 market shopkeepers pay ₹1,000 daily via field collection agent', 'Every 25th day (or daily/weekly cadence), an auction/draw resolves the ₹25,000 pot', 'Low 3% foreman fee (₹750) deducted; net discount reduces next cycle daily dues', 'Turns small daily cash register surplus into lump-sum inventory capital'],
      ta: ['25 கடைக்காரர்கள் தினமும் ₹1,000 வீதம் முகவர் மூலம் செலுத்துவர்', '25 நாட்களுக்கு ஒருமுறை ₹25,000 தொகுப்பிற்கு ஏலம்/குலுக்கல் நடைபெறும்', '3% குறைந்த கமிஷன் போக மீதி தள்ளுபடி அடுத்த சுற்றின் தினசரி தவணையில் கழியும்', 'சிறு வியாபாரிகளின் தினசரி வருமானத்தை மொத்த மூலதனமாக மாற்றும் தண்டல் சீட்டு'],
      hi: ['25 दुकानदार फील्ड एजेंट के माध्यम से प्रतिदिन ₹1,000 जमा करते हैं', 'हर 25वें दिन ₹25,000 के पॉट की नीलामी या ड्रॉ होता है', 'केवल 3% शुल्क कटता है और शेष छूट अगली दैनिक किस्त में कम हो जाती है', 'छोटे व्यापारियों की दैनिक बिक्री को एकमुश्त पूँजी में बदलने वाला मॉडल'],
      te: ['25 మంది వ్యాపారులు ఫీల్డ్ ఏజెంట్ ద్వారా రోజుకు ₹1,000 చెల్లిస్తారు', 'ప్రతి 25 రోజులకు ₹25,000 నిధికి వేలం లేదా డ్రా జరుగుతుంది', '3% స్వల్ప కమిషన్ పోగా మిగిలిన డిస్కౌంట్ తదుపరి రోజువారీ వాయిదాలో తగ్గుతుంది', 'చిరు వ్యాపారుల రోజువారీ రాబడిని ఏకమొత్తం పెట్టుబడిగా మార్చే డైలీ చిట్'],
      kn: ['25 ಅಂಗಡಿ ವ್ಯಾಪಾರಿಗಳು ಏಜೆಂಟ್ ಮೂಲಕ ಪ್ರತಿದಿನ ₹1,000 ಪಾವತಿಸುತ್ತಾರೆ', 'ಪ್ರತಿ 25 ದಿನಗಳಿಗೊಮ್ಮೆ ₹25,000 ಮೊತ್ತಕ್ಕೆ ಹರಾಜು ಅಥವಾ ಡ್ರಾ ನಡೆಯುತ್ತದೆ', '3% ಕಡಿಮೆ ಶುಲ್ಕ ಕಳೆದು ಉಳಿದ ರಿಯಾಯಿತಿ ಮುಂದಿನ ದೈನಂದಿನ ಕಂತಿನಲ್ಲಿ ಕಡಿತವಾಗುತ್ತದೆ', 'ಸಣ್ಣ ವ್ಯಾಪಾರಿಗಳ ದೈನಂದಿನ ಉಳಿತಾಯವನ್ನು ದೊಡ್ಡ ಬಂಡವಾಳವಾಗಿಸುವ ಡೈಲಿ ಚೀಟಿ'],
      ml: ['25 വ്യാപാരികൾ കളക്ഷൻ ഏജന്റ് വഴി ദിവസവും ₹1,000 വീതം അടയ്ക്കുന്നു', 'ഓരോ 25-ാം ദിവസവും ₹25,000 തുകയ്ക്ക് ലേലം/നറുക്കെടുപ്പ് നടക്കുന്നു', '3% കുറഞ്ഞ കമ്മീഷൻ കഴിഞ്ഞ് ബാക്കി കിഴിവ് അടുത്ത ദിവസ ഗഡുക്കളിൽ കുറയും', 'ചെറുകിട വ്യാപാരികളുടെ പ്രതിദിന വരുമാനം വലിയ മൂലധനമാക്കുന്ന ഡെയ്‌ലി ചിട്ടി'],
    },
    bestFor: {
      en: 'Bazaar shopkeepers, vegetable/flower vendors, and daily cash businesses ("Thandal Chit").',
      ta: 'தினசரி வியாபாரிகள், மார்க்கெட் கடைக்காரர்களுக்கான 25 நாள் தண்டல் சீட்டு.',
      hi: 'बाज़ार के दुकानदारों और दैनिक नकद व्यापारियों के लिए 25-दिवसीय माइक्रो चिट।',
      te: 'మార్కెట్ దుకాణదారులు మరియు రోజువారీ నగదు వ్యాపారులకు 25-రోజుల డైలీ చిట్.',
      kn: 'ಮಾರುಕಟ್ಟೆ ಅಂಗಡಿದಾರರು ಮತ್ತು ದೈನಂದಿನ ವ್ಯಾಪಾರಿಗಳಿಗೆ 25 ದಿನಗಳ ಡೈಲಿ ಚೀಟಿ.',
      ml: 'മാർക്കറ്റ് വ്യാപാരികൾക്കും പ്രതിദിന കച്ചവടക്കാർക്കും അനുയോജ്യമായ ഡെയ്‌ലി ചിട്ടി.',
    },
  },
  GOLD_VALUE_ACCUMULATION: {
    formulaText: '11 Monthly Instalments Paid + 1 Month Jeweller Bonus  |  100% Making/Wastage Waiver',
    payoutPct: 100,
    dividendPct: 9,
    commissionPct: 0,
    stepIcons: ['savings', 'card_giftcard', 'diamond', 'verified'],
    exampleRows: [
      { cycle: 'Months 1..11', pot: '₹1,10,000 Paid', discountOrRule: '₹10,000/mo Saved', winnerGets: 'Accumulates Value', memberNextDue: '₹10,000' },
      { cycle: 'Month 12 Maturity', pot: '₹1,20,000 Value', discountOrRule: '+₹10,000 Bonus Month', winnerGets: '₹1,20,000 Jewellery', memberNextDue: '0% Wastage/VA' },
    ],
    flowSteps: {
      en: ['Subscriber pays ₹10,000/month for 11 months (Total paid = ₹1,10,000)', 'Merchant credits 12th month free bonus of ₹10,000 (Deferred Bonus Pool)', 'At maturity, customer redeems ₹1,20,000 worth of 22K gold jewellery', 'Includes configurable making-charge & wastage (VA) waiver'],
      ta: ['உறுப்பினர் 11 மாதங்களுக்கு மாதம் ₹10,000 செலுத்துவார் (மொத்தம் ₹1,10,000)', '12-வது மாதம் ₹10,000 போனஸ் தொகையை நிறுவனமே சேர்க்கும்', 'முதிர்வின் போது ₹1,20,000 மதிப்புள்ள தங்க நகைகளைப் பெற்றுக் கொள்ளலாம்', 'செய்கூலி மற்றும் சேதாரம் (VA) தள்ளுபடியும் உண்டு'],
      hi: ['सदस्य 11 महीनों तक ₹10,000/माह जमा करता है (कुल जमा = ₹1,10,000)', 'ज्वेलर 12वें महीने की ₹10,000 बोनस किस्त अपनी ओर से जोड़ता है', 'परिपक्वता पर ग्राहक ₹1,20,000 मूल्य के सोने के आभूषण खरीदता है', 'मेकिंग चार्ज और वेस्टेज (VA) में छूट का अतिरिक्त लाभ मिलता है'],
      te: ['సభ్యుడు 11 నెలల పాటు నెలకు ₹10,000 చెల్లిస్తారు (మొత్తం ₹1,10,000)', '12వ నెల ₹10,000 బోనస్ వాయిదాను జ్యువెలరీ సంస్థ జమ చేస్తుంది', 'మెచ్యూరిటీ తర్వాత ₹1,20,000 విలువైన బంగారు ఆభరణాలు పొందవచ్చు', 'తరుగు (Wastage) మరియు మజూరీ (Making) చార్జీలలో రాయితీ లభిస్తుంది'],
      kn: ['ಸದಸ್ಯರು 11 ತಿಂಗಳುಗಳ ಕಾಲ ತಿಂಗಳಿಗೆ ₹10,000 ಪಾವತಿಸುತ್ತಾರೆ (ಒಟ್ಟು ₹1,10,000)', '12ನೇ ತಿಂಗಳ ₹10,000 ಬೋನಸ್ ಕಂತನ್ನು ಜ್ಯುವೆಲ್ಲರಿ ಸಂಸ್ಥೆಯೇ ಸೇರಿಸುತ್ತದೆ', 'ಮುಕ್ತಾಯದ ವೇಳೆ ₹1,20,000 ಮೌಲ್ಯದ ಚಿನ್ನದ ಆಭರಣಗಳನ್ನು ಪಡೆಯಬಹುದು', 'ಮೇಕಿಂಗ್ ಚಾರ್ಜ್ ಮತ್ತು ವೇಸ್ಟೇಜ್ (VA) ಮನ್ನಾ ಸೌಲಭ್ಯವಿರುತ್ತದೆ'],
      ml: ['അംഗം 11 മാസം ₹10,000 വീതം അടയ്ക്കുന്നു (ആകെ ₹1,10,000)', '12-ാം മാസത്തെ ₹10,000 ബോണസ് ജ്വല്ലറി സ്ഥാപനം കൂട്ടിച്ചേർക്കുന്നു', 'കാലാവധി പൂർത്തിയാകുമ്പോൾ ₹1,20,000 മൂല്യമുള്ള സ്വർണ്ണാഭരണങ്ങൾ വാങ്ങാം', 'പണിക്കൂലിയിലും പണിനഷ്ടത്തിലും (VA) ഇളവും ലഭിക്കുന്നു'],
    },
    bestFor: {
      en: 'Jewellery showrooms & gold savings schemes ("11+1 Thanga Magal") driving bridal gold redemptions.',
      ta: 'நகைக்கடைகளின் 11+1 தங்க மகள் சேமிப்புத் திட்டங்களுக்கு மிகச் சிறந்தது.',
      hi: 'ज्वेलरी शोरूम की 11+1 स्वर्ण बचत योजनाओं के लिए आदर्श।',
      te: 'జ్యువెలరీ షోరూమ్‌ల 11+1 బంగారు పొదుపు పథకాలకు అత్యుత్తమం.',
      kn: 'ಆಭರಣ ಮಳಿಗೆಗಳ 11+1 ಚಿನ್ನದ ಉಳಿತಾಯ ಯೋಜನೆಗಳಿಗೆ ಸೂಕ್ತ.',
      ml: 'ജ്വല്ലറികളുടെ 11+1 സ്വർണ്ണ സമ്പാദ്യ പദ്ധതികൾക്ക് ഏറ്റവും അനുയോജ്യം.',
    },
  },
  GOLD_WEIGHT_ACCUMULATION: {
    formulaText: 'Grams Credited g_t = Payment S_t ÷ Daily Gold Rate R_t  |  Total Weight = Σ g_t (4 decimals)',
    payoutPct: 100,
    dividendPct: 0,
    commissionPct: 0,
    stepIcons: ['scale', 'currency_rupee', 'workspace_premium', 'lock'],
    exampleRows: [
      { cycle: 'Month 1 (@ ₹7,500/g)', pot: '₹10,000 Paid', discountOrRule: '10,000 ÷ 7,500', winnerGets: '+1.3333 Grams Locked', memberNextDue: '₹10,000' },
      { cycle: 'Month 6 (@ ₹8,000/g)', pot: '₹10,000 Paid', discountOrRule: '10,000 ÷ 8,000', winnerGets: '+1.2500 Grams Locked', memberNextDue: '₹10,000' },
      { cycle: 'Maturity (12 Mo)', pot: 'Total Grams Σg_t', discountOrRule: 'Protected vs Gold Inflation', winnerGets: '~15.5000 Grams Gold', memberNextDue: 'Redeem in 22K Gold' },
    ],
    flowSteps: {
      en: ['Each payment S_t immediately converts to 22K gold grams at that day\'s rate R_t', 'Credited weight g_t = S_t / R_t is locked to 4 decimal places on the receipt', 'Rising gold prices in later months never erode already-accumulated grams', 'At maturity, member redeems the exact total accumulated gold weight in jewellery/coin'],
      ta: ['ஒவ்வொரு மாதத் தவணையும் அன்றைய தங்க விலையில் உடனடியாக கிராமாக மாற்றப்படும்', 'வரவு வைக்கப்பட்ட தங்க எடை (g_t = S_t / R_t) 4 தசம புள்ளிகளில் ரசீதில் பதிவாகும்', 'தங்கம் விலை உயர்ந்தாலும் ஏற்கனவே சேர்ந்த கிராம் எடை குறையாது', 'முதிர்வில் மொத்தமாகச் சேர்ந்த தங்க எடைக்கு நிகரான நகை/நாணயம் வழங்கப்படும்'],
      hi: ['प्रत्येक किस्त भुगतान के दिन के सोने के भाव R_t पर तुरंत ग्राम में बदल जाती है', 'क्रेडिट किया गया सोने का वजन (g_t = S_t / R_t) 4 दशमलव स्थान तक लॉक होता है', 'भविष्य में सोने का भाव बढ़ने पर भी पहले से जमा ग्राम सुरक्षित रहते हैं', 'परिपक्वता पर सदस्य कुल संचित सोने के वजन के बराबर आभूषण प्राप्त करता है'],
      te: ['ప్రతి నెల వాయిదా ఆ రోజు బంగారం ధర R_t ప్రకారం వెంటనే గ్రాములుగా మారుతుంది', 'జమ అయిన బంగారం బరువు (g_t = S_t / R_t) 4 దశాంశ స్థానాలతో రసీదుపై లాక్ అవుతుంది', 'తర్వాత బంగారం ధర పెరిగినా అప్పటికే జమ అయిన గ్రాముల బరువు తగ్గదు', 'మెచ్యూరిటీ సమయంలో మొత్తం పోగైన గ్రాముల బరువుకు సమానమైన బంగారం ఇస్తారు'],
      kn: ['ಪ್ರತಿ ತಿಂಗಳ ಕಂತು ಆ ದಿನದ ಚಿನ್ನದ ದರದಲ್ಲಿ ತಕ್ಷಣವೇ ಗ್ರಾಂಗಳಿಗೆ ಪರಿವರ್ತನೆಯಾಗುತ್ತದೆ', 'ಜమೆಯಾದ ಚಿನ್ನದ ತೂಕ (g_t = S_t / R_t) 4 ದಶಮಾಂಶ ಸ್ಥಾನಗಳವರೆಗೆ ಲಾಕ್ ಆಗುತ್ತದೆ', 'ಮುಂದೆ ಚಿನ್ನದ ಬೆಲೆ ಏರಿದರೂ ಈಗಾಗಲೇ ಸಂಗ್ರಹವಾದ ಗ್ರಾಂ ತೂಕ ಕಡಿಮೆಯಾಗುವುದಿಲ್ಲ', 'ಮುಕ್ತಾಯದ ವೇಳೆ ಒಟ್ಟು ಸಂಗ್ರಹವಾದ ಗ್ರಾಂ ತೂಕದ ಚಿನ್ನವನ್ನು ನೀಡಲಾಗುತ್ತದೆ'],
      ml: ['ഓരോ മാസത്തെയും ഗഡു അന്നത്തെ സ്വർണ്ണ വിലയിൽ ഉടൻ ഗ്രാമായി മാറ്റപ്പെടുന്നു', 'ക്രെഡിറ്റ് ചെയ്ത സ്വർണ്ണ തൂക്കം (g_t = S_t / R_t) 4 ദശാംശ സ്ഥാനങ്ങളിൽ ലോക്ക് ചെയ്യുന്നു', 'പിന്നീട് സ്വർണ്ണവില കൂടിയാലും നേരത്തെ ചേർന്ന ഗ്രാം തൂക്കം കുറയില്ല', 'കാലാവധി പൂർത്തിയാകുമ്പോൾ ആകെ സ്വരൂപിച്ച ഗ്രാം തൂക്കത്തിന് തുല്യമായ സ്വർണ്ണം ലഭിക്കും'],
    },
    bestFor: {
      en: 'Gold price-lock schemes protecting families against bullion inflation.',
      ta: 'தங்கம் விலை உயர்விலிருந்து பாதுகாக்கும் கிராம் எடை சேமிப்புத் திட்டம்.',
      hi: 'सोने की बढ़ती कीमतों से सुरक्षा देने वाली ग्राम-लॉक डिजी-गोल्ड योजना।',
      te: 'బంగారం ధరల పెరుగుదల నుండి రక్షణ కల్పించే గ్రామ్-లాక్ గోల్డ్ చిట్.',
      kn: 'ಚಿನ್ನದ ಬೆಲೆ ಏರಿಕೆಯಿಂದ ರಕ್ಷಿಸುವ ಗ್ರಾಂ-ಲಾಕ್ ಚಿನ್ನದ ಉಳಿತಾಯ ಚೀಟಿ.',
      ml: 'സ്വർണ്ണവില കയറ്റത്തിൽ നിന്ന് സംരക്ഷണം നൽകുന്ന ഗ്രാം-ലോക്ക് പദ്ധതി.',
    },
  },
  FESTIVAL_COMMODITY: {
    formulaText: 'Monthly Savings × 10–12 Cycles + Merchant Wholesale Bonus = Festive Hamper / Appliance Delivery',
    payoutPct: 100,
    dividendPct: 10,
    commissionPct: 0,
    stepIcons: ['celebration', 'inventory_2', 'local_Offer', 'redeem'],
    exampleRows: [
      { cycle: 'Months 1..10', pot: '₹1,00,000 Pool', discountOrRule: '₹10,000/mo Saved', winnerGets: 'Hamper Reserved', memberNextDue: '₹10,000' },
      { cycle: 'Deepavali Delivery', pot: '+10% Bonus Value', discountOrRule: 'Sweets + Gold Coin + Crackers', winnerGets: '₹1,10,000 Goods Value', memberNextDue: 'Delivered in Kind' },
    ],
    flowSteps: {
      en: ['Members save fixed monthly instalments over 10–12 months before the festival', 'Organizer procures gold coins, appliances, brassware, sweets & crackers at wholesale', 'Merchant bonus value (10%+) is added to each member\'s kitty', 'Every member receives a guaranteed festive hamper / commodity package before Deepavali/Pongal'],
      ta: ['பண்டிகைக்கு முன் 10–12 மாதங்கள் உறுப்பினர்கள் நிலையான சந்தா செலுத்துவர்', 'நடத்துனர் மொத்த விலையில் தங்க நாணயம், பட்டாசு, இனிப்பு, பாத்திரங்களைக் கொள்முதல் செய்வார்', 'மொத்த கொள்முதல் லாபம் 10%+ போனஸ் மதிப்பாக உறுப்பினர்களுக்குச் சேரும்', 'தீபாவளி/பொங்கலுக்கு முன் அனைத்து உறுப்பினர்களுக்கும் பண்டிகைத் தொகுப்பு வழங்கப்படும்'],
      hi: ['त्योहार से पहले 10–12 महीनों तक सदस्य निश्चित मासिक किस्त बचाते हैं', 'आयोजक थोक मूल्य पर सोने का सिक्का, मिठाई, पटाखे और घरेलू सामान खरीदता है', 'थोक बचत का 10%+ बोनस मूल्य प्रत्येक सदस्य के खाते में जुड़ता है', 'दीपावली/पोंगल पर प्रत्येक सदस्य को गारंटीशुदा त्योहार हैम्पर मिलता है'],
      te: ['పండుగకు ముందు 10–12 నెలల పాటు సభ్యులు స్థిర వాయిదాలు పొదుపు చేస్తారు', 'నిర్వాహకులు హోల్‌సేల్ ధరలో బంగారు నాణెం, స్వీట్లు, టపాసులు, గృహోపకరణాలు కొనుగోలు చేస్తారు', '10%+ హోల్‌సేల్ బోనస్ విలువ ప్రతి సభ్యుని ఖాతాకు జోడించబడుతుంది', 'దీపావళి/సంక్రాంతికి ప్రతి సభ్యునికి పండుగ హ్యాంపర్ అందజేయబడుతుంది'],
      kn: ['ಹಬ್ಬಕ್ಕೂ ಮುನ್ನ 10–12 ತಿಂಗಳು ಸದಸ್ಯರು ನಿಗದಿತ ಮಾಸಿಕ ಕಂತು ಉಳಿತಾಯ ಮಾಡುತ್ತಾರೆ', 'ಆಯೋಜಕರು ಸಗಟು ದರದಲ್ಲಿ ಚಿನ್ನದ ನಾಣ್ಯ, ಸಿಹಿತಿಂಡಿ, ಪಟಾಕಿ, ಗೃಹೋಪಯೋಗಿ ವಸ್ತು ಖರೀದಿಸುತ್ತಾರೆ', '10%+ ಬೋನಸ್ ಮೌಲ್ಯವು ಪ್ರತಿ ಸದಸ್ಯರ ಖಾತೆಗೆ ಸೇರುತ್ತದೆ', 'ದೀಪಾವಳಿ/ಸಂಕ್ರಾಂತಿಗೆ ಪ್ರತಿ ಸದಸ್ಯರಿಗೂ ಹಬ್ಬದ ಉಡುಗೊರೆ ಪ್ಯಾಕೇಜ್ ವಿತರಿಸಲಾಗುತ್ತದೆ'],
      ml: ['ഉത്സവത്തിന് മുമ്പ് 10–12 മാസം അംഗങ്ങൾ നിശ്ചിത തുക സമ്പാദിക്കുന്നു', 'സ്വർണ്ണ നാണയം, മധുരപലഹാരങ്ങൾ, ഗൃഹോപകരണങ്ങൾ എന്നിവ മൊത്തവിലയ്ക്ക് സംഭരിക്കുന്നു', '10%+ ബോണസ് മൂല്യം ഓരോ അംഗത്തിനും അധികമായി ലഭിക്കുന്നു', 'ദീപാവലി/ഓണം/പൊങ്കൽ സമയത്ത് എല്ലാവർക്കും ഉത്സവ കിറ്റ് വിതരണം ചെയ്യുന്നു'],
    },
    bestFor: {
      en: 'Deepavali / Pongal / Onam festival funds, appliance clubs & retail hamper schemes.',
      ta: 'தீபாவளி / பொங்கல் பண்டிகைச் சீட்டு, பட்டாசு மற்றும் பாத்திரச் சீட்டுகளுக்கு ஏற்றது.',
      hi: 'दीपावली / त्योहार हैम्पर और घरेलू उपकरण बचत क्लबों के लिए उत्तम।',
      te: 'దీపావళి / సంక్రాంతి పండుగ హ్యాంపర్ మరియు గృహోపకరణాల చిట్‌లకు ఉత్తమం.',
      kn: 'ದೀಪಾವಳಿ / ಹಬ್ಬದ ಹ್ಯಾಂಪರ್ ಮತ್ತು ಗೃಹೋಪಯೋಗಿ ವಸ್ತುಗಳ ಚೀಟಿಗೆ ಸೂಕ್ತ.',
      ml: 'ഓണം / ദീപാവലി ഉത്സവ കിറ്റുകൾക്കും ഗൃഹോപകരണ ചിട്ടികൾക്കും അനുയോജ്യം.',
    },
  },
  HYBRID_SPLIT_PHASE: {
    formulaText: 'Cycles 1..k Reserved (Foreman / Fixed Discount)  |  Cycles k+1..N Open Competitive Auction',
    payoutPct: 86,
    dividendPct: 14,
    commissionPct: 0,
    stepIcons: ['star', 'call_split', 'gavel', 'published_with_changes'],
    exampleRows: [
      { cycle: 'Month 1 (Reserved Phase)', pot: '₹1,00,000', discountOrRule: 'Foreman Free Ticket (0% Comm)', winnerGets: '₹1,00,000 (Foreman)', memberNextDue: '₹10,000' },
      { cycle: 'Months 2..10 (Auction Phase)', pot: '₹1,00,000', discountOrRule: 'Open Bidding (0% Comm!)', winnerGets: '₹82,000–₹96,000', memberNextDue: '100% of Discount Shared!' },
    ],
    flowSteps: {
      en: ['Phase 1 (Cycle 1..k): Foreman takes Cycle-1 pot interest-free instead of charging monthly commission', 'Phase 2 (Cycle k+1..N): Remaining cycles switch automatically to open competitive auction', 'Because foreman already took Cycle 1, 0% commission is deducted in Phase 2!', '100% of every auction bid discount goes directly to members as dividend'],
      ta: ['கட்டம் 1 (மாதம் 1): நடத்துனர் கமிஷனுக்குப் பதிலாக முதல் மாதச் சீட்டை முழுமையாக எடுத்துக்கொள்வார்', 'கட்டம் 2 (மாதம் 2..10): அடுத்த மாதங்கள் திறந்தவெளி ஏல முறையாக மாறும்', 'மாதாந்திர கமிஷன் 0% என்பதால் ஏலத் தள்ளுபடி முழுவதும் உறுப்பினர்களுக்கே பிரித்துத் தரப்படும்', 'நடத்துனருக்கு முதல் மாத மூலதனம்; உறுப்பினர்களுக்கு கமிஷனில்லா முழு டிவிடெண்ட்'],
      hi: ['चरण 1 (माह 1): फोरमैन मासिक कमीशन के बदले पहले महीने का पॉट बिना छूट के लेता है', 'चरण 2 (माह 2..10): शेष महीने खुली प्रतिस्पर्धी नीलामी के रूप में चलते हैं', 'चरण 2 में 0% कमीशन कटता है — पूरी बोली छूट सदस्यों में बँटती है', 'फोरमैन को पहले माह की पूँजी और सदस्यों को बिना कमीशन पूरा लाभांश मिलता है'],
      te: ['దశ 1 (నెల 1): ఫోర్‌మన్ నెలవారీ కమిషన్ బదులు మొదటి నెల పాటను పూర్తిగా తీసుకుంటారు', 'దశ 2 (నెల 2..10): మిగిలిన నెలలు ఓపెన్ వేలంపాటగా నడుస్తాయి', 'దశ 2లో 0% కమిషన్ కాబట్టి వేలం డిస్కౌంట్ 100% సభ్యులకే డివిడెండ్‌గా వెళ్తుంది', 'ఫోర్‌మన్‌కు మొదటి నెల పెట్టుబడి, సభ్యులకు కమిషన్ లేని పూర్తి డివిడెండ్ లభిస్తుంది'],
      kn: ['ಹಂತ 1 (ತಿಂಗಳು 1): ಫೋರ್‌ಮನ್ ಮಾಸಿಕ ಕಮಿಷನ್ ಬದಲಿಗೆ ಮೊದಲ ತಿಂಗಳ ಪೂರ್ಣ ಮೊತ್ತ ಪಡೆಯುತ್ತಾರೆ', 'ಹಂತ 2 (ತಿಂಗಳು 2..10): ಉಳಿದ ತಿಂಗಳುಗಳು ಮುಕ್ತ ಹರಾಜು ಮಾದರಿಯಲ್ಲಿ ನಡೆಯುತ್ತವೆ', 'ಹಂತ 2ರಲ್ಲಿ 0% ಕಮಿಷನ್ ಇರುವುದರಿಂದ ಹರಾಜು ರಿಯಾಯಿತಿ 100% ಸದಸ್ಯರಿಗೇ ಹಂಚಿಕೆಯಾಗುತ್ತದೆ', 'ಫೋರ್‌ಮನ್‌ಗೆ ಮೊದಲ ತಿಂಗಳ ಬಂಡವಾಳ ಮತ್ತು ಸದಸ್ಯರಿಗೆ ಕಮಿಷನ್-ರಹಿತ ಪೂರ್ಣ ಲಾಭಾಂಶ'],
      ml: ['ഘട്ടം 1 (മാസം 1): പ്രതിമാസ കമ്മീഷന് പകരം ഫോർമാൻ ഒന്നാം മാസത്തെ തുക മുഴുവൻ എടുക്കുന്നു', 'ഘട്ടം 2 (മാസം 2..10): തുടർന്നുള്ള മാസങ്ങളിൽ സാധാരണ ലേലം നടക്കുന്നു', 'രണ്ടാം ഘട്ടത്തിൽ 0% കമ്മീഷൻ ആയതിനാൽ ലേലക്കിഴിവ് 100% അംഗങ്ങൾക്കായി വീതിക്കുന്നു', 'നടത്തിപ്പുകാരന് ആദ്യ മാസം മൂലധനവും അംഗങ്ങൾക്ക് കമ്മീഷനില്ലാത്ത മുഴുവൻ ഡിവിഡന്റും'],
    },
    bestFor: {
      en: 'Traditional South Indian "First-Chit-to-Foreman" model with zero commission on later auctions.',
      ta: 'முதல் சீட்டு நடத்துனருக்கு மற்றும் அடுத்த மாதங்களில் கமிஷன் இல்லாத பாரம்பரிய முறை.',
      hi: 'पहली चिट फोरमैन को और बाकी महीनों में शून्य कमीशन वाली लोकप्रिय हाइब्रिड चिट।',
      te: 'మొదటి చిట్ ఫోర్‌మన్‌కు ఉండి మిగతా నెలల్లో జీరో కమిషన్ ఉండే సాంప్రదాయ హైబ్రిడ్ చిట్.',
      kn: 'ಮೊದಲ ಚೀಟಿ ಫೋರ್‌ಮನ್‌ಗೆ ಮತ್ತು ಉಳಿದ ತಿಂಗಳುಗಳಲ್ಲಿ ಶೂನ್ಯ ಕಮಿಷನ್ ಇರುವ ಹೈಬ್ರಿಡ್ ಚೀಟಿ.',
      ml: 'ആദ്യ ചിട്ടി തലയാൾക്കും തുടർന്നുള്ള മാസങ്ങളിൽ കമ്മീഷനുമില്ലാത്ത പരമ്പരാഗത രീതി.',
    },
  },
  ASCA_SHG_REVOLVING: {
    formulaText: 'Revolving Pool = Contributions + Internal Loan Interest (1.5%/mo) − Expenses  |  Term-End Profit Share',
    payoutPct: 85,
    dividendPct: 15,
    commissionPct: 0,
    stepIcons: ['diversity_3', 'sync_alt', 'trending_up', 'pie_chart'],
    exampleRows: [
      { cycle: 'Months 1..10', pot: 'Revolving Pool', discountOrRule: 'Internal Member Loans @ 1.5%/mo', winnerGets: 'Multiple Micro-Loans', memberNextDue: '₹10,000 + Interest' },
      { cycle: 'Maturity Settlement', pot: 'Principal + Profit', discountOrRule: 'Pro-Rata Ticket Share', winnerGets: 'Full Capital + Interest Share', memberNextDue: 'Pool Closed' },
    ],
    flowSteps: {
      en: ['Members contribute monthly savings into a common Self-Help Group (SHG / ASCA) revolving pool', 'Instead of one winner taking the whole pot, multiple members borrow internal short-term loans at 1.5%/mo', 'Borrowers repay principal + interest back into the group pool ledger', 'At maturity, every member gets back their full savings principal plus pro-rata interest profit!'],
      ta: ['மகளிர் சுயஉதவிக் குழு (SHG) உறுப்பினர்கள் மாதந்தோறும் பொது நிதியில் சேமிப்பர்', 'ஒருவரே முழுத் தொகையையும் எடுக்காமல் பல உறுப்பினர்கள் 1.5% மாத வட்டியில் உள்கடன் பெறுவர்', 'அசலும் வட்டியும் மீண்டும் குழுவின் சுழல் நிதிக்கே திரும்பச் செலுத்தப்படும்', 'முதிர்வில் ஒவ்வொருவருக்கும் தாங்கள் கட்டிய முழு அசல் + வட்டி லாபப் பங்கு கிடைக்கும்!'],
      hi: ['स्वयं सहायता समूह (SHG) के सदस्य हर महीने साझा रिवॉल्विंग पूल में बचत जमा करते हैं', 'एक विजेता के बजाय कई सदस्य 1.5% मासिक ब्याज पर समूह से आंतरिक ऋण लेते हैं', 'मूलधन और ब्याज वापस समूह के पूल में जमा होता रहता है', 'अवधि पूर्ण होने पर सभी को अपनी पूरी बचत और ब्याज मुनाफे का आनुपातिक हिस्सा मिलता है!'],
      te: ['స్వయం సహాయక సంఘం (SHG) సభ్యులు ప్రతి నెలా ఉమ్మడి రివాల్వింగ్ నిధిలో పొదుపు చేస్తారు', 'ఒక్కరే కాకుండా పలువురు సభ్యులు 1.5% నెలవారీ వడ్డీకి అంతర్గత రుణాలు తీసుకుంటారు', 'అసలు మరియు వడ్డీ తిరిగి సంఘం నిధిలోకే జమ అవుతాయి', 'గడువు ముగింపులో ప్రతి సభ్యునికి తమ పూర్తి పొదుపు అసలు + వడ్డీ లాభం వాటా లభిస్తుంది!'],
      kn: ['ಸ್ವಸಹಾಯ ಸಂಘದ (SHG) ಸದಸ್ಯರು ಪ್ರತಿ ತಿಂಗಳು ಆವರ್ತಕ ನಿಧಿಯಲ್ಲಿ ಉಳಿತಾಯ ಮಾಡುತ್ತಾರೆ', 'ಒಬ್ಬರೇ ಪೂರ್ಣ ಮೊತ್ತ ಪಡೆಯುವ ಬದಲು ಹಲವು ಸದಸ್ಯರು 1.5% ಬಡ್ಡಿಗೆ ಆಂತರಿಕ ಸಾಲ ಪಡೆಯುತ್ತಾರೆ', 'ಅಸಲು ಮತ್ತು ಬಡ್ಡಿ ಮತ್ತೆ ಸಂಘದ ನಿಧಿಗೇ ಮರುಪಾವತಿಯಾಗುತ್ತದೆ', 'ಮುಕ್ತಾಯದ ವೇಳೆ ಪ್ರತಿಯೊಬ್ಬರಿಗೂ ತಮ್ಮ ಪೂರ್ಣ ಉಳಿತಾಯ + ಬಡ್ಡಿ ಲಾಭದ ಪಾಲು ಸಿಗುತ್ತದೆ!'],
      ml: ['കുടുംബശ്രീ / സ്വയംസഹായ സംഘം (SHG) അംഗങ്ങൾ പ്രതിമാസം പൊതു ഫണ്ടിൽ നിക്ഷേപിക്കുന്നു', 'ഒരാൾ മുഴുവൻ തുക എടുക്കുന്നതിന് പകരം പല അംഗങ്ങൾക്ക് 1.5% പലിശയിൽ ആന്തരിക വായ്പ നൽകുന്നു', 'മുതലും പലിശയും തിരികെ ഗ്രൂപ്പ് ഫണ്ടിലേക്ക് തന്നെ എത്തുന്നു', 'കാലാവധി അവസാനിക്കുമ്പോൾ എല്ലാവർക്കും മുഴുവൻ നിക്ഷേപവും പലിശ ലാഭവിഹിതവും ലഭിക്കുന്നു!'],
    },
    bestFor: {
      en: 'Women Self-Help Groups (Mahalir Thittam / Kudumbashree / DWACRA) & village micro-credit clubs.',
      ta: 'மகளிர் சுயஉதவிக் குழுக்கள் (மகளிர் திட்டம்) மற்றும் கிராமப்புற சுழல் நிதிக்கு ஏற்றது.',
      hi: 'महिला स्वयं सहायता समूहों (SHG) और ग्रामीण बचत-सह-ऋण मंडलों के लिए आदर्श।',
      te: 'మహిళా స్వయం సహాయక సంఘాలు (డ్వాక్రా / SHG) మరియు గ్రామ రివాల్వింగ్ ఫండ్లకు ఉత్తమం.',
      kn: 'ಮಹಿಳಾ ಸ್ವಸಹಾಯ ಸಂಘಗಳು (SHG / ಸ್ತ್ರೀಶಕ್ತಿ) ಮತ್ತು ಗ್ರಾಮೀಣ ಆವರ್ತಕ ನಿಧಿಗೆ ಸೂಕ್ತ.',
      ml: 'കുടുംബശ്രീ / സ്വയംസഹായ സംഘങ്ങൾക്കും (SHG) ഗ്രാമീണ വായ്പാ കൂട്ടായ്മകൾക്കും ഉത്തമം.',
    },
  },
  CUSTOM_MANUAL_SCHEDULE: {
    formulaText: 'Custom Table per Cycle t: [Non-Prized Due_t, Prized Due_t, Payout_t, Commission_t, Dividend_t]',
    payoutPct: 88,
    dividendPct: 7,
    commissionPct: 5,
    stepIcons: ['edit_calendar', 'upload_file', 'calculate', 'task_alt'],
    exampleRows: [
      { cycle: 'Cycle t (CSV / Table)', pot: 'Custom Inflow', discountOrRule: 'Exact Foreman Table Row t', winnerGets: 'Custom Payout_t', memberNextDue: 'Prized_t vs NonPrized_t' },
    ],
    flowSteps: {
      en: ['Foreman enters or pastes a CSV schedule defining exact amounts for every cycle 1..N', 'Supports custom non-prized due, prized due, payout amount, commission, and dividend per row', 'Server validates row completeness and applies exact table numbers on each auction confirmation', 'Handles any regional or legacy bespoke chit chart without code changes'],
      ta: ['நடத்துனர் ஒவ்வொரு மாதத்திற்கும் (1..N) தனிப்பயன் அட்டவணை அல்லது CSV-ஐ உள்ளீடு செய்யலாம்', 'பரிசு பெறாதவர் தவணை, பெற்றவர் தவணை, பரிசுத் தொகை, கமிஷன், டிவிடெண்ட் அனைத்தும் தனித்தனியே குறிப்பிடலாம்', 'ஒவ்வொரு சுற்றின் போதும் அட்டவணையில் உள்ள துல்லியமான கணக்கையே கணினி செயல்படுத்தும்', 'எந்தவொரு வட்டார சிறப்புச் சீட்டு அட்டவணையையும் எளிதாக இயக்கலாம்'],
      hi: ['फोरमैन प्रत्येक चक्र (1..N) के लिए कस्टम तालिका या CSV शेड्यूल दर्ज कर सकता है', 'गैर-विजेता किस्त, विजेता किस्त, इनाम राशि, कमीशन और लाभांश हर महीने अलग तय किए जा सकते हैं', 'प्रत्येक चक्र के समापन पर सिस्टम आपकी तालिका के सटीक आँकड़े लागू करता है', 'किसी भी क्षेत्रीय या विशेष चिट चार्ट को बिना किसी कोडिंग के चलाया जा सकता है'],
      te: ['ఫోర్‌మన్ ప్రతి నెలకు (1..N) కస్టమ్ టేబుల్ లేదా CSV షెడ్యూల్ నమోదు చేయవచ్చు', 'పాడనివారి వాయిదా, పాడినవారి వాయిదా, బహుమతి, కమిషన్, డివిడెండ్ ప్రతి నెలా విడిగా సెట్ చేయవచ్చు', 'ప్రతి నెల ముగింపులో సిస్టమ్ మీ టేబుల్‌లోని ఖచ్చితమైన అంకెలనే అమలు చేస్తుంది', 'ఏ ప్రాంతీయ ప్రత్యేక చిట్ చార్ట్‌నైనా సులభంగా నిర్వహించవచ్చు'],
      kn: ['ಫೋರ್‌ಮನ್ ಪ್ರತಿ ತಿಂಗಳಿಗೆ (1..N) ಕಸ್ಟಮ್ ಪಟ್ಟಿ ಅಥವಾ CSV ಶೆಡ್ಯೂಲ್ ನಮೂದಿಸಬಹುದು', 'ಬಹುಮಾನ ಪಡೆಯದವರ ಕಂತು, ಪಡೆದವರ ಕಂತು, ಬಹುಮಾನ, ಕಮಿಷನ್, ಲಾಭಾಂಶವನ್ನು ಪ್ರತ್ಯೇಕವಾಗಿ ಹೊಂದಿಸಬಹುದು', 'ಪ್ರತಿ ತಿಂಗಳ ದೃಢೀಕರಣದಂದು ಸಿಸ್ಟಮ್ ನಿಮ್ಮ ಪಟ್ಟಿಯ ನಿಖರ ಸಂಖ್ಯೆಗಳನ್ನೇ ಅನ್ವಯಿಸುತ್ತದೆ', 'ಯಾವುದೇ ಪ್ರಾದೇಶಿಕ ವಿಶೇಷ ಚಿಟ್ ಚಾರ್ಟ್ ಅನ್ನು ಸುಲಭವಾಗಿ ನಡೆಸಬಹುದು'],
      ml: ['ഫോർമാന് ഓരോ മാസത്തേക്കും (1..N) കസ്റ്റം പട്ടികയോ CSV ഷെഡ്യൂളോ നൽകാം', 'സമ്മാനം ലഭിക്കാത്തവരുടെ ഗഡു, ലഭിച്ചവരുടെ ഗഡു, സമ്മാനത്തുക, കമ്മീഷൻ, ഡിവിഡന്റ് എന്നിവ പ്രത്യേകം നൽകാം', 'ഓരോ തവണയും പട്ടികയിലെ കൃത്യമായ കണക്കുകൾ തന്നെ സിസ്റ്റം നടപ്പിലാക്കുന്നു', 'ഏതൊരു പ്രാദേശിക പ്രത്യേക ചിട്ടി ചാർട്ടും ഇതിലൂടെ പ്രവർത്തിപ്പിക്കാം'],
    },
    bestFor: {
      en: 'Veteran foremen migrating legacy printed passbook charts with custom row-by-row rules.',
      ta: 'தனிப்பயன் அட்டவணை கொண்ட பாரம்பரிய சீட்டு நடத்துனர்களுக்கு மிகவும் ஏற்றது.',
      hi: 'कस्टम पासबुक चार्ट चलाने वाले अनुभवी फोरमैनों के लिए पूर्णतः लचीला मॉडल।',
      te: 'సొంత ప్రత్యేక చార్ట్‌లు నడిపే అనుభవజ్ఞులైన ఫోర్‌మన్‌లకు పూర్తి సౌకర్యవంతమైన మోడల్.',
      kn: 'ಸ್ವಂತ ವಿಶೇಷ ಚಾರ್ಟ್‌ಗಳನ್ನು ನಡೆಸುವ ಅನುಭವಿ ಫೋರ್‌ಮನ್‌ಗಳಿಗೆ ಸಂಪೂರ್ಣ ಹೊಂದಿಕೊಳ್ಳುವ ಮಾದರಿ.',
      ml: 'സ്വന്തം പ്രത്യേക ചാർട്ടുകൾ ഉപയോഗിക്കുന്ന പരിചയസമ്പന്നരായ ഫോർമാൻമാർക്ക് ഉത്തമം.',
    },
  },
};

export default function ChitTemplateExplainerModal({
  template,
  currencySymbol,
  initialLocale = 'en',
  isApplied,
  onApply,
  onClose,
}: {
  template: ChitTemplateDefinition | null;
  currencySymbol: string;
  initialLocale?: LocaleKey;
  isApplied: boolean;
  onApply: (tmpl: ChitTemplateDefinition) => void;
  onClose: () => void;
}) {
  const [activeLocale, setActiveLocale] = useState<LocaleKey>(initialLocale);
  const [showAllLocales, setShowAllLocales] = useState<boolean>(true);

  useEffect(() => {
    setActiveLocale(initialLocale);
  }, [initialLocale, template?.code]);

  if (!template) return null;

  const catalog = CHIT_ENGINE_CATALOG[template.engineType];
  const blueprint = ENGINE_VISUAL_BLUEPRINTS[template.engineType] ?? ENGINE_VISUAL_BLUEPRINTS.AUCTION_STANDARD;
  const activeDict = ALL_DICTS[activeLocale]?.chits ?? en.chits;
  const activeTemplatesMap = (activeDict?.templates ?? {}) as Record<string, { title: string; badge: string; desc: string }>;
  const enTemplatesMap = (en.chits.templates ?? {}) as Record<string, { title: string; badge: string; desc: string }>;
  const activeTmplText = activeTemplatesMap[template.code] ?? activeTemplatesMap[template.engineType] ?? enTemplatesMap[template.code] ?? enTemplatesMap[template.engineType];
  const activeEngineName = activeDict?.engineNames?.[template.engineType] ?? catalog.name;
  const activeEngineDesc = activeDict?.engineDescs?.[template.engineType] ?? catalog.description;
  const activeSteps = blueprint.flowSteps[activeLocale] ?? blueprint.flowSteps.en;
  const activeBestFor = blueprint.bestFor[activeLocale] ?? blueprint.bestFor.en;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1040px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.35)',
          border: '1px solid #cbd5e1',
          overflow: 'hidden',
        }}
      >
        {/* Top Modal Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 58%, #047857 100%)',
            color: '#ffffff',
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span
                style={{
                  fontSize: '.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.16)',
                  color: '#93c5fd',
                }}
              >
                {catalog.category} · {template.engineType}
              </span>
              <span
                style={{
                  fontSize: '.75rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background: '#16a34a',
                  color: '#ffffff',
                }}
              >
                🏷️ {activeTmplText?.badge || template.defaultBadge}
              </span>
              {catalog.regionalNames && (
                <span style={{ fontSize: '.76rem', color: '#cbd5e1' }}>
                  ({catalog.regionalNames})
                </span>
              )}
            </div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 800, color: '#ffffff' }}>
              {activeTmplText?.title || template.defaultName}
            </h3>
            <p style={{ margin: 0, fontSize: '.86rem', color: '#e2e8f0' }}>
              {activeEngineName} — {activeTmplText?.desc || activeEngineDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.22)',
              color: '#ffffff',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Language Switcher Bar */}
        <div
          style={{
            padding: '12px 24px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#475569', marginRight: '4px' }}>
              🌐 Explain in Language:
            </span>
            {LOCALE_META.map((loc) => {
              const active = activeLocale === loc.code;
              return (
                <button
                  key={loc.code}
                  type="button"
                  onClick={() => setActiveLocale(loc.code)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '999px',
                    fontSize: '.78rem',
                    fontWeight: active ? 800 : 600,
                    border: active ? `2px solid ${loc.accent}` : '1px solid #cbd5e1',
                    background: active ? loc.bg : '#ffffff',
                    color: active ? loc.accent : '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {loc.nativeName} ({loc.englishName})
                </button>
              );
            })}
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '.78rem',
              fontWeight: 700,
              color: '#1e3a8a',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showAllLocales}
              onChange={(e) => setShowAllLocales(e.target.checked)}
            />
            Show All 6 Languages Comparison Cards
          </label>
        </div>

        {/* Scrollable Modal Body */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Quick Preset Metrics Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
            }}
          >
            {[
              { label: 'Default Chit Value', value: `${currencySymbol}${template.defaultChitValue.toLocaleString('en-IN')}`, icon: 'payments', color: '#1d4ed8' },
              { label: 'Instalment / Cycle', value: `${currencySymbol}${template.defaultMonthlyContrib.toLocaleString('en-IN')}`, icon: 'event_repeat', color: '#047857' },
              { label: 'Total Members / Cycles', value: `${template.defaultTotalMembers} Tickets`, icon: 'groups', color: '#7c3aed' },
              { label: 'Foreman Commission', value: `${template.defaultCommissionPct}%`, icon: 'percent', color: '#b45309' },
              { label: 'Cadence & Mode', value: `${template.defaultFrequency} · ${template.defaultAuctionType}`, icon: 'schedule', color: '#0f766e' },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderLeft: `4px solid ${stat.color}`,
                  borderRadius: '10px',
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: '1.02rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* 1. Graphical 4-Step Process Flowchart */}
          <div
            style={{
              background: 'linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%)',
              border: '1px solid #bfdbfe',
              borderRadius: '14px',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons-outlined" style={{ fontSize: '20px', color: '#2563eb' }}>account_tree</span>
                Step-by-Step Visual Flowchart ({LOCALE_META.find((l) => l.code === activeLocale)?.nativeName})
              </h4>
              <code
                style={{
                  fontSize: '.78rem',
                  fontWeight: 700,
                  background: '#1e3a8a',
                  color: '#ffffff',
                  padding: '4px 10px',
                  borderRadius: '6px',
                }}
              >
                {blueprint.formulaText}
              </code>
            </div>

            {/* 4-Step Graphical Nodes with Arrows */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '14px',
                alignItems: 'stretch',
              }}
            >
              {activeSteps.map((stepText, idx) => {
                const nodeColors = [
                  { border: '#3b82f6', bg: '#ffffff', badgeBg: '#2563eb', title: '1. Collection Pool' },
                  { border: '#8b5cf6', bg: '#ffffff', badgeBg: '#7c3aed', title: '2. Winner Selection' },
                  { border: '#f59e0b', bg: '#ffffff', badgeBg: '#d97706', title: '3. Commission & Rule' },
                  { border: '#10b981', bg: '#ffffff', badgeBg: '#059669', title: '4. Payout & Dividend' },
                ][idx];

                return (
                  <div
                    key={idx}
                    style={{
                      position: 'relative',
                      background: nodeColors.bg,
                      border: `2px solid ${nodeColors.border}`,
                      borderRadius: '12px',
                      padding: '14px',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          fontSize: '.72rem',
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: '999px',
                          background: nodeColors.badgeBg,
                          color: '#ffffff',
                        }}
                      >
                        {nodeColors.title}
                      </span>
                      <span className="material-icons-outlined" style={{ fontSize: '20px', color: nodeColors.badgeBg }}>
                        {blueprint.stepIcons[idx] || 'check_circle'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '.85rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.45 }}>
                      {stepText}
                    </p>
                    {idx < 3 && (
                      <div
                        style={{
                          fontSize: '.72rem',
                          fontWeight: 700,
                          color: nodeColors.badgeBg,
                          marginTop: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>Next Stage</span>
                        <span>→</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Graphical Pool Split Bar */}
            <div style={{ marginTop: '18px', background: '#ffffff', borderRadius: '10px', padding: '14px', border: '1px solid #dbeafe' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', fontWeight: 700, marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ color: '#0f172a' }}>📊 Visual Pot &amp; Benefit Allocation (Illustrative Cycle)</span>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#15803d' }}>● Winner Payout: ~{blueprint.payoutPct}%</span>
                  <span style={{ color: '#2563eb' }}>● Member Dividend / Bonus: ~{blueprint.dividendPct}%</span>
                  <span style={{ color: '#b45309' }}>● Foreman Commission: {blueprint.commissionPct}%</span>
                </div>
              </div>
              <div
                style={{
                  height: '18px',
                  borderRadius: '999px',
                  overflow: 'hidden',
                  display: 'flex',
                  background: '#e2e8f0',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, blueprint.payoutPct)}%`,
                    background: 'linear-gradient(90deg, #16a34a, #22c55e)',
                  }}
                  title={`Winner Payout ~${blueprint.payoutPct}%`}
                />
                {blueprint.dividendPct > 0 && (
                  <div
                    style={{
                      width: `${blueprint.dividendPct}%`,
                      background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
                    }}
                    title={`Member Dividend / Bonus ~${blueprint.dividendPct}%`}
                  />
                )}
                {blueprint.commissionPct > 0 && (
                  <div
                    style={{
                      width: `${blueprint.commissionPct}%`,
                      background: 'linear-gradient(90deg, #d97706, #fbbf24)',
                    }}
                    title={`Foreman Commission ${blueprint.commissionPct}%`}
                  />
                )}
              </div>
              <div style={{ marginTop: '8px', fontSize: '.80rem', color: '#1e3a8a', fontWeight: 600 }}>
                💡 <strong>Best For:</strong> {activeBestFor}
              </div>
            </div>
          </div>

          {/* 2. Worked Cycle-by-Cycle Example Table */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ background: '#f1f5f9', padding: '10px 16px', fontWeight: 800, fontSize: '.88rem', color: '#0f172a' }}>
              🧮 Sample Worked Calculation Table (How Money Moves Across Cycles)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.83rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Cycle / Stage</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Gross Pool</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Bid Discount / Rule Applied</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Winner Payout</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Member Net Payable / Benefit</th>
                  </tr>
                </thead>
                <tbody>
                  {blueprint.exampleRows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{row.cycle}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.pot}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{row.discountOrRule}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#15803d' }}>{row.winnerGets}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1d4ed8' }}>{row.memberNextDue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Multi-Language Explanation Grid (All 6 Languages Side-by-Side) */}
          {showAllLocales && (
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: '.96rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🗣️</span>
                <span>Explanation in All 6 Regional Languages (Click any card to switch flowchart language)</span>
              </h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
                  gap: '12px',
                }}
              >
                {LOCALE_META.map((loc) => {
                  const locChits = ALL_DICTS[loc.code]?.chits ?? en.chits;
                  const locTemplatesMap = (locChits?.templates ?? {}) as Record<string, { title: string; badge: string; desc: string }>;
                  const locTmpl = locTemplatesMap[template.code] ?? locTemplatesMap[template.engineType] ?? enTemplatesMap[template.code] ?? enTemplatesMap[template.engineType];
                  const locEngineName = locChits?.engineNames?.[template.engineType] ?? catalog.name;
                  const locEngineDesc = locChits?.engineDescs?.[template.engineType] ?? catalog.description;
                  const locSteps = blueprint.flowSteps[loc.code] ?? blueprint.flowSteps.en;
                  const isCurrent = activeLocale === loc.code;

                  return (
                    <div
                      key={loc.code}
                      onClick={() => setActiveLocale(loc.code)}
                      style={{
                        border: isCurrent ? `2px solid ${loc.accent}` : '1px solid #e2e8f0',
                        borderLeft: `5px solid ${loc.accent}`,
                        background: isCurrent ? loc.bg : '#ffffff',
                        borderRadius: '12px',
                        padding: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span
                          style={{
                            fontSize: '.74rem',
                            fontWeight: 800,
                            padding: '2px 9px',
                            borderRadius: '999px',
                            background: loc.accent,
                            color: '#ffffff',
                          }}
                        >
                          {loc.nativeName} · {loc.englishName}
                        </span>
                        <span style={{ fontSize: '.72rem', fontWeight: 700, color: loc.accent }}>
                          {locTmpl?.badge || template.defaultBadge}
                        </span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '.92rem', color: '#0f172a', marginBottom: '4px' }}>
                        {locTmpl?.title || template.defaultName}
                      </div>
                      <div style={{ fontSize: '.76rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                        {locEngineName}
                      </div>
                      <p style={{ margin: '0 0 8px', fontSize: '.80rem', color: '#334155', lineHeight: 1.45 }}>
                        {locTmpl?.desc || locEngineDesc}
                      </p>
                      <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '.76rem', color: '#1e293b', lineHeight: 1.4 }}>
                        {locSteps.map((s, sIdx) => (
                          <li key={sIdx} style={{ marginBottom: '2px' }}>{s}</li>
                        ))}
                      </ol>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '.80rem', color: '#475569', fontWeight: 500 }}>
            {isApplied
              ? '✓ This template is currently applied to the creation form on the left.'
              : 'Click "Apply This Template" to autofill the form with these rules (100% editable).'}
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onApply(template);
                onClose();
              }}
              style={{ fontWeight: 700 }}
            >
              ⚡ {isApplied ? 'Keep Template & Return to Form' : 'Apply This Template to Form'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
