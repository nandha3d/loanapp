import prisma from './db';

const RESERVED_SLUGS = [
  'www', 'api', 'admin', 'app', 'portal',
  'support', 'static', 'assets', 'default'
];

/**
 * Slugifies a string by replacing non-alphanumeric characters with hyphens,
 * converting to lowercase, and cleaning up multiple/trailing hyphens.
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Maps module names to their short codes.
 */
const MODULE_CODES: Record<string, string> = {
  microlending: 'ml',
  autofinance: 'af',
  chitfunds: 'cf'
};

/**
 * Generates a unique tenant slug based on business name, selected modules,
 * and handles database collisions.
 */
export async function generateTenantSlug(
  businessName: string,
  selectedModules: string[]
): Promise<string> {
  const baseSlug = slugify(businessName);
  
  // Ordered module codes (ml, af, cf)
  const orderedModuleCodes = ['microlending', 'autofinance', 'chitfunds']
    .filter(m => selectedModules.includes(m))
    .map(m => MODULE_CODES[m])
    .filter(Boolean);

  let finalBase = baseSlug;
  if (orderedModuleCodes.length > 0) {
    finalBase = `${baseSlug}-${orderedModuleCodes.join('-')}`;
  }

  // Ensure it's not empty
  if (!finalBase) {
    finalBase = 'tenant';
  }

  let uniqueSlug = finalBase;
  let counter = 1;

  // Loop until we find a non-reserved, non-colliding slug
  while (true) {
    if (RESERVED_SLUGS.includes(uniqueSlug.toLowerCase())) {
      uniqueSlug = `${finalBase}-${counter}`;
      counter++;
      continue;
    }

    const existing = await prisma.tenant.findUnique({
      where: { slug: uniqueSlug },
      select: { id: true }
    });

    if (!existing) {
      break;
    }

    uniqueSlug = `${finalBase}-${counter}`;
    counter++;
  }

  return uniqueSlug;
}
