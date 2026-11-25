import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Font } from '@react-pdf/renderer';
import { PDF_LANGUAGES, resolvePdfLang, type PdfLang } from './pdfLanguages';

export { PDF_LANGUAGES, resolvePdfLang, type PdfLang };

const FONT_DIR = join(process.cwd(), 'public', 'fonts', 'pdf');

interface FontFamilySpec {
  family: string;
  regular: string;
  bold: string;
}

const FONT_SPECS: readonly FontFamilySpec[] = [
  { family: 'ZoloSans', regular: 'NotoSans-Regular.ttf', bold: 'NotoSans-Bold.ttf' },
  { family: 'ZoloTamil', regular: 'NotoSansTamil-Regular.ttf', bold: 'NotoSansTamil-Bold.ttf' },
  { family: 'ZoloDevanagari', regular: 'NotoSansDevanagari-Regular.ttf', bold: 'NotoSansDevanagari-Bold.ttf' },
  { family: 'ZoloTelugu', regular: 'HindGuntur-Regular.ttf', bold: 'HindGuntur-Bold.ttf' },
  { family: 'ZoloKannada', regular: 'NotoSansKannada-Regular.ttf', bold: 'NotoSansKannada-Bold.ttf' },
  { family: 'ZoloMalayalam', regular: 'Manjari-Regular.ttf', bold: 'Manjari-Bold.ttf' },
];

let fontsInitialized = false;
let fontsAvailable = false;

export function ensurePdfFonts(): boolean {
  if (fontsInitialized) return fontsAvailable;
  fontsInitialized = true;

  try {
    let loadedAny = false;
    for (const spec of FONT_SPECS) {
      const regPath = join(FONT_DIR, spec.regular);
      const boldPath = join(FONT_DIR, spec.bold);
      if (existsSync(regPath)) {
        Font.register({
          family: spec.family,
          fonts: [
            { src: regPath, fontWeight: 'normal' },
            { src: existsSync(boldPath) ? boldPath : regPath, fontWeight: 'bold' },
          ],
        });
        loadedAny = true;
      }
    }
    fontsAvailable = loadedAny;
  } catch {
    fontsAvailable = false;
  }
  return fontsAvailable;
}

const LANG_PRIMARY_FAMILY: Record<PdfLang, string> = {
  en: 'ZoloSans',
  ta: 'ZoloTamil',
  hi: 'ZoloDevanagari',
  te: 'ZoloTelugu',
  kn: 'ZoloKannada',
  ml: 'ZoloMalayalam',
};

/**
 * Returns a font-family fallback list starting with the requested language's
 * Indic script font and falling back to Latin + ₹ (`ZoloSans`) and sibling scripts
 * so mixed member/group names render cleanly across all 6 languages.
 */
export function getPdfFontFamily(lang?: string | null): any {
  if (!ensurePdfFonts()) return 'Helvetica';
  const resolved = resolvePdfLang(lang);
  const primary = LANG_PRIMARY_FAMILY[resolved];
  const ordered = [
    primary,
    'ZoloSans',
    'ZoloTamil',
    'ZoloDevanagari',
    'ZoloTelugu',
    'ZoloKannada',
    'ZoloMalayalam',
  ];
  return Array.from(new Set(ordered));
}

export function getPdfBoldStyle(lang?: string | null): { fontFamily: any; fontWeight: 'bold' } {
  if (!ensurePdfFonts()) return { fontFamily: 'Helvetica-Bold', fontWeight: 'bold' };
  return { fontFamily: getPdfFontFamily(lang), fontWeight: 'bold' };
}
