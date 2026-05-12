import { en } from '@/i18n/en';
import { ta } from '@/i18n/ta';
import { hi } from '@/i18n/hi';
import { getSetting } from './tenant';

export type Language = 'en' | 'ta' | 'hi';

const dictionaries = {
  en,
  ta,
  hi,
};

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
