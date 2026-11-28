import { notFound, redirect } from 'next/navigation';
import { getWebChitScope } from '@/lib/chits/access';
import { buildGroupRoomState } from '@/lib/chits/groupRoom';
import { getCurrentLanguage } from '@/lib/i18n';
import { getSetting } from '@/lib/tenant';
import { modulePath } from '@/types/modules';
import ChitGroupRoomView from '@/components/chits/ChitGroupRoomView';

export default async function StaffChitGroupRoomPage({
  params,
}: {
  params: Promise<{ id: string; module: string }>;
}) {
  const { id } = await params;
  const scope = await getWebChitScope();
  const [initialState, currencySymbol, initialLang] = await Promise.all([
    buildGroupRoomState({
      groupId: id,
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      isStaff: true,
    }),
    getSetting(scope.tenantId, 'currency_symbol', '₹'),
    getCurrentLanguage(scope.tenantId),
  ]);
  if (!initialState) notFound();

  // Unify staff Group Room & Live Auction Room into one default workspace whenever an auction exists.
  if (initialState.activeAuction?.id) {
    redirect(
      modulePath(
        scope.appType,
        `/chits/${initialState.group.groupCode ?? initialState.group.id}/auctions/${initialState.activeAuction.id}`,
      ),
    );
  }

  return (
    <ChitGroupRoomView
      mode="staff"
      initialState={initialState}
      currencySymbol={currencySymbol}
      initialLang={initialLang}
      backHref={modulePath(scope.appType, `/chits/${initialState.group.id}`)}
      apiBaseUrl={`/api/chits/${initialState.group.id}/room`}
    />
  );
}
