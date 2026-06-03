import { siteConfig } from './seo';

/** Renders a JSON-LD <script>. Safe: data is our own static object. */
function Ld({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Site-wide structured data: Organization + the SoftwareApplication itself +
 * the WebSite (with a search action). Rendered once in the marketing layout so
 * it appears on every public page.
 */
export function SiteJsonLd() {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    url: siteConfig.url,
    logo: `${siteConfig.url}/assets/logo.svg`,
    description: siteConfig.description,
    sameAs: [] as string[],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: 'hello@loantrack.in',
      areaServed: 'IN',
      availableLanguage: ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam'],
    },
  };

  const software = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `${siteConfig.name} — ${siteConfig.tagline}`,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Loan Management Software',
    operatingSystem: 'Web, Android, iOS',
    description: siteConfig.description,
    url: siteConfig.url,
    inLanguage: ['en', 'hi', 'ta', 'te', 'kn', 'ml'],
    offers: [
      { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'INR' },
      { '@type': 'Offer', name: 'Basic', price: '999', priceCurrency: 'INR' },
      { '@type': 'Offer', name: 'Business', price: '2999', priceCurrency: 'INR' },
      { '@type': 'Offer', name: 'Enterprise', price: '7999', priceCurrency: 'INR' },
    ],
    featureList: [
      'GPS field collection',
      'Micro lending, auto finance, gold loan & chit fund modules',
      'Agent wallets & cash-pool reconciliation',
      'Aadhaar eKYC & credit bureau integration',
      'Double-entry accounting',
      'NPA auto-classification (RBI-aligned)',
      'Native Android & iOS app',
    ],
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    inLanguage: 'en-IN',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteConfig.url}/products?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <>
      <Ld data={org} />
      <Ld data={software} />
      <Ld data={website} />
    </>
  );
}

/** FAQPage structured data — drives FAQ rich snippets in search results. */
export function FaqJsonLd({ items }: { items: { q: string; a: string }[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
  return <Ld data={data} />;
}

/** BreadcrumbList structured data for inner pages. */
export function BreadcrumbJsonLd({ name, path }: { name: string; path: string }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteConfig.url}/home` },
      { '@type': 'ListItem', position: 2, name, item: `${siteConfig.url}${path}` },
    ],
  };
  return <Ld data={data} />;
}
