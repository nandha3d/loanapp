import { en } from '@/i18n/en';
import { ta } from '@/i18n/ta';
import { hi } from '@/i18n/hi';
import { te } from '@/i18n/te';
import { kn } from '@/i18n/kn';
import { ml } from '@/i18n/ml';
import { getSetting } from './tenant';

export type Language = 'en' | 'ta' | 'hi' | 'te' | 'kn' | 'ml';

const dictionaries = {
  en,
  ta,
  hi,
  te,
  kn,
  ml,
};

export const supportedLanguages: { code: Language; nativeName: string; englishName: string }[] = [
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada' },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam' },
];

export async function getCurrentLanguage(tenantId: string): Promise<Language> {
  return await getSetting(tenantId, 'language', 'en') as Language;
}

export async function getDictionary(tenantId: string) {
  const lang = await getCurrentLanguage(tenantId);
  return dictionaries[lang] || dictionaries.en;
}

export function getDictionarySync(lang: string = 'en') {
  return dictionaries[lang as Language] || dictionaries.en;
}
