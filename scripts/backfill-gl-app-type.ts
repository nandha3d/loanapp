/**
 * Assign historical GL journals only when a same-tenant source proves module.
 * Run after the journal_entries.app_type schema change. Dry run is the default.
 * Ambiguous manual, bill, period-close and synthetic-source entries stay NULL.
 */
import prisma from '../lib/db';

const apply = process.argv.includes('--apply');

async function main() {
  const before = await prisma.journalEntry.count({ where: { appType: null } });
  if (!apply) {
    console.log(`Dry run: ${before} unclassified journals. Pass --apply to backfill verified sources.`);
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const disbursals = await tx.$executeRaw`
      UPDATE journal_entries je
      JOIN loans l ON l.id = je.source_id AND l.tenant_id = je.tenant_id
      SET je.app_type = l.app_type
      WHERE je.app_type IS NULL AND je.source_type = 'loan_disburse'
        AND (je.branch_id IS NULL OR je.branch_id = l.branch_id)
        AND NOT EXISTS (
          SELECT 1 FROM journal_lines jl JOIN loans linked ON linked.id = jl.loan_id
          WHERE jl.entry_id = je.id AND (linked.tenant_id <> je.tenant_id OR linked.app_type <> l.app_type)
        )`;
    const collections = await tx.$executeRaw`
      UPDATE journal_entries je
      JOIN collection_entries ce ON ce.id = je.source_id
      JOIN loans l ON l.id = ce.loan_id AND l.tenant_id = je.tenant_id
      SET je.app_type = l.app_type
      WHERE je.app_type IS NULL AND je.source_type = 'collection'
        AND (je.branch_id IS NULL OR je.branch_id = l.branch_id)
        AND NOT EXISTS (
          SELECT 1 FROM journal_lines jl JOIN loans linked ON linked.id = jl.loan_id
          WHERE jl.entry_id = je.id AND (linked.tenant_id <> je.tenant_id OR linked.app_type <> l.app_type)
        )`;
    const cashBookSources = await tx.$executeRaw`
      UPDATE journal_entries je
      JOIN account_entries ae ON ae.id = je.source_id AND ae.tenant_id = je.tenant_id
      SET je.app_type = ae.app_type
      WHERE je.app_type IS NULL AND je.source_type IN ('expense', 'capital_add', 'capital_withdraw', 'basic_migration')
        AND (je.branch_id IS NULL OR je.branch_id = ae.branch_id)
        AND NOT EXISTS (
          SELECT 1 FROM journal_lines jl JOIN loans linked ON linked.id = jl.loan_id
          WHERE jl.entry_id = je.id AND (linked.tenant_id <> je.tenant_id OR linked.app_type <> ae.app_type)
        )`;
    const bills = await tx.$executeRaw`
      UPDATE journal_entries je
      JOIN bills b ON b.id = je.source_id AND b.tenant_id = je.tenant_id
      SET je.app_type = b.app_type
      WHERE je.app_type IS NULL AND b.app_type IS NOT NULL
        AND je.source_type IN ('bill', 'bill_payment')
        AND (je.branch_id IS NULL OR je.branch_id = b.branch_id)
        AND NOT EXISTS (
          SELECT 1 FROM journal_lines jl JOIN loans linked ON linked.id = jl.loan_id
          WHERE jl.entry_id = je.id AND (linked.tenant_id <> je.tenant_id OR linked.app_type <> b.app_type)
        )`;
    const reversals = await tx.$executeRaw`
      UPDATE journal_entries je
      JOIN journal_entries original ON original.id = je.source_id AND original.tenant_id = je.tenant_id
      SET je.app_type = original.app_type
      WHERE je.app_type IS NULL AND je.source_type = 'reversal' AND original.app_type IS NOT NULL
        AND (je.branch_id IS NULL OR je.branch_id = original.branch_id)
        AND NOT EXISTS (
          SELECT 1 FROM journal_lines jl JOIN loans linked ON linked.id = jl.loan_id
          WHERE jl.entry_id = je.id AND (linked.tenant_id <> je.tenant_id OR linked.app_type <> original.app_type)
        )`;
    return { disbursals, collections, cashBookSources, bills, reversals };
  }, { timeout: 120000 });

  const after = await prisma.journalEntry.count({ where: { appType: null } });
  console.log({ before, updated, unclassified: after });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
