/**
 * Localized field help tooltips (`(i)` info popovers), section headers, and dynamic
 * cadence tenure labels across all 6 supported languages:
 * `en` (English), `ta` (Tamil), `hi` (Hindi), `te` (Telugu), `kn` (Kannada), `ml` (Malayalam).
 */
import type { FrequencyConfig } from './frequency';

export type SupportedChitLang = 'en' | 'ta' | 'hi' | 'te' | 'kn' | 'ml';
type LocalizedTuple = Record<SupportedChitLang, string>;

export function resolveChitLang(lang?: string | null): SupportedChitLang {
  const c = (lang || 'en').slice(0, 2).toLowerCase();
  if (c === 'ta' || c === 'hi' || c === 'te' || c === 'kn' || c === 'ml') return c;
  return 'en';
}

const UNIT_PLURALS: Record<'day' | 'week' | 'month' | 'year' | 'fortnight' | 'cycle', LocalizedTuple> = {
  day: {
    en: 'Days',
    ta: 'நாட்கள்',
    hi: 'दिन',
    te: 'రోజులు',
    kn: 'ದಿನಗಳು',
    ml: 'ദിവസങ്ങൾ',
  },
  week: {
    en: 'Weeks',
    ta: 'வாரங்கள்',
    hi: 'सप्ताह',
    te: 'వారాలు',
    kn: 'ವಾರಗಳು',
    ml: 'ആഴ്ചകൾ',
  },
  fortnight: {
    en: 'Fortnights',
    ta: 'பக்ஷங்கள் (2 வாரங்கள்)',
    hi: 'पखवाड़े',
    te: 'పక్షాలు (2 వారాలు)',
    kn: 'ಪಕ್ಷಗಳು (2 ವಾರ)',
    ml: 'പക്ഷേണങ്ങൾ (2 ആഴ്ച)',
  },
  month: {
    en: 'Months',
    ta: 'மாதங்கள்',
    hi: 'महीने',
    te: 'నెలలు',
    kn: 'ತಿಂಗಳುಗಳು',
    ml: 'മാസങ്ങൾ',
  },
  year: {
    en: 'Years',
    ta: 'ஆண்டுகள்',
    hi: 'साल',
    te: 'సంవత్సరాలు',
    kn: 'ವರ್ಷಗಳು',
    ml: 'വർഷങ്ങൾ',
  },
  cycle: {
    en: 'Cycles',
    ta: 'சுழற்சிகள்',
    hi: 'चक्र',
    te: 'సైకిళ్లు',
    kn: 'ಸುತ್ತುಗಳು',
    ml: 'ഘട്ടങ്ങൾ',
  },
};

/**
 * Formats the auto-calculated tenure badge in the active language using `totalMembers`
 * and the selected collection frequency (e.g. `10 Months`, `10 Weeks`, `10 Days`,
 * `10 Fortnights (20 Weeks)`, or `10 Cycles (20 Months)`).
 */
export function formatChitTenure(
  totalMembers: number,
  freq: Pick<FrequencyConfig, 'unit' | 'interval'>,
  lang?: string | null,
): string {
  const l = resolveChitLang(lang);
  const count = Math.max(1, Math.round(Number(totalMembers) || 1));
  const interval = Math.max(1, Math.round(Number(freq.interval) || 1));

  if (interval === 1) {
    return `${count} ${UNIT_PLURALS[freq.unit][l]}`;
  }
  if (freq.unit === 'week' && interval === 2) {
    return `${count} ${UNIT_PLURALS.fortnight[l]} (${count * 2} ${UNIT_PLURALS.week[l]})`;
  }
  const totalUnits = count * interval;
  return `${count} ${UNIT_PLURALS.cycle[l]} (${totalUnits} ${UNIT_PLURALS[freq.unit][l]})`;
}

export type ChitFormTooltipKey =
  | 'groupName'
  | 'chitValue'
  | 'installmentAmount'
  | 'totalMembers'
  | 'tenure'
  | 'startDate'
  | 'compliance'
  | 'regulatoryTier'
  | 'scaleTier'
  | 'payoutAssetType'
  | 'engineType'
  | 'auctionMode'
  | 'biddingMode'
  | 'frequency'
  | 'customInterval'
  | 'foremen'
  | 'commissionPct'
  | 'commissionBasis'
  | 'foremanCompensation'
  | 'gstPct'
  | 'foremanTicket'
  | 'minDiscountPct'
  | 'maxDiscountPct'
  | 'bidIncrement'
  | 'bidStartAtCommission'
  | 'dividendPolicy'
  | 'dividendDistribution'
  | 'dividendRounding'
  | 'tieBreakRule'
  | 'graceDays'
  | 'lateFeeType'
  | 'lateFeeValue'
  | 'defaultConsecutiveMissed'
  | 'securityType'
  | 'securityThreshold'
  | 'roomAdmission'
  | 'bellEnabled'
  | 'winnerInterestType'
  | 'winnerInterestValue'
  | 'multiTicketMembers'
  | 'registrationNo';

export const CHIT_FORM_TOOLTIPS: Record<ChitFormTooltipKey, LocalizedTuple> = {
  groupName: {
    en: 'Unique name identifying this chit group across receipts, live rooms, and reports.',
    ta: 'ரசீதுகள், நேரடி ஏல அறை மற்றும் அறிக்கைகளில் இந்த சீட்டு குழுவை அடையாளப்படுத்தும் பெயர்.',
    hi: 'रसीदों, लाइव रूम और रिपोर्टों में इस चिट समूह की पहचान के लिए अनूठा नाम।',
    te: 'రసీదులు, లైవ్ రూమ్ మరియు రిపోర్టులలో ఈ చిట్ గ్రూప్‌ను గుర్తించే పేరు.',
    kn: 'ರಸೀದಿಗಳು, ಲೈವ್ ರೂಮ್ ಮತ್ತು ವರದಿಗಳಲ್ಲಿ ಈ ಚಿಟ್ ಗುಂಪನ್ನು ಗುರುತಿಸುವ ಹೆಸರು.',
    ml: 'രസീതുകളിലും ലൈവ് റൂമിലും റിപ്പോർട്ടുകളിലും ഈ ചിട്ടി ഗ്രൂപ്പിനെ തിരിച്ചറിയുന്ന പേര്.',
  },
  chitValue: {
    en: 'Total pot value per cycle (Total Members x Installment Amount). Changing this auto-updates Installment.',
    ta: 'ஒரு சுழற்சியின் மொத்த சீட்டு தொகை (உறுப்பினர்கள் × தவணை). இதை மாற்றினால் தவணை தானாக மாறும்.',
    hi: 'प्रत्येक चक्र की कुल चिट राशि (सदस्य × किस्त)। इसे बदलने पर किस्त अपने आप अपडेट होती है।',
    te: 'ప్రతి సైకిల్‌కు మొత్తం చిట్ విలువ (సభ్యులు × వాయిదా). దీనిని మార్చితే వాయిదా ఆటోమేటిక్‌గా మారుతుంది.',
    kn: 'ಪ್ರತಿ ಸುತ್ತಿನ ಒಟ್ಟು ಚಿಟ್ ಮೊತ್ತ (ಸದಸ್ಯರು × ಕಂತು). ಇದನ್ನು ಬದಲಿಸಿದರೆ ಕಂತು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಬದಲಾಗುತ್ತದೆ.',
    ml: 'ഓരോ ഘട്ടത്തിലെയും ആകെ ചിട്ടി തുക (അംഗങ്ങൾ × തവണ). ഇത് മാറ്റുമ്പോൾ തവണ തുക സ്വയം അപ്‌ഡേറ്റ് ആകും.',
  },
  installmentAmount: {
    en: 'Base subscription payable per full ticket per cycle (auto-calculated as Chit Value / Members).',
    ta: 'ஒரு முழு டிக்கெட்டிற்கு ஒரு சுழற்சியில் செலுத்த வேண்டிய அடிப்படை தவணை (சீட்டு தொகை ÷ உறுப்பினர்கள்).',
    hi: 'प्रत्येक पूर्ण टिकट के लिए प्रति चक्र मूल किस्त (चिट राशि ÷ सदस्य से स्वतः गणना)।',
    te: 'ఒక పూర్తి టికెట్‌కు ప్రతి సైకిల్‌లో చెల్లించాల్సిన కనీస వాయిదా (చిట్ విలువ ÷ సభ్యులు).',
    kn: 'ಪ್ರತಿ ಪೂರ್ಣ ಟಿಕೆಟ್‌ಗೆ ಪ್ರತಿ ಸುತ್ತಿನಲ್ಲಿ ಪಾವತಿಸಬೇಕಾದ ಮೂಲ ಕಂತು (ಚಿಟ್ ಮೊತ್ತ ÷ ಸದಸ್ಯರು).',
    ml: 'ഒരു പൂർണ്ണ ടിക്കറ്റിന് ഓരോ ഘട്ടത്തിലും അടയ്‌ക്കേണ്ട അടിസ്ഥാന തവണ (ചിട്ടി തുക ÷ അംഗങ്ങൾ).',
  },
  totalMembers: {
    en: 'Total ticket slots in this group. Auto-recalculates Installment and total Tenure immediately.',
    ta: 'இந்த குழுவில் உள்ள மொத்த டிக்கெட் எண்ணிக்கை. தவணை மற்றும் மொத்த கால அளவை தானாக கணக்கிடும்.',
    hi: 'इस समूह में कुल टिकट स्लॉट। यह किस्त और कुल अवधि को तुरंत स्वतः पुनर्गणना करता है।',
    te: 'ఈ గ్రూప్‌లోని మొత్తం టికెట్ సీట్లు. వాయిదా మరియు కాలపరిమితిని వెంటనే ఆటోమేటిక్‌గా లెక్కిస్తుంది.',
    kn: 'ಈ ಗುಂಪಿನಲ್ಲಿರುವ ಒಟ್ಟು ಟಿಕೆಟ್ ಸ್ಥಾನಗಳು. ಕಂತು ಮತ್ತು ಒಟ್ಟು ಅವಧಿಯನ್ನು ತಕ್ಷಣ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಲೆಕ್ಕಹಾಕುತ್ತದೆ.',
    ml: 'ഈ ഗ്രൂപ്പിലെ ആകെ ടിക്കറ്റ് സീറ്റുകൾ. തവണയും കാലാവധിയും ഉടൻ സ്വയം കണക്കാക്കും.',
  },
  tenure: {
    en: 'Auto-calculated group duration matching Total Members and selected collection frequency (Months/Weeks/Days).',
    ta: 'மொத்த உறுப்பினர்கள் மற்றும் வசூல் இடைவெளிக்கு (மாதம்/வாரம்/நாள்) ஏற்ப தானாக கணக்கிடப்பட்ட சீட்டு காலம்.',
    hi: 'कुल सदस्यों और चुनी गई आवृत्ति (महीने/सप्ताह/दिन) के आधार पर स्वतः गणना की गई कुल अवधि।',
    te: 'మొత్తం సభ్యులు మరియు సేకరణ వ్యవధి (నెలలు/వారాలు/రోజులు) ఆధారంగా ఆటోమేటిక్‌గా లెక్కించిన కాలపరిమితి.',
    kn: 'ಒಟ್ಟು ಸದಸ್ಯರು ಮತ್ತು ಆಯ್ಕೆ ಮಾಡಿದ ಸಂಗ್ರಹ ಆವರ್ತನಕ್ಕೆ (ತಿಂಗಳು/ವಾರ/ದಿನ) ಅನುಗುಣವಾಗಿ ಸ್ವಯಂಚಾಲಿತ ಅವಧಿ.',
    ml: 'ആകെ അംഗങ്ങളുടെ എണ്ണവും പിരിവ് ഇടവേളയും (മാസം/ആഴ്ച/ദിവസം) അനുസരിച്ച് സ്വയം കണക്കാക്കിയ കാലാവധി.',
  },
  startDate: {
    en: 'Date of Cycle 1 commencement; all subsequent cycle due dates are anchored to this date.',
    ta: 'முதல் சுழற்சி தொடங்கும் தேதி; அடுத்தடுத்த தவணை தேதிகள் இதிலிருந்து கணக்கிடப்படும்.',
    hi: 'पहले चक्र के प्रारंभ की तिथि; आगे की सभी देय तिथियाँ इसी से तय होती हैं।',
    te: 'మొదటి సైకిల్ ప్రారంభ తేదీ; తదుపరి గడువు తేదీలన్నీ దీని ఆధారంగా లెక్కించబడతాయి.',
    kn: 'ಮೊದಲ ಸುತ್ತು ಪ್ರಾರಂಭವಾಗುವ ದಿನಾಂಕ; ಮುಂದಿನ ಎಲ್ಲಾ ಕಂತು ದಿನಾಂಕಗಳು ಇದರಿಂದಲೇ ನಿರ್ಧಾರವಾಗುತ್ತವೆ.',
    ml: 'ഒന്നാം ഘട്ടം ആരംഭിക്കുന്ന തീയതി; തുടർന്നുള്ള തവണ തീയതികൾ ഇതിന്റെ അടിസ്ഥാനത്തിലാണ് കണക്കാക്കുന്നത്.',
  },
  compliance: {
    en: 'Unregistered for informal/private chits, or Registered for statutory Chit Funds Act 1982 workflows.',
    ta: 'தனிப்பட்ட சீட்டுக்கு பதிவு செய்யப்படாதது; 1982 சட்ட விதிகளுக்கு உட்பட்ட சீட்டுக்கு பதிவு செய்யப்பட்டது.',
    hi: 'निजी चिट के लिए अपंजीकृत, या चिट फंड अधिनियम 1982 अनुपालन के लिए पंजीकृत।',
    te: 'ప్రైవేట్ చిట్లకు నమోదు కానిది, లేదా చిట్ ఫండ్ చట్టం 1982 ప్రకారం నమోదు చేయబడినది.',
    kn: 'ಖಾಸಗಿ ಚಿಟ್‌ಗಳಿಗೆ ನೋಂದಾಯಿಸದ, ಅಥವಾ ಚಿಟ್ ಫಂಡ್ ಕಾಯ್ದೆ 1982 ರ ನಿಯಮಗಳಿಗೆ ನೋಂದಾಯಿತ.',
    ml: 'സ്വകാര്യ ചിട്ടികൾക്ക് രജിസ്റ്റർ ചെയ്യാത്തത്, അല്ലെങ്കിൽ 1982 ചിട്ടി നിയമപ്രകാരം രജിസ്റ്റർ ചെയ്തത്.',
  },
  regulatoryTier: {
    en: 'Governs compliance validation strictness (e.g. mandatory subscriber agreement verification before activation).',
    ta: 'சட்ட விதிமுறைகள் மற்றும் ஒப்பந்த சரிபார்ப்பு கண்டிப்பை இது தீர்மானிக்கிறது.',
    hi: 'अनुपालन जांच की सख्ती निर्धारित करता है (जैसे सक्रियण से पहले समझौता सत्यापन)।',
    te: 'నిబంధనల తనిఖీ స్థాయిని నిర్ణయిస్తుంది (యాక్టివేషన్ ముందు అగ్రిమెంట్ ధృవీకరణ వంటివి).',
    kn: 'ನಿಯಮ ಪಾಲನೆ ಕಠಿಣತೆಯನ್ನು ನಿರ್ಧರಿಸುತ್ತದೆ (ಉದಾ. ಸಕ್ರಿಯಗೊಳಿಸುವ ಮೊದಲು ಒಪ್ಪಂದ ಪರಿಶೀಲನೆ).',
    ml: 'നിയമപരമായ പരിശോധനയുടെ കർശനത നിർണ്ണയിക്കുന്നു (ഉദാ. ആക്ടിവേഷന് മുമ്പ് കരാർ പരിശോധന).',
  },
  scaleTier: {
    en: 'Classifies pool size tier (Household, SME Commercial, Enterprise) for analytics and caps.',
    ta: 'சீட்டு குழுவின் அளவை (குடும்பம், வணிகம், பெரிய நிறுவனம்) வகைப்படுத்துகிறது.',
    hi: 'विश्लेषण और सीमाओं के लिए चिट आकार श्रेणी (हाउसहोल्ड, कमर्शियल, एंटरप्राइज) तय करता है।',
    te: 'చిట్ స్థాయిని (గృహ, వ్యాపార, ఎంటర్‌ప్రైజ్) విశ్లేషణల కోసం వర్గీకరిస్తుంది.',
    kn: 'ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ಮಿತಿಗಳಿಗಾಗಿ ಚಿಟ್ ಗಾತ್ರದ ಶ್ರೇಣಿಯನ್ನು ವರ್ಗೀಕರಿಸುತ್ತದೆ.',
    ml: 'വിശകലനത്തിനും പരിധികൾക്കുമായി ചിട്ടി വലിപ്പ വിഭാഗം തിരിക്കുന്നു.',
  },
  payoutAssetType: {
    en: 'Settlement mode: Cash/Bank currency, Physical Gold Grams, or Festival Commodity.',
    ta: 'பரிசு வழங்கும் வகை: பணம்/வங்கி, தங்கம் கிராம், அல்லது பண்டிகை பொருள்.',
    hi: 'भुगतान प्रकार: नकद/बैंक राशि, सोना (ग्राम), या त्योहार सामग्री।',
    te: 'చెల్లింపు రకం: నగదు/బ్యాంక్, బంగారం గ్రాములు, లేదా పండుగ వస్తువు.',
    kn: 'ಪಾವತಿ ಪ್ರಕಾರ: ನಗದು/ಬ್ಯಾಂಕ್, ಚಿನ್ನದ ಗ್ರಾಂ, ಅಥವಾ ಹಬ್ಬದ ವಸ್ತು.',
    ml: 'നൽകുന്ന ആനുകൂല്യം: പണം/ബാങ്ക്, സ്വർണ്ണം (ഗ്രാം), അല്ലെങ്കിൽ ഉത്സവ സാധനങ്ങൾ.',
  },
  engineType: {
    en: 'Calculation engine governing prize payout, commission, dividend sharing, and schedule behavior.',
    ta: 'பரிசுத் தொகை, கமிஷன் மற்றும் டிவிடெண்ட் பகிர்வை கணக்கிடும் சீட்டு முறைமை.',
    hi: 'इनाम, कमीशन और लाभांश गणना को नियंत्रित करने वाला चिट इंजन मॉडल।',
    te: 'ప్రైజ్ మనీ, కమీషన్ మరియు డివిడెండ్ గణనను నియంత్రించే చిట్ ఇంజిన్ రకం.',
    kn: 'ಬಹುಮಾನ, ಕಮಿಷನ್ ಮತ್ತು ಲಾಭಾಂಶ ಲೆಕ್ಕಾಚಾರವನ್ನು ನಿಯಂತ್ರಿಸುವ ಚಿಟ್ ಮಾದರಿ.',
    ml: 'സമ്മാനത്തുക, കമ്മീഷൻ, ഡിവിഡന്റ് എന്നിവ കണക്കാക്കുന്ന ചിട്ടി എഞ്ചിൻ രീതി.',
  },
  auctionMode: {
    en: 'Choose Online (live member room) or Offline/Physical auction tracking.',
    ta: 'ஆன்லைன் (நேரடி அறை) அல்லது நேரடி/ஆஃப்லைன் ஏல முறையைத் தேர்ந்தெடுக்கவும்.',
    hi: 'ऑनलाइन (लाइव रूम) या ऑफलाइन/भौतिक नीलामी ट्रैकिंग चुनें।',
    te: 'ఆన్‌లైన్ (లైవ్ రూమ్) లేదా ఆఫ్‌లైన్/భౌతిక వేలం మోడ్‌ను ఎంచుకోండి.',
    kn: 'ಆನ್‌ಲೈನ್ (ಲೈವ್ ರೂಮ್) ಅಥವಾ ಆಫ್‌ಲೈನ್ ಹರಾಜು ವಿಧಾನವನ್ನು ಆಯ್ಕೆಮಾಡಿ.',
    ml: 'ഓൺലൈൻ (ലൈവ് റൂം) അല്ലെങ്കിൽ ഓഫ്‌ലൈൻ ലേല രീതി തിരഞ്ഞെടുക്കുക.',
  },
  biddingMode: {
    en: 'How each cycle winner is chosen: Open Manual, Open Live, Sealed Tender, Lottery Draw, or Rotation.',
    ta: 'வெற்றியாளர் தேர்ந்தெடுக்கும் முறை: கைமுறை ஏலம், நேரடி ஏலம், சீல்டு டெண்டர், குலுக்கல், அல்லது வரிசை முறை.',
    hi: 'विजेता चयन विधि: मैनुअल, लाइव बोली, सील्ड टेंडर, लॉटरी ड्रा, या फिक्स्ड रोटेशन।',
    te: 'విజేత ఎంపిక విధానం: మాన్యువల్, లైవ్ బిడ్డింగ్, సీల్డ్ టెండర్, లాటరీ డ్రా, లేదా రొటేషన్.',
    kn: 'ವಿಜೇತರ ಆಯ್ಕೆ ವಿಧಾನ: ಮ್ಯಾನುಯಲ್, ಲೈವ್ ಬಿಡ್, ಸೀಲ್ಡ್ ಟೆಂಡರ್, ಲಾಟರಿ, ಅಥವಾ ಸರದಿ.',
    ml: 'വിജയിയെ തിരഞ്ഞെടുക്കുന്ന രീതി: മാനുവൽ, ലൈവ് ലേലം, സീൽഡ് ടെൻഡർ, നറുക്കെടുപ്പ്, അല്ലെങ്കിൽ ക്രമം.',
  },
  frequency: {
    en: 'How often members pay and auctions occur. Directly updates the Tenure badge above.',
    ta: 'தவணை மற்றும் ஏலம் நடைபெறும் கால இடைவெளி. இது மேலே உள்ள மொத்த கால அளவை உடனே மாற்றும்.',
    hi: 'सदस्य कितनी बार भुगतान करते हैं और नीलामी होती है। यह ऊपर कुल अवधि को तुरंत अपडेट करता है।',
    te: 'సభ్యులు చెల్లించే మరియు వేలం జరిగే వ్యవధి. పైన ఉన్న కాలపరిమితిని వెంటనే అప్‌డేట్ చేస్తుంది.',
    kn: 'ಸದಸ್ಯರು ಪಾವತಿಸುವ ಮತ್ತು ಹರಾಜು ನಡೆಯುವ ಆವರ್ತನ. ಮೇಲಿನ ಅವಧಿಯನ್ನು ತಕ್ಷಣ ಬದಲಿಸುತ್ತದೆ.',
    ml: 'തവണ അടയ്ക്കുന്നതും ലേലം നടക്കുന്നതുമായ ഇടവേള. ഇത് മുകളിലെ കാലാവധി ഉടൻ അപ്‌ഡേറ്റ് ചെയ്യും.',
  },
  customInterval: {
    en: 'Configure exact interval step and unit (e.g. every 10 days or every 2 weeks) and optional weekdays.',
    ta: 'சரியான இடைவெளி எண் மற்றும் அலகை (எ.கா. 10 நாட்களுக்கு ஒருமுறை) அமைக்கவும்.',
    hi: 'सटीक अंतराल और इकाई सेट करें (जैसे हर 10 दिन या हर 2 सप्ताह)।',
    te: 'ఖచ్చితమైన వ్యవధి సంఖ్య మరియు యూనిట్‌ను (ఉదా. ప్రతి 10 రోజులకు) సెట్ చేయండి.',
    kn: 'ನಿಖರವಾದ ಅಂತರ ಮತ್ತು ಘಟಕವನ್ನು (ಉದಾ. ಪ್ರತಿ 10 ದಿನಕ್ಕೆ) ಹೊಂದಿಸಿ.',
    ml: 'കൃത്യമായ ഇടവേളയും യൂണിറ്റും (ഉദാ. ഓരോ 10 ദിവസത്തിലും) ക്രമീകരിക്കുക.',
  },
  foremen: {
    en: 'Assign 1 or more Foreman / Co-Foreman staff logins to manage this chit group in their portal.',
    ta: 'இந்த சீட்டு குழுவை நிர்வகிக்க 1 அல்லது அதற்கு மேற்பட்ட போர்மேன் / ஊழியர்களை நியமிக்கவும்.',
    hi: 'इस चिट समूह को उनके पोर्टल से प्रबंधित करने के लिए 1 या अधिक फोरमैन / स्टाफ लॉगिन असाइन करें।',
    te: 'ఈ చిట్ గ్రూప్‌ను నిర్వహించడానికి 1 లేదా అంతకంటే ఎక్కువ ఫోర్‌మ్యాన్ / సిబ్బందిని కేటాయించండి.',
    kn: 'ಈ ಚಿಟ್ ಗುಂಪನ್ನು ನಿರ್ವಹಿಸಲು 1 ಅಥವಾ ಹೆಚ್ಚು ಫೋರ್‌ಮ್ಯಾನ್ / ಸಿಬ್ಬಂದಿಯನ್ನು ನಿಯೋಜಿಸಿ.',
    ml: 'ഈ ചിട്ടി ഗ്രൂപ്പ് നിയന്ത്രിക്കാൻ ഒന്നോ അതിലധികമോ ഫോർമാൻ / സ്റ്റാഫുകളെ നിയമിക്കുക.',
  },
  commissionPct: {
    en: 'Percentage fee earned by the foreman per auction cycle (up to statutory cap).',
    ta: 'ஒவ்வொரு ஏல சுழற்சியிலும் போர்மேனுக்கு கிடைக்கும் கமிஷன் சதவீதம்.',
    hi: 'प्रत्येक नीलामी चक्र में फोरमैन द्वारा अर्जित कमीशन प्रतिशत।',
    te: 'ప్రతి వేలం సైకిల్‌లో ఫోర్‌మ్యాన్‌కు లభించే కమీషన్ శాతం.',
    kn: 'ಪ್ರತಿ ಹರಾಜು ಸುತ್ತಿನಲ್ಲಿ ಫೋರ್‌ಮ್ಯಾನ್ ಪಡೆಯುವ ಕಮಿಷನ್ ಶೇಕಡಾವಾರು.',
    ml: 'ഓരോ ലേല ഘട്ടത്തിലും ഫോർമാന് ലഭിക്കുന്ന കമ്മീഷൻ ശതമാനം.',
  },
  commissionBasis: {
    en: 'Calculate commission % on Total Chit Value (statutory) or on Winning Bid Discount.',
    ta: 'கமிஷன் சதவீதத்தை மொத்த சீட்டு தொகையில் கணக்கிடவா அல்லது ஏல தள்ளுபடி தொகையில் கணக்கிடவா.',
    hi: 'कमीशन की गणना कुल चिट राशि पर करनी है या विजयी बोली छूट पर।',
    te: 'కమీషన్‌ను మొత్తం చిట్ విలువపై లెక్కించాలా లేక బిడ్ డిస్కౌంట్‌పై లెక్కించాలా.',
    kn: 'ಕಮಿಷನ್ ಅನ್ನು ಒಟ್ಟು ಚಿಟ್ ಮೊತ್ತದ ಮೇಲೆ ಅಥವಾ ಬಿಡ್ ರಿಯಾಯಿತಿಯ ಮೇಲೆ ಲೆಕ್ಕಹಾಕಿ.',
    ml: 'കമ്മീഷൻ ആകെ ചിട്ടി തുകയിലാണോ ലേല കിഴിവിലാണോ കണക്കാക്കേണ്ടത്.',
  },
  foremanCompensation: {
    en: 'Use percentage commission, fixed flat fee per cycle, or a hybrid structure.',
    ta: 'சதவீத கமிஷன், நிலையான கட்டணம், அல்லது இரண்டின் கலவையைத் தேர்வு செய்யவும்.',
    hi: 'प्रतिशत कमीशन, प्रति चक्र निश्चित शुल्क, या हाइब्रिड संरचना चुनें।',
    te: 'శాతం కమీషన్, స్థిర రుసుము, లేదా హైబ్రిడ్ పద్ధతిని ఎంచుకోండి.',
    kn: 'ಶೇಕಡಾ ಕಮಿಷನ್, ನಿಗದಿತ ಶುಲ್ಕ, ಅಥವಾ ಹೈಬ್ರಿಡ್ ವಿಧಾನವನ್ನು ಆಯ್ಕೆಮಾಡಿ.',
    ml: 'ശതമാന കമ്മീഷൻ, സ്ഥിര ഫീസ്, അല്ലെങ്കിൽ ഹൈബ്രിഡ് രീതി തിരഞ്ഞെടുക്കുക.',
  },
  gstPct: {
    en: 'Optional GST rate applied strictly on the foreman commission amount (e.g. 18%).',
    ta: 'போர்மேன் கமிஷன் தொகைக்கு மட்டும் விதிக்கப்படும் விருப்ப ஜிஎஸ்டி வரி விகிதம்.',
    hi: 'केवल फोरमैन कमीशन राशि पर लागू होने वाली वैकल्पिक जीएसटी दर (जैसे 18%)।',
    te: 'ఫోర్‌మ్యాన్ కమీషన్ మొత్తంపై మాత్రమే వర్తించే ఐచ్ఛిక GST రేటు.',
    kn: 'ಫೋರ್‌ಮ್ಯಾನ್ ಕಮಿಷನ್ ಮೊತ್ತದ ಮೇಲೆ ಮಾತ್ರ ಅನ್ವಯಿಸುವ ಐಚ್ಛಿಕ GST ದರ.',
    ml: 'ഫോർമാൻ കമ്മീഷൻ തുകയിൽ മാത്രം ബാധകമാകുന്ന ജിഎസ്ടി നിരക്ക്.',
  },
  foremanTicket: {
    en: 'When enabled, Period-1 prize goes directly to the Foreman company ticket without bidding.',
    ta: 'இதை இயக்கினால், முதல் மாதப் பரிசு ஏலமின்றி போர்மேன் டிக்கெட்டிற்கு செல்லும்.',
    hi: 'सक्षम होने पर, पहले चक्र का इनाम बिना बोली के फोरमैन कंपनी टिकट को जाता है।',
    te: 'దీనిని ఆన్ చేస్తే, మొదటి సైకిల్ ప్రైజ్ వేలం లేకుండా ఫోర్‌మ్యాన్ టికెట్‌కు వెళ్తుంది.',
    kn: 'ಇದನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿದರೆ, ಮೊದಲ ಸುತ್ತಿನ ಬಹುಮಾನವು ಬಿಡ್ ಇಲ್ಲದೆ ಫೋರ್‌ಮ್ಯಾನ್ ಟಿಕೆಟ್‌ಗೆ ಹೋಗುತ್ತದೆ.',
    ml: 'ഇത് ഓൺ ആക്കിയാൽ ഒന്നാം ഘട്ടത്തിലെ തുക ലേലമില്ലാതെ ഫോർമാൻ ടിക്കറ്റിന് ലഭിക്കും.',
  },
  minDiscountPct: {
    en: 'Minimum bid discount % required to enter an auction bid.',
    ta: 'ஏலத்தில் பங்கேற்க தேவையான குறைந்தபட்ச தள்ளுபடி சதவீதம்.',
    hi: 'नीलामी बोली लगाने के लिए आवश्यक न्यूनतम छूट प्रतिशत।',
    te: 'వేలంలో పాల్గొనడానికి కావలసిన కనీస డిస్కౌంట్ శాతం.',
    kn: 'ಹರಾಜು ಬಿಡ್ ಮಾಡಲು ಬೇಕಾದ ಕನಿಷ್ಠ ರಿಯಾಯಿತಿ ಶೇಕಡಾ.',
    ml: 'ലേലത്തിൽ വിളിക്കാൻ വേണ്ട കുറഞ്ഞ കിഴിവ് ശതമാനം.',
  },
  maxDiscountPct: {
    en: 'Maximum allowed bid discount % (e.g. 40% ceiling under Chit Funds Act). Leave blank if uncapped.',
    ta: 'அதிகபட்ச அனுமதிக்கப்பட்ட ஏல தள்ளுபடி சதவீதம் (உதாரணம் 40%). வரம்பு இல்லையெனில் காலியாக விடவும்.',
    hi: 'अधिकतम अनुमत बोली छूट प्रतिशत (जैसे 40% सीमा)। असीमित के लिए खाली छोड़ें।',
    te: 'గరిష్ట అనుమతించబడిన బిడ్ డిస్కౌంట్ శాతం (ఉదా. 40%). పరిమితి లేకపోతే ఖాళీగా ఉంచండి.',
    kn: 'ಗರಿಷ್ಠ ಅನುಮತಿಸಲಾದ ಬಿಡ್ ರಿಯಾಯಿತಿ ಶೇಕಡಾ (ಉದಾ. 40%). ಮಿತಿ ಇಲ್ಲದಿದ್ದರೆ ಖಾಲಿ ಬಿಡಿ.',
    ml: 'അനുവദനീയമായ പരമാവധി ലേല കിഴിവ് ശതമാനം (ഉദാ. 40%). പരിധി ഇല്ലെങ്കിൽ ശൂന്യമായി വിടുക.',
  },
  bidIncrement: {
    en: 'Minimum step amount between consecutive bids in the live auction room.',
    ta: 'நேரடி ஏல அறையில் அடுத்தடுத்த ஏலங்களுக்கு இடையேயான குறைந்தபட்ச உயர்வுத் தொகை.',
    hi: 'लाइव नीलामी कक्ष में लगातार बोलियों के बीच न्यूनतम वृद्धि राशि।',
    te: 'లైవ్ వేలం గదిలో వరుస బిడ్ల మధ్య ఉండాల్సిన కనీస పెంపు మొత్తం.',
    kn: 'ಲೈವ್ ಹರಾಜು ಕೋಣೆಯಲ್ಲಿ ಸತತ ಬಿಡ್‌ಗಳ ನಡುವಿನ ಕನಿಷ್ಠ ಹೆಚ್ಚಳ ಮೊತ್ತ.',
    ml: 'ലൈവ് ലേല മുറിയിൽ തുടർച്ചയായ വിളികൾക്കിടയിലുള്ള കുറഞ്ഞ വർദ്ധനവ് തുക.',
  },
  bidStartAtCommission: {
    en: 'Start opening floor bid discount at the Foreman Commission % automatically.',
    ta: 'தொடக்க ஏல தள்ளுபடியை போர்மேன் கமிஷன் சதவீதத்திலிருந்து தானாக தொடங்கவும்.',
    hi: 'शुरुआती बोली छूट को फोरमैन कमीशन % से स्वतः प्रारंभ करें।',
    te: 'ప్రారంభ బిడ్ డిస్కౌంట్‌ను ఫోర్‌మ్యాన్ కమీషన్ % నుండి ఆటోమేటిక్‌గా ప్రారంభించండి.',
    kn: 'ಆರಂಭಿಕ ಬಿಡ್ ರಿಯಾಯಿತಿಯನ್ನು ಫೋರ್‌ಮ್ಯಾನ್ ಕಮಿಷನ್ % ನಿಂದ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಪ್ರಾರಂಭಿಸಿ.',
    ml: 'പ്രാരംഭ ലേല കിഴിവ് ഫോർമാൻ കമ്മീഷൻ ശതമാനത്തിൽ നിന്ന് സ്വയം ആരംഭിക്കുക.',
  },
  dividendPolicy: {
    en: 'Who receives the distributable dividend: All Members, Non-Prized Only, or Non-Winners.',
    ta: 'டிவிடெண்ட் யாருக்கு பகிரப்படும்: அனைத்து உறுப்பினர்கள், அல்லது சீட்டு எடுக்காதவர்களுக்கு மட்டும்.',
    hi: 'लाभांश किसे मिलेगा: सभी सदस्यों को, केवल गैर-विजेता सदस्यों को, या कोई नहीं।',
    te: 'డివిడెండ్ ఎవరికి పంచబడుతుంది: సభ్యులందరికీ, లేదా ప్రైజ్ తీసుకోని వారికి మాత్రమే.',
    kn: 'ಲಾಭಾಂಶ ಯಾರಿಗೆ ಹಂಚಲಾಗುತ್ತದೆ: ಎಲ್ಲಾ ಸದಸ್ಯರಿಗೆ, ಅಥವಾ ಬಹುಮಾನ ಪಡೆಯದವರಿಗೆ ಮಾತ್ರ.',
    ml: 'ഡിവിഡന്റ് ആർക്ക് ലഭിക്കും: എല്ലാ അംഗങ്ങൾക്കും, അല്ലെങ്കിൽ സമ്മാനം ലഭിക്കാത്തവർക്ക് മാത്രം.',
  },
  dividendDistribution: {
    en: 'How dividend is settled: reduces next due automatically, cash payout, or accumulated to maturity.',
    ta: 'டிவிடெண்ட் எவ்வாறு வழங்கப்படும்: அடுத்த தவணையில் கழித்தல், ரொக்கம், அல்லது இறுதியில் சேமிப்பு.',
    hi: 'लाभांश कैसे दिया जाए: अगली किस्त में समायोजित, नकद भुगतान, या परिपक्वता पर संचय।',
    te: 'డివిడెండ్ ఎలా అందించబడుతుంది: తదుపరి వాయిదాలో తగ్గింపు, నగదు, లేదా చివరిలో జమ.',
    kn: 'ಲಾಭಾಂಶ ಹೇಗೆ ನೀಡಲಾಗುತ್ತದೆ: ಮುಂದಿನ ಕಂತಿನಲ್ಲಿ ಕಡಿತ, ನಗದು, ಅಥವಾ ಅಂತ್ಯದಲ್ಲಿ ಸಂಚಯ.',
    ml: 'ഡിവിഡന്റ് നൽകുന്ന രീതി: അടുത്ത തവണയിൽ കുറയ്ക്കൽ, പണം, അല്ലെങ്കിൽ അവസാനം ഒരുമിച്ച് നൽകൽ.',
  },
  dividendRounding: {
    en: 'Round per-ticket dividend to nearest ₹1, ₹5, ₹10 etc. (remainder goes to rounding income).',
    ta: 'ஒரு டிக்கெட்டிற்கான டிவிடெண்டை ₹1, ₹5, ₹10 என முழுமையாக்கவும்.',
    hi: 'प्रति टिकट लाभांश को निकटतम ₹1, ₹5, ₹10 तक राउंड करें।',
    te: 'ప్రతి టికెట్ డివిడెండ్‌ను దగ్గరలోని ₹1, ₹5, ₹10కి రౌండ్ చేయండి.',
    kn: 'ಪ್ರತಿ ಟಿಕೆಟ್ ಲಾಭಾಂಶವನ್ನು ಹತ್ತಿರದ ₹1, ₹5, ₹10 ಕ್ಕೆ ರೌಂಡ್ ಮಾಡಿ.',
    ml: 'ഓരോ ടിക്കറ്റിന്റെയും ഡിവിഡന്റ് ₹1, ₹5, ₹10 എന്നിങ്ങനെ റൗണ്ട് ചെയ്യുക.',
  },
  tieBreakRule: {
    en: 'Method to resolve identical top bids: Earliest Bid, Lottery Draw among tied, or Foreman Pick.',
    ta: 'இரண்டு ஏலங்கள் சமமாக இருந்தால் தீர்க்கும் முறை: முதல் ஏலம், குலுக்கல், அல்லது போர்மேன் தேர்வு.',
    hi: 'समान उच्चतम बोली पर निर्णय विधि: पहली बोली, टाई-ब्रेक लॉटरी, या फोरमैन चयन।',
    te: 'సమాన గరిష్ట బిడ్‌లు వచ్చినప్పుడు విజేత నిర్ణయ విధానం: మొదటి బిడ్, లాటరీ, లేదా ఫోర్‌మ్యాన్ ఎంపిక.',
    kn: 'ಸಮಾನ ಗರಿಷ್ಠ ಬಿಡ್‌ಗಳಾದಾಗ ನಿರ್ಧಾರ ವಿಧಾನ: ಮೊದಲ ಬಿಡ್, ಲಾಟರಿ, ಅಥವಾ ಫೋರ್‌ಮ್ಯಾನ್ ಆಯ್ಕೆ.',
    ml: 'ഒരേ തുകയ്ക്ക് ഒന്നിലധികം പേർ വിളിച്ചാൽ തീരുമാനിക്കുന്ന രീതി: ആദ്യ വിളി, നറുക്കെടുപ്പ്, അല്ലെങ്കിൽ ഫോർമാൻ.',
  },
  graceDays: {
    en: 'Grace days allowed after period due date before late fees apply.',
    ta: 'தவணை தேதிக்குப் பிறகு அபராதம் இல்லாமல் பணம் கட்ட அனுமதிக்கப்படும் சலுகை நாட்கள்.',
    hi: 'विलंब शुल्क लगने से पहले नियत तिथि के बाद अनुमत छूट के दिन।',
    te: 'లేట్ ఫీజు వర్తించే ముందు గడువు తేదీ తర్వాత అనుమతించే గ్రేస్ రోజులు.',
    kn: 'ದಂಡ ವಿಧಿಸುವ ಮೊದಲು ಕೊನೆಯ ದಿನಾಂಕದ ನಂತರ ನೀಡಲಾಗುವ ರಿಯಾಯಿತಿ ದಿನಗಳು.',
    ml: 'പിഴ ഈടാക്കുന്നതിന് മുമ്പ് അവസാന തീയതിക്ക് ശേഷം അനുവദിക്കുന്ന ഇളവ് ദിവസങ്ങൾ.',
  },
  lateFeeType: {
    en: 'Configure whether late payment fee is None, Fixed ₹ per period, or % of overdue due.',
    ta: 'தாமதக் கட்டணம் வகை: இல்லை, நிலையான தொகை (₹), அல்லது பாக்கித் தொகையில் சதவீதம்.',
    hi: 'विलंब शुल्क प्रकार चुनें: कोई नहीं, निश्चित ₹, या बकाया का प्रतिशत।',
    te: 'లేట్ ఫీజు రకం: ఏదీ లేదు, స్థిర మొత్తం (₹), లేదా బకాయి శాతం.',
    kn: 'ತಡ ಶುಲ್ಕದ ಪ್ರಕಾರ: ಯಾವುದೂ ಇಲ್ಲ, ನಿಗದಿತ ₹, ಅಥವಾ ಬಾಕಿ ಮೊತ್ತದ ಶೇಕಡಾ.',
    ml: 'വൈകിയ ഫീസ് രീതി: ഇല്ല, നിശ്ചിത തുക (₹), അല്ലെങ്കിൽ കുടിശ്ശികയുടെ ശതമാനം.',
  },
  lateFeeValue: {
    en: 'Amount (in ₹) or % charged when an installment misses the grace window.',
    ta: 'சலுகை நாட்கள் முடிந்த பிறகு விதிக்கப்படும் தாமதக் கட்டணத் தொகை அல்லது சதவீதம்.',
    hi: 'छूट अवधि बीतने पर लगने वाली विलंब शुल्क राशि या प्रतिशत।',
    te: 'గ్రేస్ గడువు దాటిన తర్వాత విధించే లేట్ ఫీజు మొత్తం లేదా శాతం.',
    kn: 'ರಿಯಾಯಿತಿ ಅವಧಿ ಮೀರಿದಾಗ ವಿಧಿಸುವ ತಡ ಶುಲ್ಕದ ಮೊತ್ತ ಅಥವಾ ಶೇಕಡಾ.',
    ml: 'ഇളവ് സമയം കഴിഞ്ഞാൽ ഈടാക്കുന്ന വൈകിയ ഫീസ് തുക അല്ലെങ്കിൽ ശതമാനം.',
  },
  defaultConsecutiveMissed: {
    en: 'Consecutive missed periods after which an unprized member ticket is flagged for substitution/default.',
    ta: 'தொடர்ந்து எத்தனை தவணைகள் தவறினால் உறுப்பினர் டிக்கெட்டை மாற்ற/நீக்க குறிக்க வேண்டும்.',
    hi: 'लगातार कितनी किस्तें छूटने पर सदस्य टिकट को डिफ़ॉल्ट/प्रतिस्थापन के लिए चिह्नित किया जाए।',
    te: 'వరుసగా ఎన్ని వాయిదాలు తప్పితే సభ్యుని టికెట్‌ను డిఫాల్ట్/బదిలీగా గుర్తించాలి.',
    kn: 'ಸತತ ಎಷ್ಟು ಕಂತುಗಳು ತಪ್ಪಿದರೆ ಸದಸ್ಯರ ಟಿಕೆಟ್ ಅನ್ನು ಡಿಫಾಲ್ಟ್ ಎಂದು ಗುರುತಿಸಬೇಕು.',
    ml: 'തുടർച്ചയായി എത്ര തവണ മുടങ്ങിയാൽ ടിക്കറ്റ് ഡിഫോൾട്ടായി അടയാളപ്പെടുത്തണം.',
  },
  securityType: {
    en: 'Required collateral/guarantor type from a prized winner before prize payout release.',
    ta: 'பரிசுத் தொகை வழங்குவதற்கு முன் வெற்றியாளரிடம் பெற வேண்டிய ஜாமீன் / பிணை வகை.',
    hi: 'इनाम भुगतान जारी करने से पहले विजेता से आवश्यक जमानत/गारंटर प्रकार।',
    te: 'ప్రైజ్ మనీ విడుదల చేయడానికి ముందు విజేత నుండి కావాల్సిన హామీ/గ్యారెంటీ రకం.',
    kn: 'ಬಹುಮಾನ ಬಿಡುಗಡೆ ಮಾಡುವ ಮೊದಲು ವಿಜೇತರಿಂದ ಬೇಕಾದ ಭದ್ರತೆ/ಜಾಮೀನು ಪ್ರಕಾರ.',
    ml: 'സമ്മാനത്തുക നൽകുന്നതിന് മുമ്പ് വിജയിയിൽ നിന്ന് വേണ്ട ജാമ്യം / ഗ്യാരന്റി രീതി.',
  },
  securityThreshold: {
    en: 'Future liability threshold % requiring extra collateral before releasing prize money.',
    ta: 'எதிர்கால தவணைப் பொறுப்பு எவ்வளவு % தாண்டும்போது கூடுதல் பிணை தேவைப்படும்.',
    hi: 'भविष्य की देनदारी का वह % जिसके बाद इनाम से पहले अतिरिक्त सुरक्षा आवश्यक होगी।',
    te: 'భవిష్యత్ బాధ్యత ఎంత % దాటితే ప్రైజ్ మనీ ముందు అదనపు హామీ అవసరం.',
    kn: 'ಭವಿಷ್ಯದ ಬಾಧ್ಯತೆ ಎಷ್ಟು % ದಾಟಿದರೆ ಬಹುಮಾನಕ್ಕೂ ಮೊದಲು ಹೆಚ್ಚುವರಿ ಭದ್ರತೆ ಬೇಕಾಗುತ್ತದೆ.',
    ml: 'ഭാവി ബാധ്യത എത്ര % കടന്നാൽ സമ്മാനത്തുകയ്ക്ക് മുമ്പ് അധിക ജാമ്യം വേണം.',
  },
  roomAdmission: {
    en: 'Auto Admit lets all group members join the live auction room immediately; Foreman Approval puts joiners in a waiting queue.',
    ta: 'தானியங்கி அனுமதி அல்லது போர்மேன் அனுமதிக்குப் பிறகு நேரடி ஏல அறையில் இணைய அனுமதிக்கவும்.',
    hi: 'ऑटो एडमिट सभी सदस्यों को तुरंत रूम में आने देता है; फोरमैन अप्रूवल में वेटिंग कतार होती है।',
    te: 'ఆటో అడ్మిట్ అందరినీ వెంటనే అనుమతిస్తుంది; ఫోర్‌మ్యాన్ అప్రూవల్‌లో వెయిటింగ్ క్యూ ఉంటుంది.',
    kn: 'ಆಟೋ ಅಡ್ಮಿಟ್ ಎಲ್ಲರಿಗೂ ತಕ್ಷಣ ಪ್ರವೇಶ ನೀಡುತ್ತದೆ; ಫೋರ್‌ಮ್ಯಾನ್ ಅನುಮೋದನೆಯಲ್ಲಿ ಕಾಯುವ ಸರದಿ ಇರುತ್ತದೆ.',
    ml: 'ഓട്ടോ അഡ്മിറ്റ് ഉടൻ പ്രവേശനം നൽകുന്നു; ഫോർമാൻ അപ്രൂവലിൽ വെയിറ്റിംഗ് ക്യൂ ഉണ്ടാകും.',
  },
  bellEnabled: {
    en: 'Three-bell countdown timer auto-seals live room auction if no higher bid is placed in time.',
    ta: '3-மணி நேரக்கணிப்பு: குறிப்பிட்ட நேரத்திற்குள் அதிக ஏலம் வராவிட்டால் ஏலம் தானாக முடிவடையும்.',
    hi: '3-घंटी टाइमर: समय पर ऊँची बोली न आने पर लाइव नीलामी अपने आप बंद हो जाती है।',
    te: '3-బెల్ టైమర్: సమయానికి ఎక్కువ బిడ్ రాకపోతే లైవ్ వేలం ఆటోమేటిక్‌గా ముగుస్తుంది.',
    kn: '3-ಗಂಟೆ ಟೈಮರ್: ಸಮಯದಲ್ಲಿ ಹೆಚ್ಚಿನ ಬಿಡ್ ಬರದಿದ್ದರೆ ಲೈವ್ ಹರಾಜು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಮುಕ್ತಾಯವಾಗುತ್ತದೆ.',
    ml: '3-ബെൽ ടൈമർ: സമയത്തിനുള്ളിൽ ഉയർന്ന വിളി വന്നില്ലെങ്കിൽ ലൈവ് ലേലം സ്വയം അവസാനിക്കും.',
  },
  winnerInterestType: {
    en: 'Extra fixed amount or % interest added to prized members’ future installments.',
    ta: 'பரிசு வென்ற உறுப்பினர்களின் அடுத்த தவணைகளில் சேர்க்கப்படும் கூடுதல் வட்டி அல்லது தொகை.',
    hi: 'विजेता सदस्यों की आगामी किस्तों में जोड़ा जाने वाला अतिरिक्त निश्चित शुल्क या % ब्याज।',
    te: 'ప్రైజ్ గెలుచుకున్న సభ్యుల భవిష్యత్ వాయిదాలకు జోడించే అదనపు స్థిర మొత్తం లేదా % వడ్డీ.',
    kn: 'ಬಹುಮಾನ ಪಡೆದ ಸದಸ್ಯರ ಮುಂದಿನ ಕಂತುಗಳಿಗೆ ಸೇರಿಸುವ ಹೆಚ್ಚುವರಿ ನಿಗದಿತ ಮೊತ್ತ ಅಥವಾ % ಬಡ್ಡಿ.',
    ml: 'സമ്മാനം നേടിയ അംഗങ്ങളുടെ തുടർന്നുള്ള തവണകളിൽ ചേർക്കുന്ന അധിക തുക അല്ലെങ്കിൽ % പലിശ.',
  },
  winnerInterestValue: {
    en: 'Amount (₹) or % rate applied for each configured post-win cycle.',
    ta: 'வெற்றிக்குப் பின் ஒவ்வொரு சுழற்சியிலும் வசூலிக்கப்படும் கூடுதல் தொகை (₹) அல்லது %.',
    hi: 'जीत के बाद प्रत्येक चक्र में लागू होने वाली राशि (₹) या % दर।',
    te: 'గెలుపు తర్వాత ప్రతి సైకిల్‌లో వర్తించే మొత్తం (₹) లేదా % రేటు.',
    kn: 'ಗೆಲುವಿನ ನಂತರ ಪ್ರತಿ ಸುತ್ತಿನಲ್ಲಿ ಅನ್ವಯವಾಗುವ ಮೊತ್ತ (₹) ಅಥವಾ % ದರ.',
    ml: 'വിജയത്തിന് ശേഷം ഓരോ ഘട്ടത്തിലും ബാധകമാകുന്ന തുക (₹) അല്ലെങ്കിൽ % നിരക്ക്.',
  },
  multiTicketMembers: {
    en: 'One customer can hold multiple tickets in the same chit group. Pick a customer, set ticket quantity, and click Add (or +1 Ticket anytime).',
    ta: 'ஒரே வாடிக்கையாளர் ஒரே சீட்டு குழுவில் பல டிக்கெட்டுகளை எடுக்கலாம். எண்ணிக்கையைத் தேர்ந்தெடுத்து சேர்க்கவும்.',
    hi: 'एक ही ग्राहक एक चिट समूह में कई टिकट ले सकता है। ग्राहक चुनें, टिकट संख्या दर्ज करें और जोड़ें।',
    te: 'ఒకే కస్టమర్ ఒకే చిట్ గ్రూప్‌లో అనేక టికెట్లు తీసుకోవచ్చు. కస్టమర్‌ను ఎంచుకుని టికెట్ల సంఖ్యను జోడించండి.',
    kn: 'ಒಬ್ಬ ಗ್ರಾಹಕರು ಒಂದೇ ಚಿಟ್ ಗುಂಪಿನಲ್ಲಿ ಹಲವು ಟಿಕೆಟ್‌ಗಳನ್ನು ಹೊಂದಬಹುದು. ಗ್ರಾಹಕರನ್ನು ಆರಿಸಿ ಸಂಖ್ಯೆ ಸೇರಿಸಿ.',
    ml: 'ഒരു ഉപഭോക്താവിന് ഒരേ ചിട്ടി ഗ്രൂപ്പിൽ ഒന്നിലധികം ടിക്കറ്റുകൾ എടുക്കാം. എണ്ണം നൽകി ചേർക്കുക.',
  },
  registrationNo: {
    en: 'Registrar of Chits PSO/Registration number for registered Act 1982 chit groups.',
    ta: 'பதிவு செய்யப்பட்ட 1982 சீட்டு சட்டத்தின் கீழ் பதிவாளர் வழங்கிய பதிவு எண்.',
    hi: 'पंजीकृत चिट फंड अधिनियम 1982 समूहों के लिए रजिस्ट्रार पंजीकरण/PSO संख्या।',
    te: 'నమోదైన 1982 చిట్ చట్టం గ్రూపుల కోసం రిజిస్ట్రార్ నమోదు/PSO సంఖ్య.',
    kn: 'ನೋಂದಾಯಿತ 1982 ಚಿಟ್ ಕಾಯ್ದೆ ಗುಂಪುಗಳಿಗೆ ರಿಜಿಸ್ಟ್ರಾರ್ ನೋಂದಣಿ/PSO ಸಂಖ್ಯೆ.',
    ml: 'രജിസ്റ്റർ ചെയ്ത 1982 ചിട്ടി നിയമപ്രകാരമുള്ള രജിസ്ട്രേഷൻ/PSO നമ്പർ.',
  },
};

export function getChitFieldTooltip(key: ChitFormTooltipKey, lang?: string | null): string {
  const l = resolveChitLang(lang);
  return CHIT_FORM_TOOLTIPS[key]?.[l] || CHIT_FORM_TOOLTIPS[key]?.en || '';
}

export interface ChitFormUiStrings {
  basicDetails: string;
  chitStyleAndCadence: string;
  foremenAndCommission: string;
  membersAndTickets: string;
  advancedBidDividend: string;
  registrationCompliance: string;
  securityAndLiveRoom: string;
  tenureAutoLabel: string;
  autoCalcHint: string;
  foremenLabel: string;
  addForemanBtn: string;
  ticketQty: string;
  addTicketBtn: string;
  seatsOccupied: string;
  uniqueCustomers: string;
  templatesQuickTitle: string;
  showAllTemplates: string;
  hideTemplates: string;
}

const UI_STRINGS: Record<SupportedChitLang, ChitFormUiStrings> = {
  en: {
    basicDetails: '1. Basic Details',
    chitStyleAndCadence: '2. Chit Style, Cadence & Engine Parameters',
    foremenAndCommission: '3. Foremen & Commission',
    membersAndTickets: '4. Members & Multi-Ticket Enrollment',
    advancedBidDividend: '5. Bid Limits, Dividend & Default Rules',
    registrationCompliance: '6. Registration & Act 1982 Compliance',
    securityAndLiveRoom: '7. Security, Live Room & Winner Interest',
    tenureAutoLabel: 'Tenure (Auto)',
    autoCalcHint: 'Auto-synced with Members & Frequency',
    foremenLabel: 'Assigned Foremen / Staff (1 or more)',
    addForemanBtn: '+ Add Foreman',
    ticketQty: 'Tickets',
    addTicketBtn: '+ Add Ticket(s)',
    seatsOccupied: 'tickets enrolled',
    uniqueCustomers: 'unique members',
    templatesQuickTitle: 'Quick Templates',
    showAllTemplates: 'Browse 18 Types',
    hideTemplates: 'Hide Templates',
  },
  ta: {
    basicDetails: '1. அடிப்படை விவரங்கள்',
    chitStyleAndCadence: '2. சீட்டு வகை, தவணை & இயந்திர அமைப்புகள்',
    foremenAndCommission: '3. போர்மேன்கள் & கமிஷன்',
    membersAndTickets: '4. உறுப்பினர்கள் & பல-டிக்கெட் சேர்க்கை',
    advancedBidDividend: '5. ஏல வரம்பு, டிவிடெண்ட் & தாமத விதிகள்',
    registrationCompliance: '6. பதிவு & 1982 சட்டம் இணக்கம்',
    securityAndLiveRoom: '7. பிணை, நேரடி அறை & வெற்றியாளர் வட்டி',
    tenureAutoLabel: 'மொத்த காலம் (தானியங்கி)',
    autoCalcHint: 'உறுப்பினர் & தவணையுடன் தானாக கணக்கிடப்பட்டது',
    foremenLabel: 'நியமிக்கப்பட்ட போர்மேன்கள் / ஊழியர்கள்',
    addForemanBtn: '+ போர்மேன் சேர்',
    ticketQty: 'டிக்கெட்',
    addTicketBtn: '+ டிக்கெட் சேர்',
    seatsOccupied: 'டிக்கெட்டுகள்',
    uniqueCustomers: 'வாடிக்கையாளர்கள்',
    templatesQuickTitle: 'விரைவு மாதிரிகள்',
    showAllTemplates: '18 வகைகளைப் பார்',
    hideTemplates: 'மறை',
  },
  hi: {
    basicDetails: '1. बुनियादी विवरण',
    chitStyleAndCadence: '2. चिट प्रकार, आवृत्ति और इंजन नियम',
    foremenAndCommission: '3. फोरमैन और कमीशन',
    membersAndTickets: '4. सदस्य और मल्टी-टिकट नामांकन',
    advancedBidDividend: '5. बोली सीमा, लाभांश और डिफ़ॉल्ट नियम',
    registrationCompliance: '6. पंजीकरण और अधिनियम 1982 अनुपालन',
    securityAndLiveRoom: '7. जमानत, लाइव रूम और विजेता ब्याज',
    tenureAutoLabel: 'अवधि (स्वतः)',
    autoCalcHint: 'सदस्यों और आवृत्ति से स्वतः गणना',
    foremenLabel: 'नियुक्त फोरमैन / स्टाफ (1 या अधिक)',
    addForemanBtn: '+ फोरमैन जोड़ें',
    ticketQty: 'टिकट',
    addTicketBtn: '+ टिकट जोड़ें',
    seatsOccupied: 'टिकट दर्ज',
    uniqueCustomers: 'सदस्य',
    templatesQuickTitle: 'त्वरित टेम्पलेट',
    showAllTemplates: 'सभी 18 प्रकार',
    hideTemplates: 'छुपाएँ',
  },
  te: {
    basicDetails: '1. ప్రాథమిక వివరాలు',
    chitStyleAndCadence: '2. చిట్ రకం, వ్యవధి & ఇంజిన్ నియమాలు',
    foremenAndCommission: '3. ఫోర్‌మెన్ & కమీషన్',
    membersAndTickets: '4. సభ్యులు & మల్టీ-టికెట్ నమోదు',
    advancedBidDividend: '5. బిడ్ పరిమితి, డివిడెండ్ & ఆలస్య నియమాలు',
    registrationCompliance: '6. రిజిస్ట్రేషన్ & చట్టం 1982 నిబంధనలు',
    securityAndLiveRoom: '7. సెక్యూరిటీ, లైవ్ రూమ్ & విజేత వడ్డీ',
    tenureAutoLabel: 'కాలపరిమితి (ఆటో)',
    autoCalcHint: 'సభ్యులు & వ్యవధి ఆధారంగా ఆటో లెక్కింపు',
    foremenLabel: 'కేటాయించిన ఫోర్‌మెన్ / సిబ్బంది',
    addForemanBtn: '+ ఫోర్‌మ్యాన్ చేర్చు',
    ticketQty: 'టికెట్లు',
    addTicketBtn: '+ టికెట్ చేర్చు',
    seatsOccupied: 'టికెట్లు',
    uniqueCustomers: 'సభ్యులు',
    templatesQuickTitle: 'త్వరిత నమూనాలు',
    showAllTemplates: '18 రకాలు చూడండి',
    hideTemplates: 'దాచు',
  },
  kn: {
    basicDetails: '1. ಮೂಲ ವಿವರಗಳು',
    chitStyleAndCadence: '2. ಚಿಟ್ ಶೈಲಿ, ಆವರ್ತನ ಮತ್ತು ಎಂಜಿನ್ ನಿಯಮಗಳು',
    foremenAndCommission: '3. ಫೋರ್‌ಮ್ಯಾನ್ ಮತ್ತು ಕಮಿಷನ್',
    membersAndTickets: '4. ಸದಸ್ಯರು ಮತ್ತು ಮಲ್ಟಿ-ಟಿಕೆಟ್ ಸೇರ್ಪಡೆ',
    advancedBidDividend: '5. ಬಿಡ್ ಮಿತಿ, ಲಾಭಾಂಶ ಮತ್ತು ವಿಳಂಬ ನಿಯಮಗಳು',
    registrationCompliance: '6. ನೋಂದಣಿ ಮತ್ತು ಕಾಯ್ದೆ 1982 ಅನುಸರಣೆ',
    securityAndLiveRoom: '7. ಭದ್ರತೆ, ಲೈವ್ ರೂಮ್ ಮತ್ತು ವಿಜೇತ ಬಡ್ಡಿ',
    tenureAutoLabel: 'ಅವಧಿ (ಸ್ವಯಂ)',
    autoCalcHint: 'ಸದಸ್ಯರು ಮತ್ತು ಆವರ್ತನದಿಂದ ಸ್ವಯಂ ಲೆಕ್ಕಾಚಾರ',
    foremenLabel: 'ನಿಯೋಜಿತ ಫೋರ್‌ಮ್ಯಾನ್ / ಸಿಬ್ಬಂದಿ',
    addForemanBtn: '+ ಫೋರ್‌ಮ್ಯಾನ್ ಸೇರಿಸಿ',
    ticketQty: 'ಟಿಕೆಟ್',
    addTicketBtn: '+ ಟಿಕೆಟ್ ಸೇರಿಸಿ',
    seatsOccupied: 'ಟಿಕೆಟ್‌ಗಳು',
    uniqueCustomers: 'ಗ್ರಾಹಕರು',
    templatesQuickTitle: 'ತ್ವರಿತ ಮಾದರಿಗಳು',
    showAllTemplates: '18 ಪ್ರಕಾರಗಳು',
    hideTemplates: 'ಮರೆಮಾಡಿ',
  },
  ml: {
    basicDetails: '1. അടിസ്ഥാന വിവരങ്ങൾ',
    chitStyleAndCadence: '2. ചിട്ടി രീതി, ഇടവേള & എഞ്ചിൻ നിയമങ്ങൾ',
    foremenAndCommission: '3. ഫോർമാൻ & കമ്മീഷൻ',
    membersAndTickets: '4. അംഗങ്ങളും മൾട്ടി-ടിക്കറ്റ് ചേർക്കലും',
    advancedBidDividend: '5. ലേല പരിധി, ഡിവിഡന്റ് & പിഴ നിയമങ്ങൾ',
    registrationCompliance: '6. രജിസ്ട്രേഷൻ & 1982 നിയമം',
    securityAndLiveRoom: '7. ജാമ്യം, ലൈവ് റൂം & വിജയി പലിശ',
    tenureAutoLabel: 'കാലാവധി (സ്വയം)',
    autoCalcHint: 'അംഗങ്ങളും ഇടവേളയും അനുസരിച്ച് സ്വയം കണക്കാക്കിയത്',
    foremenLabel: 'നിയമിച്ച ഫോർമാൻ / സ്റ്റാഫ്',
    addForemanBtn: '+ ഫോർമാൻ ചേർക്കുക',
    ticketQty: 'ടിക്കറ്റ്',
    addTicketBtn: '+ ടിക്കറ്റ് ചേർക്കുക',
    seatsOccupied: 'ടിക്കറ്റുകൾ',
    uniqueCustomers: 'അംഗങ്ങൾ',
    templatesQuickTitle: 'വേഗത്തിലുള്ള മാതൃകകൾ',
    showAllTemplates: '18 തരങ്ങൾ കാണുക',
    hideTemplates: 'മറയ്ക്കുക',
  },
};

export function getChitFormUiStrings(lang?: string | null): ChitFormUiStrings {
  return UI_STRINGS[resolveChitLang(lang)];
}
