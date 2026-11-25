import { notFound, redirect } from 'next/navigation';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { buildGroupRoomState } from '@/lib/chits/groupRoom';
import { getCurrentLanguage } from '@/lib/i18n';
import { getSetting } from '@/lib/tenant';
import ChitGroupRoomView from '@/components/chits/ChitGroupRoomView';

export default async function BorrowerChitGroupRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getBorrowerSession();
  if (!session) redirect('/borrower/login');
  const { id } = await params;

  const [initialState, currencySymbol, initialLang] = await Promise.all([
    buildGroupRoomState({
      groupId: id,
      tenantId: session.tenantId,
      viewerCustomerId: session.customerId,
      isStaff: false,
    }),
    getSetting(session.tenantId, 'currency_symbol', '₹'),
    getCurrentLanguage(session.tenantId),
  ]);
  if (!initialState) notFound();

  return (
    <div style={{ padding: '16px', minHeight: '100vh', background: '#f8fafc' }}>
      <ChitGroupRoomView
        mode="member"
        initialState={initialState}
        currencySymbol={currencySymbol}
        initialLang={initialLang}
        backHref="/borrower/dashboard"
        apiBaseUrl={`/api/borrower/chits/${initialState.group.id}/room`}
      />
    </div>
  );
}
