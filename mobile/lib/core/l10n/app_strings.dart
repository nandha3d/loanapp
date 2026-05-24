/// L10n key -> per-language string table.
///
/// Languages: en (English), ta (Tamil), hi (Hindi), te (Telugu),
/// kn (Kannada), ml (Malayalam). English is the fallback for any
/// missing key in another language. Missing keys are not errors —
/// the system returns the key itself in dev so untranslated UI is
/// visible at a glance.
library;

enum AppLang { en, ta, hi, te, kn, ml }

extension AppLangX on AppLang {
  String get code => switch (this) {
        AppLang.en => 'en',
        AppLang.ta => 'ta',
        AppLang.hi => 'hi',
        AppLang.te => 'te',
        AppLang.kn => 'kn',
        AppLang.ml => 'ml',
      };

  /// Self-name in the language itself (for language selector).
  String get nativeName => switch (this) {
        AppLang.en => 'English',
        AppLang.ta => 'தமிழ்',
        AppLang.hi => 'हिन्दी',
        AppLang.te => 'తెలుగు',
        AppLang.kn => 'ಕನ್ನಡ',
        AppLang.ml => 'മലയാളം',
      };

  /// BCP-47 locale used for currency / date formatting fallback.
  String get formatLocale => switch (this) {
        AppLang.en => 'en_IN',
        AppLang.ta => 'ta_IN',
        AppLang.hi => 'hi_IN',
        AppLang.te => 'te_IN',
        AppLang.kn => 'kn_IN',
        AppLang.ml => 'ml_IN',
      };

  static AppLang fromCode(String? code) => switch (code) {
        'ta' => AppLang.ta,
        'hi' => AppLang.hi,
        'te' => AppLang.te,
        'kn' => AppLang.kn,
        'ml' => AppLang.ml,
        _ => AppLang.en,
      };
}

/// Core string table.
///
/// Structure: key -> { 'en': ..., 'ta': ..., 'hi': ..., 'te': ..., 'kn': ..., 'ml': ... }
const Map<String, Map<String, String>> kStrings = {
  // ── App-wide ───────────────────────────────────────────────────────────
  'app.name': {
    'en': 'LoanTrack',
    'ta': 'லோன்ட்ராக்',
    'hi': 'लोनट्रैक',
    'te': 'లోన్‌ట్రాక్',
    'kn': 'ಲೋನ್‌ಟ್ರ್ಯಾಕ್',
    'ml': 'ലോൺട്രാക്ക്',
  },
  'common.refresh': {
    'en': 'Refresh',
    'ta': 'புதுப்பி',
    'hi': 'रीफ़्रेश',
    'te': 'రిఫ్రెష్',
    'kn': 'ರಿಫ್ರೆಶ್',
    'ml': 'പുതുക്കുക',
  },
  'common.save': {
    'en': 'Save',
    'ta': 'சேமி',
    'hi': 'सहेजें',
    'te': 'సేవ్',
    'kn': 'ಉಳಿಸಿ',
    'ml': 'സേവ്',
  },
  'common.cancel': {
    'en': 'Cancel',
    'ta': 'ரத்து',
    'hi': 'रद्द',
    'te': 'రద్దు',
    'kn': 'ರದ್ದು',
    'ml': 'റദ്ദാക്കുക',
  },
  'common.close': {
    'en': 'Close',
    'ta': 'மூடு',
    'hi': 'बंद',
    'te': 'మూసివేయి',
    'kn': 'ಮುಚ್ಚಿ',
    'ml': 'അടയ്ക്കുക',
  },
  'common.search': {
    'en': 'Search',
    'ta': 'தேடு',
    'hi': 'खोजें',
    'te': 'వెతుకు',
    'kn': 'ಹುಡುಕಿ',
    'ml': 'തിരയുക',
  },
  'common.no_data': {
    'en': 'No data',
    'ta': 'தரவு இல்லை',
    'hi': 'कोई डेटा नहीं',
    'te': 'డేటా లేదు',
    'kn': 'ಡೇಟಾ ಇಲ್ಲ',
    'ml': 'ഡാറ്റ ഇല്ല',
  },
  'common.loading': {
    'en': 'Loading…',
    'ta': 'ஏற்றுகிறது…',
    'hi': 'लोड हो रहा है…',
    'te': 'లోడ్ అవుతోంది…',
    'kn': 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…',
    'ml': 'ലോഡ് ചെയ്യുന്നു…',
  },
  'common.error': {
    'en': 'Something went wrong',
    'ta': 'பிழை ஏற்பட்டது',
    'hi': 'कुछ गलत हो गया',
    'te': 'తప్పు జరిగింది',
    'kn': 'ತಪ್ಪು ಸಂಭವಿಸಿದೆ',
    'ml': 'എന്തോ പിശക് സംഭവിച്ചു',
  },
  'common.retry': {
    'en': 'Retry',
    'ta': 'மீண்டும் முயற்சி',
    'hi': 'पुनः प्रयास',
    'te': 'మళ్లీ ప్రయత్నించండి',
    'kn': 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
    'ml': 'വീണ്ടും ശ്രമിക്കുക',
  },

  // ── Nav ────────────────────────────────────────────────────────────────
  'nav.home': {
    'en': 'Home', 'ta': 'முகப்பு', 'hi': 'होम',
    'te': 'హోమ్', 'kn': 'ಮುಖಪುಟ', 'ml': 'ഹോം',
  },
  'nav.customers': {
    'en': 'Customers', 'ta': 'வாடிக்கையாளர்கள்', 'hi': 'ग्राहक',
    'te': 'వినియోగదారులు', 'kn': 'ಗ್ರಾಹಕರು', 'ml': 'ഉപഭോക്താക്കൾ',
  },
  'nav.loans': {
    'en': 'Loans', 'ta': 'கடன்கள்', 'hi': 'ऋण',
    'te': 'రుణాలు', 'kn': 'ಸಾಲಗಳು', 'ml': 'വായ്പകൾ',
  },
  'nav.collection': {
    'en': 'Collection', 'ta': 'வசூல்', 'hi': 'वसूली',
    'te': 'వసూలు', 'kn': 'ವಸೂಲಿ', 'ml': 'പിരിവ്',
  },
  'nav.more': {
    'en': 'More', 'ta': 'மேலும்', 'hi': 'अधिक',
    'te': 'మరిన్ని', 'kn': 'ಇನ್ನಷ್ಟು', 'ml': 'കൂടുതൽ',
  },

  // ── Dashboard ──────────────────────────────────────────────────────────
  'dash.title': {
    'en': 'Dashboard', 'ta': 'டாஷ்போர்டு', 'hi': 'डैशबोर्ड',
    'te': 'డాష్‌బోర్డ్', 'kn': 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', 'ml': 'ഡാഷ്ബോർഡ്',
  },
  'dash.hello': {
    'en': 'Hello', 'ta': 'வணக்கம்', 'hi': 'नमस्ते',
    'te': 'నమస్తే', 'kn': 'ನಮಸ್ಕಾರ', 'ml': 'നമസ്കാരം',
  },
  'dash.today_collected': {
    'en': "Today's Collection", 'ta': 'இன்றைய வசூல்', 'hi': 'आज की वसूली',
    'te': 'నేటి వసూలు', 'kn': 'ಇಂದಿನ ವಸೂಲಿ', 'ml': 'ഇന്നത്തെ പിരിവ്',
  },
  'dash.today_expected': {
    'en': 'Expected Today', 'ta': 'இன்று எதிர்பார்ப்பு', 'hi': 'आज अपेक्षित',
    'te': 'నేడు అంచనా', 'kn': 'ಇಂದು ನಿರೀಕ್ಷಿತ', 'ml': 'ഇന്നു പ്രതീക്ഷിക്കുന്നത്',
  },
  'dash.pending_penalties': {
    'en': 'Pending Penalties', 'ta': 'நிலுவை அபராதம்', 'hi': 'लंबित जुर्माना',
    'te': 'పెండింగ్ జరిమానా', 'kn': 'ಬಾಕಿ ದಂಡ', 'ml': 'പെൻഡിങ് പിഴ',
  },
  'dash.active_loans': {
    'en': 'Active Loans', 'ta': 'செயலில் உள்ள கடன்', 'hi': 'सक्रिय ऋण',
    'te': 'క్రియాశీల రుణాలు', 'kn': 'ಸಕ್ರಿಯ ಸಾಲ', 'ml': 'സജീവ വായ്പകൾ',
  },
  'dash.overdue_loans': {
    'en': 'Overdue Loans', 'ta': 'நிலுவை கடன்', 'hi': 'अतिदेय ऋण',
    'te': 'మించిన రుణాలు', 'kn': 'ಬಾಕಿ ಸಾಲ', 'ml': 'കാലാവധി കഴിഞ്ഞ വായ്പകൾ',
  },
  'dash.today_schedule': {
    'en': "Today's Schedule", 'ta': 'இன்றைய அட்டவணை', 'hi': 'आज का शेड्यूल',
    'te': 'నేటి షెడ్యూల్', 'kn': 'ಇಂದಿನ ವೇಳಾಪಟ್ಟಿ', 'ml': 'ഇന്നത്തെ ഷെഡ്യൂൾ',
  },
  'dash.recent_activity': {
    'en': 'Recent Activity', 'ta': 'சமீபத்திய செயல்பாடு', 'hi': 'हाल की गतिविधि',
    'te': 'ఇటీవలి కార్యకలాపం', 'kn': 'ಇತ್ತೀಚಿನ ಚಟುವಟಿಕೆ', 'ml': 'സമീപകാല പ്രവർത്തനം',
  },
  'dash.no_schedule': {
    'en': 'No collections scheduled', 'ta': 'வசூல் எதுவும் இல்லை', 'hi': 'कोई वसूली नहीं',
    'te': 'వసూలు లేదు', 'kn': 'ವಸೂಲಿ ಇಲ್ಲ', 'ml': 'പിരിവ് ഇല്ല',
  },
  'dash.no_activity': {
    'en': 'No recent activity', 'ta': 'செயல்பாடு இல்லை', 'hi': 'कोई गतिविधि नहीं',
    'te': 'కార్యకలాపం లేదు', 'kn': 'ಚಟುವಟಿಕೆ ಇಲ್ಲ', 'ml': 'പ്രവർത്തനം ഇല്ല',
  },
  'dash.net_profit': {
    'en': 'Net Profit', 'ta': 'நிகர லாபம்', 'hi': 'शुद्ध लाभ',
    'te': 'నికర లాభం', 'kn': 'ನಿವ್ವಳ ಲಾಭ', 'ml': 'അറ്റാദായം',
  },

  // ── Loan ──────────────────────────────────────────────────────────────
  'loan.details': {
    'en': 'Loan Details', 'ta': 'கடன் விவரம்', 'hi': 'ऋण विवरण',
    'te': 'రుణ వివరాలు', 'kn': 'ಸಾಲದ ವಿವರಗಳು', 'ml': 'വായ്പ വിശദാംശങ്ങൾ',
  },
  'loan.calendar_tracker': {
    'en': 'Calendar Tracker', 'ta': 'நாள்காட்டி டிராக்கர்', 'hi': 'कैलेंडर ट्रैकर',
    'te': 'క్యాలెండర్ ట్రాకర్', 'kn': 'ಕ್ಯಾಲೆಂಡರ್ ಟ್ರ್ಯಾಕರ್', 'ml': 'കലണ്ടർ ട്രാക്കർ',
  },
  'loan.principal': {
    'en': 'Principal', 'ta': 'அசல்', 'hi': 'मूलधन',
    'te': 'మూలధనం', 'kn': 'ಮೂಲಧನ', 'ml': 'മൂലധനം',
  },
  'loan.instalments': {
    'en': 'Instalments', 'ta': 'தவணைகள்', 'hi': 'किस्तें',
    'te': 'వాయిదాలు', 'kn': 'ಕಂತುಗಳು', 'ml': 'തവണകൾ',
  },
  'loan.paid': {
    'en': 'Paid', 'ta': 'செலுத்தப்பட்டது', 'hi': 'भुगतान',
    'te': 'చెల్లించబడింది', 'kn': 'ಪಾವತಿಸಲಾಗಿದೆ', 'ml': 'അടച്ചു',
  },
  'loan.partial': {
    'en': 'Partial', 'ta': 'பகுதி', 'hi': 'आंशिक',
    'te': 'పాక్షికం', 'kn': 'ಭಾಗಶಃ', 'ml': 'ഭാഗികം',
  },
  'loan.missed': {
    'en': 'Missed', 'ta': 'தவறிய', 'hi': 'चूका',
    'te': 'మిస్', 'kn': 'ತಪ್ಪಿಸಿದೆ', 'ml': 'വിട്ടുപോയി',
  },
  'loan.upcoming': {
    'en': 'Upcoming', 'ta': 'வரவிருக்கும்', 'hi': 'आगामी',
    'te': 'రాబోయే', 'kn': 'ಮುಂಬರುವ', 'ml': 'വരാനിരിക്കുന്നത്',
  },
  'loan.due': {
    'en': 'Due', 'ta': 'நிலுவை', 'hi': 'देय',
    'te': 'బకాయి', 'kn': 'ಬಾಕಿ', 'ml': 'അടയ്ക്കാനുള്ളത്',
  },
  'loan.received': {
    'en': 'Received', 'ta': 'பெறப்பட்டது', 'hi': 'प्राप्त',
    'te': 'స్వీకరించబడింది', 'kn': 'ಸ್ವೀಕರಿಸಲಾಗಿದೆ', 'ml': 'ലഭിച്ചു',
  },
  'loan.status': {
    'en': 'Status', 'ta': 'நிலை', 'hi': 'स्थिति',
    'te': 'స్థితి', 'kn': 'ಸ್ಥಿತಿ', 'ml': 'അവസ്ഥ',
  },
  'loan.repaid_pct': {
    'en': '% Repaid', 'ta': '% திரும்பப் பெறப்பட்டது', 'hi': '% चुकाया',
    'te': '% తిరిగి చెల్లించబడింది', 'kn': '% ಮರುಪಾವತಿ', 'ml': '% തിരിച്ചടച്ചു',
  },
  'loan.outstanding': {
    'en': 'Outstanding', 'ta': 'மீதி', 'hi': 'बकाया',
    'te': 'మిగిలిన', 'kn': 'ಬಾಕಿ', 'ml': 'ബാക്കി',
  },

  // ── Customer 360 ──────────────────────────────────────────────────────
  'cust.title_360': {
    'en': 'Customer 360', 'ta': 'வாடிக்கையாளர் 360', 'hi': 'ग्राहक 360',
    'te': 'వినియోగదారు 360', 'kn': 'ಗ್ರಾಹಕ 360', 'ml': 'ഉപഭോക്താവ് 360',
  },
  'cust.risk_score': {
    'en': 'Risk Score', 'ta': 'அபாய மதிப்பெண்', 'hi': 'जोखिम स्कोर',
    'te': 'రిస్క్ స్కోర్', 'kn': 'ಅಪಾಯದ ಸ್ಕೋರ್', 'ml': 'റിസ്ക് സ്കോർ',
  },
  'cust.payment_behavior': {
    'en': 'Payment Behavior', 'ta': 'கட்டண நடத்தை', 'hi': 'भुगतान व्यवहार',
    'te': 'చెల్లింపు ప్రవర్తన', 'kn': 'ಪಾವತಿ ನಡವಳಿಕೆ', 'ml': 'പേയ്മെന്റ് സ്വഭാവം',
  },
  'cust.on_time_rate': {
    'en': 'On-time Rate', 'ta': 'நேரத்தில் கட்டிய சதவீதம்', 'hi': 'समय पर भुगतान',
    'te': 'సకాలంలో చెల్లింపు', 'kn': 'ಸಮಯಕ್ಕೆ ಪಾವತಿ', 'ml': 'സമയത്ത് അടച്ച ശതമാനം',
  },
  'cust.total_borrowed': {
    'en': 'Total Borrowed', 'ta': 'மொத்த கடன்', 'hi': 'कुल उधार',
    'te': 'మొత్తం రుణం', 'kn': 'ಒಟ್ಟು ಸಾಲ', 'ml': 'മൊത്തം കടം',
  },
  'cust.total_paid': {
    'en': 'Total Repaid', 'ta': 'மொத்த திருப்பி', 'hi': 'कुल चुकाया',
    'te': 'మొత్తం తిరిగి చెల్లింపు', 'kn': 'ಒಟ್ಟು ಮರುಪಾವತಿ', 'ml': 'മൊത്തം തിരിച്ചടവ്',
  },
  'cust.profile': {
    'en': 'Profile', 'ta': 'விவரம்', 'hi': 'प्रोफ़ाइल',
    'te': 'ప్రొఫైల్', 'kn': 'ಪ್ರೊಫೈಲ್', 'ml': 'പ്രൊഫൈൽ',
  },
  'cust.loans_tab': {
    'en': 'Loans', 'ta': 'கடன்கள்', 'hi': 'ऋण',
    'te': 'రుణాలు', 'kn': 'ಸಾಲಗಳು', 'ml': 'വായ്പകൾ',
  },
  'cust.penalties_tab': {
    'en': 'Penalties', 'ta': 'அபராதம்', 'hi': 'जुर्माना',
    'te': 'జరిమానా', 'kn': 'ದಂಡ', 'ml': 'പിഴ',
  },
  'cust.timeline_tab': {
    'en': 'Timeline', 'ta': 'காலவரிசை', 'hi': 'समयरेखा',
    'te': 'కాలక్రమం', 'kn': 'ಸಮಯರೇಖೆ', 'ml': 'ടൈംലൈൻ',
  },
  'cust.call': {
    'en': 'Call', 'ta': 'அழை', 'hi': 'कॉल',
    'te': 'కాల్', 'kn': 'ಕರೆ', 'ml': 'വിളിക്കുക',
  },
  'cust.message': {
    'en': 'Message', 'ta': 'செய்தி', 'hi': 'संदेश',
    'te': 'సందేశం', 'kn': 'ಸಂದೇಶ', 'ml': 'സന്ദേശം',
  },
  'cust.directions': {
    'en': 'Directions', 'ta': 'வழிகாட்டி', 'hi': 'दिशाएं',
    'te': 'దిశలు', 'kn': 'ದಿಕ್ಕು', 'ml': 'ദിശകൾ',
  },

  // ── Collection ─────────────────────────────────────────────────────────
  'coll.title': {
    'en': 'Collection', 'ta': 'வசூல்', 'hi': 'वसूली',
    'te': 'వసూలు', 'kn': 'ವಸೂಲಿ', 'ml': 'പിരിവ്',
  },
  'coll.mark_paid': {
    'en': 'Mark Paid', 'ta': 'செலுத்தியதாக குறி', 'hi': 'भुगतान चिह्नित',
    'te': 'చెల్లించినట్లు గుర్తు', 'kn': 'ಪಾವತಿಸಲಾಗಿದೆ ಎಂದು ಗುರುತಿಸಿ', 'ml': 'അടച്ചതായി അടയാളപ്പെടുത്തുക',
  },
  'coll.amount': {
    'en': 'Amount', 'ta': 'தொகை', 'hi': 'राशि',
    'te': 'మొత్తం', 'kn': 'ಮೊತ್ತ', 'ml': 'തുക',
  },
  'coll.cash': {
    'en': 'Cash', 'ta': 'பணம்', 'hi': 'नकद',
    'te': 'నగదు', 'kn': 'ನಗದು', 'ml': 'പണം',
  },
  'coll.upi': {
    'en': 'UPI', 'ta': 'UPI', 'hi': 'UPI',
    'te': 'UPI', 'kn': 'UPI', 'ml': 'UPI',
  },
  'coll.bank': {
    'en': 'Bank', 'ta': 'வங்கி', 'hi': 'बैंक',
    'te': 'బ్యాంక్', 'kn': 'ಬ್ಯಾಂಕ್', 'ml': 'ബാങ്ക്',
  },
  'coll.confirm': {
    'en': 'Confirm', 'ta': 'உறுதி', 'hi': 'पुष्टि',
    'te': 'నిర్ధారించండి', 'kn': 'ದೃಢೀಕರಿಸಿ', 'ml': 'സ്ഥിരീകരിക്കുക',
  },
  'coll.received': {
    'en': 'Received', 'ta': 'பெறப்பட்டது', 'hi': 'प्राप्त',
    'te': 'స్వీకరించబడింది', 'kn': 'ಸ್ವೀಕರಿಸಲಾಗಿದೆ', 'ml': 'ലഭിച്ചു',
  },

  // ── Settings ──────────────────────────────────────────────────────────
  'set.title': {
    'en': 'Settings', 'ta': 'அமைப்புகள்', 'hi': 'सेटिंग्स',
    'te': 'సెట్టింగులు', 'kn': 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು', 'ml': 'ക്രമീകരണങ്ങൾ',
  },
  'set.language': {
    'en': 'Language', 'ta': 'மொழி', 'hi': 'भाषा',
    'te': 'భాష', 'kn': 'ಭಾಷೆ', 'ml': 'ഭാഷ',
  },
  'set.voice_assist': {
    'en': 'Voice Assist', 'ta': 'குரல் உதவி', 'hi': 'आवाज़ सहायता',
    'te': 'వాయిస్ సహాయం', 'kn': 'ಧ್ವನಿ ನೆರವು', 'ml': 'വോയ്സ് അസിസ്റ്റ്',
  },
  'set.voice_assist_hint': {
    'en': 'Reads names, amounts, status aloud',
    'ta': 'பெயர், தொகை, நிலையை ஒலியில் வாசிக்கும்',
    'hi': 'नाम, राशि, स्थिति बोलकर पढ़ता है',
    'te': 'పేరు, మొత్తం, స్థితిని చదువుతుంది',
    'kn': 'ಹೆಸರು, ಮೊತ್ತ, ಸ್ಥಿತಿ ಓದುತ್ತದೆ',
    'ml': 'പേര്, തുക, അവസ്ഥ ഉറക്കെ വായിക്കും',
  },
  'set.logout': {
    'en': 'Logout', 'ta': 'வெளியேறு', 'hi': 'लॉगआउट',
    'te': 'లాగౌట్', 'kn': 'ಲಾಗ್‌ಔಟ್', 'ml': 'ലോഗൗട്ട്',
  },
};
