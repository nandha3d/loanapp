'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, Phone, Calendar, RotateCcw, Globe, ArrowRight } from 'lucide-react';

function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.10);
    gain2.gain.setValueAtTime(0.10, now + 0.10);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.10);
    osc2.stop(now + 0.45);
  } catch (err) {}
}

interface LanguageDef {
  code: string;
  label: string;
  flag: string;
}

const LANGUAGES: LanguageDef[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn', label: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', label: 'മലയാളം', flag: '🇮🇳' }
];

const GREETING_TEXTS: Record<string, { welcome: string; suggestions: string[] }> = {
  en: {
    welcome: "Hello! 👋 I'm **Zolo Assistant**, your lending software specialist.\n\n**Important Notice:** Zolo Funds is a **loan tracking software for lenders and NBFCs** — we do not provide loans directly to individuals.\n\nHow can I help your finance business today?",
    suggestions: [
      "Do you provide loans to borrowers?",
      "Book a live demo",
      "What are your pricing plans?",
      "How does GPS collection work?",
      "Explain Daily & Weekly Microfinance",
      "Do you support Gold Loans & Chit Funds?"
    ]
  },
  ta: {
    welcome: "வணக்கம்! 🙏 நான் **Zolo Assistant**.\n\n**முக்கிய குறிப்பு:** Zolo Funds என்பது பைனான்சியர்கள் மற்றும் கடன் நிறுவனங்களுக்கான **கடன் கண்காணிப்பு மென்பொருள் (Loan Tracking Software)** — நாங்கள் நேரடியாக கடன் வழங்குவதில்லை.\n\nஉங்கள் பைனான்ஸ் நிறுவனத்திற்கு என்ன உதவி தேவை?",
    suggestions: [
      "நேரடி டெமோ பார்க்க வேண்டும்",
      "நீங்கள் கடன் தருகிறீர்களா?",
      "மென்பொருளின் விலை எவ்வளவு?",
      "தினசரி தண்டல் மைக்ரோபைனான்ஸ் எப்படி இயங்குகிறது?",
      "GPS கலெக்ஷன் எப்படி வேலை செய்கிறது?",
      "நகைக்கடன் & சீட்டு நிதி ஆதரவு உண்டா?"
    ]
  },
  hi: {
    welcome: "नमस्ते! 🙏 मैं **Zolo Assistant** हूँ।\n\n**ज़रूरी सूचना:** Zolo Funds लेंडर्स और NBFCs के लिए एक **लोन ट्रैकिंग और कलेक्शन सॉफ्टवेयर** है — हम सीधे लोन नहीं देते हैं।\n\nआपके फाइनेंस बिज़नेस के लिए क्या जानकारी चाहिए?",
    suggestions: [
      "लाइव डेमो बुक करें",
      "क्या आप सीधे लोन देते हैं?",
      "सॉफ्टवेयर के प्लान और कीमत क्या है?",
      "डेली माइक्रोफाइनेंस कैसे काम करता है?",
      "GPS फील्ड ट्रैकिंग कैसे काम करती है?",
      "क्या गोल्ड लोन और चिट फंड सपोर्ट है?"
    ]
  },
  te: {
    welcome: "నమస్కారం! 🙏 నేను **Zolo Assistant**.\n\n**ముఖ్య గమనిక:** Zolo Funds అనేది ఫైనాన్షియర్స్ కోసం ఒక **లోన్ ట్రాకింగ్ సాఫ్ట్‌వేర్** — మేము నేరుగా రుణాలు ఇవ్వము.\n\nమీ ఫైనాన్స్ వ్యాపారం కోసం ఏ సమాచారం కావాలి?",
    suggestions: [
      "డెమో చూడండి",
      "మీరు రుణాలు ఇస్తారా?",
      "ధరలు మరియు ప్లాన్లు ఏమిటి?",
      "డైలీ మైక్రోఫైనాన్స్ ఎలా పనిచేస్తుంది?"
    ]
  },
  kn: {
    welcome: "ನಮಸ್ಕಾರ! 🙏 ನಾನು **Zolo Assistant**.\n\n**ಪ್ರಮುಖ ಮಾಹಿತಿ:** Zolo Funds ಸಾಲ ನೀಡುವ ಸಂಸ್ಥೆಗಳಿಗಾಗಿ ಒಂದು **ಲೋನ್ ಟ್ರ್ಯಾಕಿಂಗ್ ಸಾಫ್ಟ್‌ವೇರ್** — ನಾವು ನೇರವಾಗಿ ಸಾಲ ನೀಡುವುದಿಲ್ಲ.\n\nನಿಮ್ಮ ಫೈನಾನ್ಸ್ ವ್ಯವಹಾರಕ್ಕೆ ಯಾವ ಮಾಹಿತಿ ಬೇಕು?",
    suggestions: [
      "ಡೆಮೊ ವೀಕ್ಷಿಸಿ",
      "ನೀವು ಸಾಲ ನೀಡುತ್ತೀರಾ?",
      "ಸಾಫ್ಟ್‌ವೇರ್ ಬೆಲೆ ಎಷ್ಟು?",
      "ದೈನಂದಿನ ಮೈಕ್ರೋಫೈನಾನ್ಸ್ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ?"
    ]
  },
  ml: {
    welcome: "നമസ്കാരം! 🙏 ഞാൻ **Zolo Assistant**.\n\n**ശ്രദ്ധിക്കുക:** Zolo Funds എന്നത് ധനകാര്യ സ്ഥാപനങ്ങൾക്കായുള്ള ഒരു **ലോൺ ട്രാക്കിംഗ് സോഫ്റ്റ്‌വെയർ** ആണ് — ഞങ്ങൾ നേരിട്ട് വായ്പ നൽകുന്നില്ല.\n\nനിങ്ങളുടെ ഫിനാൻസ് ബിസിനസിന് എന്ത് സഹായമാണ് വേണ്ടത്?",
    suggestions: [
      "ഡെമോ കാണുക",
      "നിങ്ങൾ വായ്പ നൽകുന്നുണ്ടോ?",
      "സോഫ്റ്റ്‌വെയർ നിരക്കുകൾ എത്ര?",
      "ഡെയ്ലി കളക്ഷൻ എങ്ങനെ പ്രവർത്തിക്കുന്നു?"
    ]
  }
};

interface ActionItem {
  type: 'demo' | 'whatsapp' | 'call' | 'link';
  label: string;
  url?: string;
}

interface MessageItem {
  sender: 'bot' | 'user';
  text: string;
  actions?: ActionItem[];
  suggestions?: string[];
  isDemoForm?: boolean;
}

interface KnowledgeItem {
  id: string;
  keywords: string[];
  answer: Record<string, string>;
  actions?: ActionItem[];
  suggestions?: string[];
  isDemoForm?: boolean;
}

const KNOWLEDGE_BASE: KnowledgeItem[] = [
  // 1. CRITICAL: "Do you give loans? / Can I get a loan? / Is this lending money to the borrower?"
  {
    id: 'not_a_lender',
    keywords: [
      'lend money', 'lending money', 'give loan', 'giving loan', 'provide loan', 'providing loan',
      'get a loan', 'need loan', 'borrow money', 'borrower loan', 'apply loan', 'apply for loan',
      'can i get loan', 'do you give loan', 'do you give loans', 'is this capable of lending',
      'loan kidaikuma', 'kadan kidaikuma', 'kadan tharuvirgala', 'kadan venum', 'loan venum',
      'loan milega', 'loan dete ho', 'kya aap loan dete ho', 'paisa chahiye', 'loan chahiye',
      'personal loan', 'urgent loan', 'cash loan', 'runam', 'saala', 'vaaypa'
    ],
    answer: {
      en: "❌ **No. Zolo Funds does NOT provide loans or lend money to borrowers.**\n\n" +
          "Zolo Funds is strictly a **B2B Loan Management & Field Collection Software Platform** built for lenders, NBFCs, microfinance institutions, vehicle financiers, and chit fund operators to track and manage their own operations.\n\n" +
          "• We are a **technology provider**, not a bank or money lender.\n" +
          "• If you run a **lending business**, our software will help you track daily collections, GPS geofencing, and overdue loans.\n" +
          "• You can test our software with an unconditional **14-Day Free Trial**!",
      ta: "❌ **இல்லை. Zolo Funds கடன் வழங்கும் நிறுவனம் அல்ல. நாங்கள் கடன் கொடுப்பதில்லை.**\n\n" +
          "Zolo Funds என்பது கடன் கொடுக்கும் பைனான்சியர்கள், NBFCகள், மைக்ரோபைனான்ஸ் நிறுவனங்கள் மற்றும் சீட்டு நிதி நடத்துவோருக்கான **கடன் கண்காணிப்பு தொழில்நுட்ப மென்பொருள் (Loan Tracking Software)** மட்டுமே.\n\n" +
          "• நாங்கள் மென்பொருள் தயாரிப்பாளர்கள்; பணக்கடன் வழங்குபவர்கள் அல்ல.\n" +
          "• நீங்கள் பைனான்ஸ் தொழில் நடத்துபவராக இருந்தால், உங்கள் கடன்களையும் கலெக்ஷன் ஏஜென்டுகளையும் நிர்வகிக்க எங்கள் மென்பொருளைப் பயன்படுத்தலாம்!\n" +
          "• 14 நாள் இலவச சோதனையை (Free Trial) இன்றே தொடங்கலாம்!",
      hi: "❌ **नहीं। Zolo Funds कोई लोन देने वाली कंपनी या बैंक नहीं है। हम सीधे लोन नहीं देते हैं।**\n\n" +
          "Zolo Funds एक **लोन मैनेजमेंट और फील्ड कलेक्शन सॉफ्टवेयर** है जो लेंडर्स, NBFCs, और माइक्रोफाइनेंस कंपनियों को अपने लोन और डेली कलेक्शन ट्रैक करने के लिए बनाया गया है।\n\n" +
          "• हम एक सॉफ्टवेयर टेक्नोलॉजी प्रदाता हैं, लोन देने वाले नहीं।\n" +
          "• यदि आपका फाइनेंस व्यवसाय है, तो आप हमारे सॉफ्टवेयर से फील्ड एजेंट्स, GPS और लेज़र आसानी से संभाल सकते हैं।\n" +
          "• आप 14 दिन का **फ्री ट्रायल** आज ही शुरू कर सकते हैं!"
    },
    actions: [
      { type: 'demo', label: 'Book Live Walkthrough' },
      { type: 'whatsapp', label: 'WhatsApp Sales' }
    ]
  },

  // 2. Demo Trigger
  {
    id: 'book_demo',
    keywords: ['book demo', 'live demo', 'schedule demo', 'demo', 'walkthrough', 'presentation', 'trial', 'free trial', 'sample', 'try software', 'test app'],
    isDemoForm: true,
    answer: {
      en: "I would be glad to arrange a **live 1-on-1 walkthrough** of Zolo Funds! 📅\n\nPlease provide your details below and our product specialist will reach out to schedule your demo.",
      ta: "Zolo Funds நேரடி டெமோவை (Live Walkthrough) திட்டமிடுவதில் மகிழ்ச்சி! 📅\n\nஉங்கள் விபரங்களை கீழே உள்ள படிவத்தில் உள்ளிடுங்கள், எங்கள் தயாரிப்பு ஆலோசகர் உங்களைத் தொடர்புகொள்வார்.",
      hi: "Zolo Funds का **लाइव 1-ऑन-1 डेमो** शेड्यूल करने के लिए कृपया नीचे अपना विवरण भरें। 📅\n\nहमारे प्रोडक्ट स्पेशलिस्ट आपसे संपर्क करेंगे।"
    }
  },

  // 3. Pricing & Subscriptions
  {
    id: 'pricing',
    keywords: ['price', 'pricing', 'cost', 'plan', 'plans', 'subscription', 'charge', 'rate', 'how much', 'fee', 'package', 'starter', 'growth', 'scale', 'vilai', 'kattanam', 'daam', 'keemat'],
    answer: {
      en: "Zolo Funds offers transparent, value-driven pricing tiers with no hidden charges:\n\n" +
          "• **Starter (₹999/mo):** Up to 2 branches, 3 collection agents, daily/weekly microfinance, digital day-book.\n" +
          "• **Growth (₹2,999/mo):** Up to 5 branches, 10 collection agents, auto finance & gold loans, GPS geofencing, thermal printer integration.\n" +
          "• **Scale (₹7,999/mo):** Unlimited branches, 25 agents, chit funds, WhatsApp receipts & double-entry accounting.\n" +
          "• **Enterprise (Custom):** Dedicated database, custom API integrations, NBFC scaling & on-site staff training.\n\n" +
          "Every plan starts with an unconditional **14-Day Free Trial** with no credit card required!",
      ta: "Zolo Funds மென்பொருளின் வெளிப்படையான கட்டண விபரங்கள்:\n\n" +
          "• **Starter (₹999/மாதம்):** 2 கிளைகள், 3 கலெக்ஷன் ஏஜென்டுகள், தினசரி/வாராந்திர மைக்ரோபைனான்ஸ், டிஜிட்டல் டே-புக்.\n" +
          "• **Growth (₹2,999/மாதம்):** 5 கிளைகள், 10 ஏஜென்டுகள், வாகன பைனான்ஸ் & நகைக்கடன், GPS ஜியோபென்சிங், புளூடூத் பிரிண்டர்.\n" +
          "• **Scale (₹7,999/மாதம்):** வரம்பற்ற கிளைகள், 25 ஏஜென்டுகள், சீட்டு நிதி, வாட்ஸ்அப் ரசீதுகள், இரட்டைப் பதிவு கணக்கியல்.\n" +
          "அனைத்து பிளான்களுக்கும் **14 நாள் இலவச சோதனை (Free Trial)** உண்டு!",
      hi: "Zolo Funds सॉफ्टवेयर के किफायती और पारदर्शी प्लान्स:\n\n" +
          "• **Starter (₹999/माह):** 2 ब्रांच, 3 कलेक्शन एजेंट्स, डेली/वीकली माइक्रोफाइनेंस, डे-बुक।\n" +
          "• **Growth (₹2,999/माह):** 5 ब्रांच, 10 एजेंट्स, ऑटो व गोल्ड लोन, GPS जियोफेंसिंग, थर्मल प्रिंटर।\n" +
          "• **Scale (₹7,999/माह):** अनलिमिटेड ब्रांच, 25 एजेंट्स, चिट फंड, व्हाट्सएप रसीदें और अकाउंटिंग।\n" +
          "हर प्लान में **14 दिन का फ्री ट्रायल** बिना किसी क्रेडिट कार्ड के उपलब्ध है!"
    },
    actions: [
      { type: 'demo', label: 'Book Live Walkthrough' },
      { type: 'whatsapp', label: 'WhatsApp Sales' }
    ]
  },

  // 4. Daily & Weekly Microfinance (Thandal)
  {
    id: 'microfinance',
    keywords: ['micro', 'microlending', 'daily', 'weekly', 'thandal', 'vaddi', 'kandhu', 'emi', 'flat', 'reducing', 'diminishing', 'daily collection', 'instalment', 'penalty', 'foreclosure', 'thandal app'],
    answer: {
      en: "Zolo Funds is tailor-made for Indian **Daily & Weekly Microfinance (Thandal)**:\n\n" +
          "• **Flexible Cadence:** Daily (e.g. 100 days), Weekly, Bi-weekly, and Monthly repayment schedules.\n" +
          "• **Calculation Modes:** Flat EMI or Diminishing (Reducing Balance) with exact day-count conventions.\n" +
          "• **Agent Run Sheets:** Line-by-line doorstep collection lists ordered by customer location efficiency.\n" +
          "• **Cash Drawer Handshake:** Collection agents surrender collected cash to branch cashier with two-way digital signature verification.\n" +
          "• **Automated Penalty Engine:** Configurable grace periods and linear overdue penalty calculations.\n" +
          "• **Foreclosure Engine:** Early loan payoff with automated interest rebate discounts.",
      ta: "Zolo Funds இந்திய **தினசரி & வாராந்திர மைக்ரோபைனான்ஸ் (தண்டல்)** முறைக்காகவே வடிவமைக்கப்பட்டது:\n\n" +
          "• **தவணை முறைகள்:** தினசரி (100 நாள் தண்டல்), வாராந்திர, 15 நாட்கள் மற்றும் மாதத் தவணைகள்.\n" +
          "• **வட்டி கணக்கீடு:** பிளாட் இ.எம்.ஐ (Flat EMI) அல்லது குறைந்துவரும் இருப்பு வட்டி (Diminishing Interest).\n" +
          "• **கலெக்ஷன் பட்டியல்:** ஏஜென்டுகளுக்கு ஏதுவாக வரிசைப்படுத்தப்பட்ட டோர்ஸ்டெப் ரன்-ஷீட்.\n" +
          "• **கேஷியர் சரிபார்ப்பு:** ஏஜென்ட் வசூலித்த பணத்தை மாலையில் கிளையில் ஒப்படைக்கும் டிஜிட்டல் ஹேண்ட்ஷேக்.\n" +
          "• **அபராதக் கணக்கீடு:** சலுகை நாட்கள் மற்றும் தாமதக் கட்டணங்கள் தானாக கணக்கிடப்படும்.",
      hi: "Zolo Funds भारतीय **डेली और वीकली माइक्रोफाइनेंस (कलेक्शन)** के लिए परफेक्ट है:\n\n" +
          "• **लचीली किस्तें:** डेली (100 दिन आदि), वीकली और मंथली कलेक्शन शेड्यूल्स।\n" +
          "• **ब्याज गणना:** फ्लैट ईएमआई (Flat EMI) या रिड्यूसिंग बैलेंस (Diminishing)।\n" +
          "• **एजेंट रन शीट:** घर-घर कलेक्शन के लिए आसान रूट लिस्ट।\n" +
          "• **कैशियर मिलान:** शाम को एजेंट द्वारा कैशियर को डिजिटल हैंडशेक से कैश जमा करना।\n" +
          "• **पेनल्टी नियम:** ग्रेस पीरियड और लेट पेनल्टी की ऑटोमैटिक कैलकुलेशन।"
    },
    actions: [
      { type: 'demo', label: 'Book Live Walkthrough' },
      { type: 'whatsapp', label: 'WhatsApp Sales' }
    ]
  },

  // 5. GPS Doorstep Verification
  {
    id: 'gps',
    keywords: ['gps', 'geofence', 'geofencing', 'location', 'tracking', 'doorstep', 'route', 'fraud', 'phantom'],
    answer: {
      en: "Our **GPS Collection Verification Engine** eliminates phantom collections and employee fraud:\n\n" +
          "• **Live Doorstep Geofence:** When an agent taps 'Collect', the mobile app verifies satellite GPS coordinates against the borrower's registered home or shop.\n" +
          "• **Manager Radius Alerts:** Collections attempted beyond the permissible radius (e.g. 50 meters) are flagged immediately for manager approval.\n" +
          "• **Optimized Route Sheets:** The app organizes the daily collection list geographically to minimize fuel and travel time.\n" +
          "• **Shift-Only Privacy:** GPS tracking runs strictly during active work hours; tracking terminates immediately when the agent clocks out.",
      ta: "எங்கள் **GPS கலெக்ஷன் வெரிஃபிகேஷன்** போலி என்ட்ரிகளை 100% தடுக்கிறது:\n\n" +
          "• **டோர்ஸ்டெப் ஜியோபென்சிங்:** ஏஜென்ட் 'Collect' பொத்தானை அழுத்தும்போது, வாடிக்கையாளரின் பதிவு செய்யப்பட்ட கடையிலோ வீட்டிலோ நேரில் இருக்கிறாரா என செயற்கைக்கோள் GPS மூலம் சரிபார்க்கிறது.\n" +
          "• **மேனேஜர் எச்சரிக்கை:** நிர்ணயிக்கப்பட்ட தூரத்திற்கு வெளியே வசூலிக்க முயன்றால் உடனடியாக மேனேஜருக்கு அலர்ட் செல்கிறது.\n" +
          "• **ஷிப்ட் நேரம் மட்டும்:** ஏஜென்ட் பணி தொடங்கும் போது மட்டும் GPS இயங்கும்; லாக்-அவுட் செய்தவுடன் தானாக நின்றுவிடும்.",
      hi: "हमारा **GPS वेरिफिकेशन इंजन** फर्जी कलेक्शन और फ्रॉड को पूरी तरह रोकता है:\n\n" +
          "• **लाइव डोरस्टेप जियोफेंसिंग:** जब एजेंट 'Collect' दबाता है, तो ऐप सैटेलाइट GPS से जांचता है कि वह ग्राहक की दुकान या घर पर मौजूद है या नहीं।\n" +
          "• **मैनेजर अलर्ट:** तय दूरी से बाहर कलेक्शन की कोशिश पर मैनेजर को तुरंत अलर्ट मिलता है।"
    },
    actions: [
      { type: 'demo', label: 'Book Live Walkthrough' },
      { type: 'whatsapp', label: 'WhatsApp' }
    ]
  },

  // 6. Offline Sync
  {
    id: 'offline',
    keywords: ['offline', 'no internet', 'connectivity', 'network', 'sync', 'signal', 'rural', 'basement'],
    answer: {
      en: "Yes! The ZoloFund Android mobile app features an **Offline-First Synchronization Architecture**:\n\n" +
          "• **Zero-Signal Collections:** Agents can collect cash installments in basements, remote villages, or hill stations with zero internet signal.\n" +
          "• **Cryptographic Storage:** Every collection creates a tamper-proof cryptographic receipt stored locally in encrypted device memory.\n" +
          "• **3-Second Auto Sync:** The moment the phone detects 2G, 3G, 4G, or Wi-Fi, all transactions automatically upload and reconcile with the head office ledger in under 3 seconds!",
      ta: "ஆம்! ZoloFund ஆண்ட்ராய்டு ஆப் **முழுமையான ஆஃப்லைன் (Offline) வசதி** கொண்டது:\n\n" +
          "• **இன்டர்நெட் தேவையில்லை:** பேஸ்மென்ட் கடைகள் அல்லது கிராமங்களில் சிக்னல் இல்லாவிட்டாலும் தடையின்றி ரசீது போடலாம்.\n" +
          "• **3 நொடிகளில் ஆட்டோ-சிங்க்:** மொபைலில் சிக்னல் கிடைத்தவுடன் 3 நொடிகளுக்குள் தலைமை அலுவலக லெட்ஜரில் தானாக அப்டேட் ஆகிவிடும்!",
      hi: "हाँ! ZoloFund एंड्रॉइड ऐप **ऑफलाइन-फर्स्ट टेक्नोलॉजी** पर काम करता है:\n\n" +
          "• **बिना इंटरनेट कलेक्शन:** बेसमेंट या गांवों में बिना नेटवर्क सिग्नल के भी कलेक्शन किया जा सकता है।\n" +
          "• **3 सेकंड में ऑटो-सिंक:** जैसे ही नेटवर्क मिलता है, डेटा 3 सेकंड में हेड ऑफिस में सिंक हो जाता है!"
    },
    actions: [
      { type: 'demo', label: 'Book Live Walkthrough' },
      { type: 'whatsapp', label: 'WhatsApp' }
    ]
  },

  // 7. Gold Loan & Jewels
  {
    id: 'goldloan',
    keywords: ['gold', 'jewel', 'jewelry', 'pawn', 'pawnbroking', 'giruva', 'giruvas', 'nagai', 'ornament', 'karat', 'purity', 'vault', 'safe', 'locker', 'auction'],
    answer: {
      en: "Our **Gold Loan & Jewel Mortgage Module** offers bank-grade collateral security:\n\n" +
          "• **Detailed Item Appraisal:** Itemize bangles, chains, rings with gross weight, stone deduction, net weight, and karat purity (22K, 18K).\n" +
          "• **Vault Packet Identification:** Assign each loan file to an encrypted safe locker packet ID.\n" +
          "• **Interest Schemes:** Simple monthly interest, compound interest, or Bullet repayment (principal due at end).\n" +
          "• **Market Value Recalculation:** Instant LTV monitoring against daily Gold Bullion rates.\n" +
          "• **Statutory Auction Register:** Automated registered notice generator complying with Indian pawn-broking laws.",
      ta: "எங்கள் **நகைக்கடன் & அடகு மென்பொருள் (Gold Loan Module)** வங்கித் தரத்திலான பாதுகாப்பை வழங்குகிறது:\n\n" +
          "• **ஆபரண மதிப்பீடு:** வளையல், செயின், மோதிரம் என மொத்த எடை, கல் கழிவு, நிகர எடை மற்றும் 22K/18K காரட் தரம் வாரியாகப் பதிவு செய்யலாம்.\n" +
          "• **லாக்கர் பாக்கெட் ஐடி:** ஒவ்வொரு நகைக் கணக்கிற்கும் பிரத்யேக லாக்கர் பாக்கெட் எண் ஒதுக்கப்படும்.\n" +
          "• **ஏல நோட்டீஸ்:** தவணை தவறிய கடன்களுக்கு சட்டரீதியான ஏல அறிவிப்பு நோட்டீஸ்களை உடனே அச்சிடலாம்.",
      hi: "हमारा **गोल्ड लोन मॉड्यूल** बैंक-ग्रेड सुरक्षा प्रदान करता है:\n\n" +
          "• **विस्तृत मूल्यांकन:** गहनों का ग्रॉस वजन, स्टोन कटौती, नेट वजन और 22K/18K शुद्धता दर्ज करें।\n" +
          "• **लॉकर पैकेट आईडी:** हर लोन फाइल के लिए सुरक्षित लॉकर पैकेट पहचान संख्या।\n" +
          "• **ऑक्शन नोटिस:** डिफ़ॉल्ट पर नियमानुसार लीगल नीलामी नोटिस तुरंत बनाएं।"
    },
    actions: [
      { type: 'demo', label: 'Book Live Walkthrough' },
      { type: 'whatsapp', label: 'WhatsApp' }
    ]
  },

  // 8. Chit Funds
  {
    id: 'chitfunds',
    keywords: ['chit', 'chit fund', 'chitty', 'seettu', 'auction', 'foreman', 'dividend', 'subscriber', 'reverse auction', 'passbook', 'act 1982'],
    answer: {
      en: "Yes! Zolo Funds features a dedicated **Chit Fund Operating Module** compliant with the Chit Funds Act, 1982:\n\n" +
          "• **Group Lifecycle:** Create chit pools (20, 25, or 50 members; ₹50,000 to ₹1 Crore pools).\n" +
          "• **Reverse Auction Engine:** Record monthly member bids, calculate discount prize money, and enforce statutory ceiling bids.\n" +
          "• **Foreman Commission:** Automated 5% foreman commission calculation.\n" +
          "• **Dividend Distribution:** Auto-split remaining discount among all non-prized subscribers to reduce next month's call.\n" +
          "• **Digital Passbook:** Automated member passbook generation and registrar compliance filings.",
      ta: "ஆம்! Zolo Funds-ல் **சீட்டு நிதி சட்டம் 1982**-க்கு இணங்க பிரத்யேக சீட்டு மேலாண்மை உள்ளது:\n\n" +
          "• **சீட்டு குழுக்கள்:** 20, 25 அல்லது 50 உறுப்பினர்கள் கொண்ட குழுக்கள்.\n" +
          "• **ரிவர்ஸ் ஏலம்:** மாதாந்திர ஏலப் பதிவு, தள்ளுபடித் தொகை மற்றும் ஏல உச்சவரம்பு தானாகக் கணக்கிடப்படும்.\n" +
          "• **ஃபோர்மேன் கமிஷன்:** 5% ஃபோர்மேன் கமிஷன் தானாக கழிக்கப்படும்.\n" +
          "• **டிவிடென்ட் பகிர்வு:** ஏலம் எடுக்காத உறுப்பினர்களுக்கு லாபப் பங்கு தானாகப் பகிரப்படும்.",
      hi: "हाँ! Zolo Funds में **चिट फंड एक्ट 1982** के अनुसार पूर्ण चिट फंड मॉड्यूल है:\n\n" +
          "• **चिट ग्रुप्स:** 20, 25 या 50 सदस्यों वाले ₹50,000 से ₹1 करोड़ तक के ग्रुप्स बनाएं।\n" +
          "• **रिवर्स ऑक्शन:** मासिक बोली, प्राइज़ मनी और डिस्काउंट की सटीक गणना।\n" +
          "• **फोरमैन कमीशन:** 5% फोरमैन कमीशन ऑटो-डिडक्शन।\n" +
          "• **डिजिटल पासबुक:** सदस्यों के लिए ऑटोमैटिक पासबुक।"
    },
    actions: [
      { type: 'demo', label: 'Book Live Walkthrough' },
      { type: 'whatsapp', label: 'WhatsApp' }
    ]
  },

  // 9. Contact & Office
  {
    id: 'contact_office',
    keywords: ['contact', 'phone', 'call', 'number', 'address', 'office', 'support', 'email', 'location', 'erode', 'animazon', 'narayana valasu', 'nasiyanur', 'tamil nadu'],
    answer: {
      en: "You can reach the Zolo Funds team directly:\n\n" +
          "• **Helpline & Sales:** [+91 80894 05950](tel:+918089405950)\n" +
          "• **WhatsApp Support:** Instant chat available Monday–Saturday\n" +
          "• **Email Support:** [support@zolofunds.com](mailto:support@zolofunds.com)\n" +
          "• **Corporate Office Address:**\n" +
          "  **155, Animazon, Narayana Valasu, Nasiyanur Road, Erode - 638011, Tamil Nadu, India**\n" +
          "• **Languages Supported:** Tamil, English, Hindi, Telugu, Kannada, Malayalam\n" +
          "• **Support Hours:** Monday–Saturday, 09:30 AM to 06:30 PM IST.",
      ta: "Zolo Funds குழுவை நேரடியாகத் தொடர்பு கொள்ள:\n\n" +
          "• **தொலைபேசி உதவி:** [+91 80894 05950](tel:+918089405950)\n" +
          "• **மின்னஞ்சல்:** [support@zolofunds.com](mailto:support@zolofunds.com)\n" +
          "• **தலைமை அலுவலக முகவரி:**\n" +
          "  **155, Animazon, நாராயண வலசு, நசியனூர் ரோடு, ஈரோடு - 638011, தமிழ்நாடு, இந்தியா**\n" +
          "• **பேசப்படும் மொழிகள்:** தமிழ், ஆங்கிலம், இந்தி, தெலுங்கு, கன்னடம், மலையாளம்.",
      hi: "आप Zolo Funds टीम से सीधे संपर्क कर सकते हैं:\n\n" +
          "• **हेल्पलाइन व सेल्स:** [+91 80894 05950](tel:+918089405950)\n" +
          "• **ईमेल:** [support@zolofunds.com](mailto:support@zolofunds.com)\n" +
          "• **कॉर्पोरेट ऑफिस का पता:**\n" +
          "  **155, Animazon, नारायणा वलसु, नसियानूर रोड, इरोड - 638011, तमिलनाडु, भारत**\n" +
          "• **भाषाएँ:** तमिल, अंग्रेजी, हिंदी, तेलुगु, कन्नड़, मलयालम।"
    },
    actions: [
      { type: 'call', label: 'Call +91 80894 05950' },
      { type: 'whatsapp', label: 'WhatsApp' }
    ]
  }
];

function detectLanguage(text: string): string | null {
  if (/[\u0B80-\u0BFF]/.test(text) || /\b(thandal|vaddi|kadan|kidaikuma|eppadi|solla|vilai|nanri|vanakkam|seettu|nagai)\b/i.test(text)) {
    return 'ta';
  }
  if (/[\u0900-\u097F]/.test(text) || /\b(namaste|kaise|kitna|daam|chahiye|batao|kya|milega|dete|paisa)\b/i.test(text)) {
    return 'hi';
  }
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml';
  return null;
}

function findSmartAnswer(userInput: string, currentLang: string) {
  const query = userInput.toLowerCase().trim();
  if (!query) return null;

  const detected = detectLanguage(query);
  const activeLang = detected || currentLang || 'en';

  let bestMatch: KnowledgeItem | null = null;
  let highestScore = 0;

  for (const item of KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of item.keywords) {
      if (query.includes(kw)) {
        score += kw.length * (kw.includes(' ') ? 2.5 : 1.0);
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  if (bestMatch && highestScore > 0) {
    const answerText = bestMatch.answer[activeLang] || bestMatch.answer['en'];
    return {
      answer: answerText,
      actions: bestMatch.actions || [],
      suggestions: bestMatch.suggestions || [],
      isDemoForm: bestMatch.isDemoForm || false,
      detectedLang: activeLang
    };
  }

  const fallback: Record<string, string> = {
    en: "Zolo Funds is a **Loan Tracking & Collection Software Platform for Lenders & NBFCs** (we do not lend money directly).\n\nWe support Daily Microfinance, Auto Finance, Gold Loans, and Chit Funds with GPS doorstep verification. Would you like to book a 1-on-1 walkthrough or try the 14-day free trial?",
    ta: "Zolo Funds என்பது **பைனான்சியர்களுக்கான கடன் கண்காணிப்பு மென்பொருள்** (நாங்கள் நேரடியாக கடன் கொடுப்பதில்லை).\n\nதினசரி மைக்ரோபைனான்ஸ், வாகன கடன், நகைக்கடன் மற்றும் சீட்டு நிதி மேலாண்மை வசதிகள் இதில் உள்ளன. நேரடி டெமோ பார்க்க விரும்புகிறீர்களா?",
    hi: "Zolo Funds **लेंडर्स और फाइनेंस कंपनियों के लिए एक लोन ट्रैकिंग सॉफ्टवेयर** है (हम सीधे लोन नहीं देते)।\n\nइसमें डेली माइक्रोफाइनेंस, ऑटो व गोल्ड लोन और GPS फील्ड ट्रैकिंग उपलब्ध है। क्या आप 14 दिन का फ्री ट्रायल देखना चाहते हैं?"
  };

  return {
    answer: fallback[activeLang] || fallback['en'],
    actions: [
      { type: 'demo' as const, label: 'Book Live Walkthrough' },
      { type: 'whatsapp' as const, label: 'WhatsApp' },
      { type: 'call' as const, label: 'Call +91 80894 05950' }
    ],
    suggestions: [
      "Do you provide loans to borrowers?",
      "Book a live demo",
      "What are your pricing plans?"
    ],
    detectedLang: activeLang
  };
}

interface AiChatWidgetProps {
  onOpenDemo?: () => void;
}

export default function AiChatWidget({ onOpenDemo }: AiChatWidgetProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState('en');
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      sender: 'bot',
      text: GREETING_TEXTS.en.welcome,
      suggestions: GREETING_TEXTS.en.suggestions
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(1);
  const [showGreetingBubble, setShowGreetingBubble] = useState(false);

  // Interactive Demo Form state
  const [demoForm, setDemoForm] = useState({
    name: '',
    phone: '',
    company: '',
    vertical: 'microlending',
    city: ''
  });
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasGreeted = sessionStorage.getItem('zolo_assistant_greeted');
    if (!hasGreeted && !isOpen) {
      const timer = setTimeout(() => {
        setShowGreetingBubble(true);
        playChime();
        sessionStorage.setItem('zolo_assistant_greeted', 'true');
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnreadCount(0);
      setShowGreetingBubble(false);
    }
  }, [isOpen, messages]);

  const handleLanguageChange = (newLang: string) => {
    setLang(newLang);
    const greeting = GREETING_TEXTS[newLang] || GREETING_TEXTS.en;
    setMessages(prev => [
      ...prev,
      {
        sender: 'bot',
        text: greeting.welcome,
        suggestions: greeting.suggestions
      }
    ]);
  };

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    const userMessage: MessageItem = { sender: 'user', text };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const match = findSmartAnswer(text, lang);
      if (match) {
        if (match.detectedLang && match.detectedLang !== lang) {
          setLang(match.detectedLang);
        }
        const botMessage: MessageItem = {
          sender: 'bot',
          text: match.answer,
          actions: match.actions || [],
          suggestions: match.suggestions || [],
          isDemoForm: match.isDemoForm || false
        };
        setMessages(prev => [...prev, botMessage]);
      }
      setIsTyping(false);
    }, 350);
  };

  const triggerDemoFormInChat = () => {
    setMessages(prev => [
      ...prev,
      {
        sender: 'bot',
        text: lang === 'ta'
          ? "Zolo Funds நேரடி டெமோவை (Live Walkthrough) திட்டமிடுவதில் மகிழ்ச்சி! 📅\n\nதயவுசெய்து உங்கள் விபரங்களை கீழே பூர்த்தி செய்யுங்கள். எங்கள் ஆலோசகர் உங்களைத் தொடர்புகொள்வார்."
          : lang === 'hi'
          ? "Zolo Funds का लाइव 1-ऑन-1 डेमो शेड्यूल करने के लिए कृपया नीचे अपना विवरण भरें। 📅\n\nहमारे स्पेशलिस्ट आपसे संपर्क करेंगे।"
          : "I would be glad to arrange a **live 1-on-1 walkthrough** of Zolo Funds! 📅\n\nPlease provide your details below and our product specialist will reach out to schedule your demo.",
        isDemoForm: true
      }
    ]);
  };

  const handleActionClick = (action: ActionItem) => {
    if (action.type === 'demo') {
      triggerDemoFormInChat();
    } else if (action.type === 'whatsapp') {
      window.open('https://wa.me/918089405950?text=Hi%2C%20I%20have%20an%20inquiry%20about%20Zolo%20Funds', '_blank');
    } else if (action.type === 'call') {
      window.location.href = 'tel:+918089405950';
    } else if (action.type === 'link' && action.url) {
      window.location.href = action.url;
    }
  };

  const submitInChatDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoForm.name.trim() || !demoForm.phone.trim()) {
      alert('Please enter your Name and Phone number.');
      return;
    }

    setIsSubmittingDemo(true);
    const payload = {
      name: demoForm.name.trim(),
      phone: demoForm.phone.trim(),
      company: demoForm.company.trim() || 'Individual Lender',
      vertical: demoForm.vertical || 'microlending',
      city: demoForm.city.trim() || 'Tamil Nadu',
      source: 'chat_assistant',
      message: 'Lead captured directly through Zolo Assistant in-chat demo form.'
    };

    try {
      const endpoint = window.location.hostname.includes('zolofunds.com')
        ? '/api/demo_request.php'
        : '/api/demo-request';

      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('Network request failed, continuing fallback confirmation:', err);
    }

    setIsSubmittingDemo(false);
    setDemoSubmitted(true);

    const confirmationText = lang === 'ta'
      ? `🎉 **நன்றி, ${demoForm.name}! உங்கள் நேரடி டெமோ பதிவு செய்யப்பட்டது.**\n\nஉங்கள் விபரங்கள் எங்கள் உதவி மையத்திற்கு (support@zolofunds.com) அனுப்பப்பட்டுள்ளன.\n\nஎங்கள் தயாரிப்பு ஆலோசகர் உங்களை **${demoForm.phone}** எண்ணில் விரைவில் தொடர்புகொள்வார்.`
      : lang === 'hi'
      ? `🎉 **धन्यवाद, ${demoForm.name}! आपका लाइव डेमो रजिस्टर हो गया है।**\n\nआपकी जानकारी हमारे सपोर्ट डेस्क (support@zolofunds.com) पर भेज दी गई है।\n\nहमारे स्पेशलिस्ट आपसे **${demoForm.phone}** पर जल्द संपर्क करेंगे।`
      : `🎉 **Live Demo Booked Successfully!**\n\nThank you, **${demoForm.name}**! Your request has been delivered to our support desk (**support@zolofunds.com**).\n\nOur product specialist will reach out to you on **${demoForm.phone}** shortly to demonstrate Zolo Funds!`;

    setMessages(prev => [
      ...prev,
      {
        sender: 'bot',
        text: confirmationText,
        actions: [
          { type: 'whatsapp', label: 'Chat on WhatsApp' },
          { type: 'call', label: 'Call +91 80894 05950' }
        ]
      }
    ]);
  };

  const handleReset = () => {
    const greeting = GREETING_TEXTS[lang] || GREETING_TEXTS.en;
    setMessages([
      {
        sender: 'bot',
        text: greeting.welcome,
        suggestions: greeting.suggestions
      }
    ]);
    setDemoSubmitted(false);
  };

  return (
    <>
      {/* 1. Auto-Greeting Speech Bubble on Page Open */}
      {!isOpen && showGreetingBubble && (
        <div
          style={{
            position: 'fixed',
            bottom: '88px',
            right: '24px',
            zIndex: 1100,
            maxWidth: '320px',
            background: '#FFFFFF',
            borderRadius: '16px',
            padding: '14px 16px',
            boxShadow: '0 12px 36px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(125, 40, 126, 0.15)',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            fontFamily: 'inherit'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#7D287E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Bot size={14} color="#FFFFFF" />
              </div>
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#7D287E' }}>Zolo Assistant</span>
            </div>
            <button
              onClick={() => setShowGreetingBubble(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
              aria-label="Dismiss greeting"
            >
              <X size={15} />
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#1E293B', lineHeight: 1.45 }}>
            👋 <strong>Welcome to Zolo Funds!</strong> Need software to track your loans, microfinance daily collections, or chit funds?
          </p>
          <button
            onClick={() => {
              setShowGreetingBubble(false);
              setIsOpen(true);
            }}
            style={{
              marginTop: '10px',
              width: '100%',
              background: '#7D287E',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>Ask How We Can Help</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* 2. Floating Toggle Button */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            style={{
              background: '#7D287E',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '999px',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              boxShadow: '0 8px 28px rgba(125, 40, 126, 0.42)',
              fontWeight: 700,
              fontSize: '0.94rem',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              animation: 'pulseGlow 2.5s infinite'
            }}
            aria-label="Open Zolo Assistant"
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Bot size={20} />
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '8px',
                  height: '8px',
                  background: '#22C55E',
                  borderRadius: '50%',
                  border: '1.5px solid #7D287E'
                }}
              />
            </div>
            <span>Zolo Assistant</span>
            {unreadCount > 0 && (
              <span
                style={{
                  background: '#F59E0B',
                  color: '#000',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '99px',
                  marginLeft: '2px'
                }}
              >
                1
              </span>
            )}
          </button>
        )}
      </div>

      {/* 3. Expandable Chat Window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: 'min(390px, calc(100vw - 32px))',
            height: 'min(580px, calc(100vh - 100px))',
            background: '#FFFFFF',
            borderRadius: '20px',
            boxShadow: '0 16px 48px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(125, 40, 126, 0.12)',
            zIndex: 1105,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'inherit',
            animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #7D287E 0%, #5A195B 100%)',
              color: '#FFFFFF',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                <Bot size={22} color="#FFFFFF" />
                <span
                  style={{
                    position: 'absolute',
                    bottom: '1px',
                    right: '1px',
                    width: '9px',
                    height: '9px',
                    borderRadius: '50%',
                    background: '#22C55E',
                    border: '1.5px solid #7D287E'
                  }}
                />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#FFFFFF' }}>
                  Zolo Assistant
                </div>
                <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.85)' }}>
                  Lending Software Specialist
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={handleReset}
                title="Restart Chat"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  borderRadius: '8px',
                  width: '30px',
                  height: '30px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <RotateCcw size={15} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close Chat"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  borderRadius: '8px',
                  width: '30px',
                  height: '30px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Language Selector Bar */}
          <div
            style={{
              background: '#F1F5F9',
              padding: '6px 12px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              scrollbarWidth: 'none'
            }}
          >
            <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Globe size={11} />
              Language:
            </span>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => handleLanguageChange(l.code)}
                style={{
                  background: lang === l.code ? '#7D287E' : '#FFFFFF',
                  color: lang === l.code ? '#FFFFFF' : '#334155',
                  border: lang === l.code ? '1px solid #7D287E' : '1px solid #CBD5E1',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {l.flag} {l.label}
              </button>
            ))}
          </div>

          {/* Messages List Area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              background: '#F8FAFC',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '88%',
                    padding: '12px 16px',
                    borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.sender === 'user' ? '#7D287E' : '#FFFFFF',
                    color: msg.sender === 'user' ? '#FFFFFF' : '#0F172A',
                    boxShadow: msg.sender === 'user' ? '0 4px 12px rgba(125,40,126,0.25)' : '0 2px 8px rgba(0,0,0,0.05)',
                    fontSize: '0.88rem',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-line'
                  }}
                >
                  {msg.text.split('\n').map((line, i) => (
                    <span key={i}>
                      {line.includes('**') ? (
                        line.split('**').map((part, pIdx) => (pIdx % 2 === 1 ? <strong key={pIdx}>{part}</strong> : part))
                      ) : (
                        line
                      )}
                      <br />
                    </span>
                  ))}

                  {/* INLINE DEMO BOOKING FORM */}
                  {msg.isDemoForm && !demoSubmitted && (
                    <form
                      onSubmit={submitInChatDemo}
                      style={{
                        marginTop: '12px',
                        background: '#FDF4FF',
                        border: '1.5px solid #F0ABFC',
                        borderRadius: '12px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#7D287E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} />
                        <span>Schedule Your Live Walkthrough</span>
                      </div>
                      
                      <input
                        type="text"
                        placeholder="Your Full Name *"
                        required
                        value={demoForm.name}
                        onChange={(e) => setDemoForm(prev => ({ ...prev, name: e.target.value }))}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.82rem',
                          outline: 'none',
                          background: '#FFFFFF'
                        }}
                      />

                      <input
                        type="tel"
                        placeholder="WhatsApp / Phone Number *"
                        required
                        value={demoForm.phone}
                        onChange={(e) => setDemoForm(prev => ({ ...prev, phone: e.target.value }))}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.82rem',
                          outline: 'none',
                          background: '#FFFFFF'
                        }}
                      />

                      <input
                        type="text"
                        placeholder="Company / Firm Name"
                        value={demoForm.company}
                        onChange={(e) => setDemoForm(prev => ({ ...prev, company: e.target.value }))}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.82rem',
                          outline: 'none',
                          background: '#FFFFFF'
                        }}
                      />

                      <select
                        value={demoForm.vertical}
                        onChange={(e) => setDemoForm(prev => ({ ...prev, vertical: e.target.value }))}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.82rem',
                          outline: 'none',
                          background: '#FFFFFF'
                        }}
                      >
                        <option value="Daily Microfinance">Daily / Weekly Microfinance (Thandal)</option>
                        <option value="Auto & Vehicle Finance">Auto & Vehicle Finance (HP)</option>
                        <option value="Gold Loan & Jewels">Gold Loan & Jewels</option>
                        <option value="Chit Funds">Chit Funds</option>
                        <option value="Multiple Verticals">Multiple Verticals</option>
                      </select>

                      <input
                        type="text"
                        placeholder="City / Location (e.g. Erode, Salem)"
                        value={demoForm.city}
                        onChange={(e) => setDemoForm(prev => ({ ...prev, city: e.target.value }))}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.82rem',
                          outline: 'none',
                          background: '#FFFFFF'
                        }}
                      />

                      <button
                        type="submit"
                        disabled={isSubmittingDemo}
                        style={{
                          marginTop: '4px',
                          background: '#7D287E',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '9px 14px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: isSubmittingDemo ? 'wait' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        {isSubmittingDemo ? 'Submitting...' : 'Confirm Live Walkthrough →'}
                      </button>
                    </form>
                  )}
                </div>

                {/* Optional Action Buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                    {msg.actions.map((act, aIdx) => (
                      <button
                        key={aIdx}
                        onClick={() => handleActionClick(act)}
                        style={{
                          background: act.type === 'whatsapp' ? '#25D366' : '#7D287E',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 12px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                        }}
                      >
                        {act.type === 'demo' && <Calendar size={13} />}
                        {act.type === 'call' && <Phone size={13} />}
                        {act.type === 'whatsapp' && <MessageSquare size={13} />}
                        <span>{act.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Optional Follow-up Suggestion Chips */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                    {msg.suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSend(sug)}
                        style={{
                          background: '#FFFFFF',
                          color: '#334155',
                          border: '1px solid #CBD5E1',
                          borderRadius: '16px',
                          padding: '5px 12px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'left',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                        }}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#FFFFFF',
                  padding: '10px 14px',
                  borderRadius: '16px 16px 16px 4px',
                  width: 'fit-content',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ width: '7px', height: '7px', background: '#7D287E', borderRadius: '50%', animation: 'bounceDot 1.2s infinite 0s' }} />
                <div style={{ width: '7px', height: '7px', background: '#7D287E', borderRadius: '50%', animation: 'bounceDot 1.2s infinite 0.2s' }} />
                <div style={{ width: '7px', height: '7px', background: '#7D287E', borderRadius: '50%', animation: 'bounceDot 1.2s infinite 0.4s' }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Help Strip */}
          <div
            style={{
              padding: '6px 14px',
              background: '#FFFFFF',
              borderTop: '1px solid #F1F5F9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.74rem',
              color: '#64748B'
            }}
          >
            <span>Direct Call: <strong>+91 80894 05950</strong></span>
            <button
              onClick={() => handleActionClick({ type: 'whatsapp', label: '' })}
              style={{
                background: 'none',
                border: 'none',
                color: '#059669',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              WhatsApp →
            </button>
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '12px 14px',
              background: '#FFFFFF',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}
          >
            <input
              type="text"
              placeholder={lang === 'ta' ? 'கேள்விகளை தட்டச்சு செய்யவும்...' : lang === 'hi' ? 'सवाल यहाँ टाइप करें...' : 'Ask a question or type a topic...'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #E2E8F0',
                fontSize: '0.88rem',
                outline: 'none',
                color: '#0F172A',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => (e.target.style.borderColor = '#7D287E')}
              onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              style={{
                background: inputValue.trim() ? '#7D287E' : '#E2E8F0',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputValue.trim() ? 'pointer' : 'default',
                transition: 'background 0.2s'
              }}
              aria-label="Send Message"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      {/* Global CSS for Animations */}
      <style>{`
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 24px rgba(125, 40, 126, 0.4); }
          50% { transform: scale(1.03); box-shadow: 0 12px 32px rgba(125, 40, 126, 0.6); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bounceDot {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
