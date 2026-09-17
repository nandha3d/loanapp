import prisma from '../lib/db';

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`
      UPDATE chit_subscriptions
      SET base_due_amount = due_amount
      WHERE base_due_amount IS NULL
    `);

    await tx.$executeRawUnsafe(`
      UPDATE chit_members
      SET ticket_no = CAST(member_number AS CHAR)
      WHERE ticket_no IS NULL
    `);

    await tx.$executeRawUnsafe(`
      UPDATE chit_members
      SET ticket_share = 1.00
      WHERE ticket_share IS NULL
    `);

    await tx.$executeRawUnsafe(`
      UPDATE chit_groups
      SET
        compliance_status = CASE
          WHEN status = 'active' THEN 'active'
          WHEN status = 'completed' THEN 'closed'
          WHEN status = 'cancelled' THEN 'suspended'
          ELSE COALESCE(compliance_status, 'draft')
        END,
        chit_type = CASE
          WHEN registration_no IS NOT NULL AND registration_no <> '' THEN 'registered'
          ELSE COALESCE(chit_type, 'unregistered')
        END,
        auction_type = COALESCE(auction_type, 'open_manual'),
        auction_frequency = COALESCE(auction_frequency, 'monthly'),
        auction_mode = COALESCE(auction_mode, 'offline'),
        commission_basis = COALESCE(commission_basis, 'BID_DISCOUNT'),
        dividend_policy = COALESCE(dividend_policy, 'ALL_MEMBERS'),
        dividend_distribution = COALESCE(dividend_distribution, 'ADJUST_NEXT_DUE'),
        tie_break_rule = COALESCE(tie_break_rule, 'EARLIEST_BID')
    `);

    await tx.$executeRawUnsafe(`
      UPDATE chit_auctions a
      SET payout_status = 'paid'
      WHERE a.status IN ('completed', 'paid')
        AND EXISTS (
          SELECT 1
          FROM account_entries e
          WHERE e.reference_id = a.id
            AND e.reference_type = 'chit_auction'
            AND e.type = 'chit_payout'
        )
    `);

    await tx.$executeRawUnsafe(`
      UPDATE chit_auctions
      SET payout_status = 'security_pending'
      WHERE status IN ('completed', 'confirmed')
        AND winner_member_id IS NOT NULL
        AND payout_status = 'not_ready'
    `);
  });
}

main()
  .then(() => {
    console.log('Chit schema backfill completed.');
  })
  .catch((error) => {
    console.error('Chit schema backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
