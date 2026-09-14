import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getPlatformPaymentSettingsMasked } from '@/lib/platformPayment';
import PaymentSettingsClient from './PaymentSettingsClient';

export default async function PaymentSettingsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (role !== 'developer') {
    redirect('/admin');
  }

  const initialSettings = await getPlatformPaymentSettingsMasked();

  return <PaymentSettingsClient initialSettings={initialSettings} />;
}
