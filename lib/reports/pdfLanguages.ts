export type PdfLang = 'en' | 'ta' | 'hi' | 'te' | 'kn' | 'ml';

export const PDF_LANGUAGES: readonly { code: PdfLang; nativeName: string; englishName: string }[] = [
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada' },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam' },
];

export function resolvePdfLang(raw?: string | null): PdfLang {
  const code = (raw ?? 'en').trim().toLowerCase();
  if (code === 'ta' || code === 'hi' || code === 'te' || code === 'kn' || code === 'ml') return code;
  return 'en';
}
