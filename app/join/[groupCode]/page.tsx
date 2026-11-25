import JoinChitClient from './JoinChitClient';

export default async function PublicChitInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ groupCode: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { groupCode } = await params;
  const { invite } = await searchParams;
  return <JoinChitClient groupCode={groupCode} inviteToken={invite || ''} />;
}
