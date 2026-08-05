import { getAffiliateConfig } from '@/lib/affiliate';
import AffiliateLandingClient from './AffiliateLandingClient';

export const metadata = {
  title: 'Affiliate Program | ZoloFund',
  description: 'Refer lending businesses and earn recurring rewards.',
};

export default async function PublicAffiliateLandingPage() {
  const config = await getAffiliateConfig();

  return <AffiliateLandingClient config={config} />;
}
