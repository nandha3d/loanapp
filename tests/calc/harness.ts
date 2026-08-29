/**
 * Calculation-logic harness.
 *
 * Every entry in `OPS` wraps ONE pure function from the application's own money
 * code and returns a flat "facts" object. Cases in `cases.json` assert against
 * those facts by dotted path, so a case never needs to run code of its own —
 * which is what lets a different agent (or a different language) execute the
 * same suite.
 *
 * Nothing here re-implements a formula. Where a fact needs a derived figure (the
 * sum of a schedule, the ISO form of a due date) it derives it from the real
 * function's output; the moment a fact computes money itself, the suite starts
 * testing the harness instead of the app.
 */

// The money modules import the Prisma singleton at module scope. No case runs a
// query, but PrismaClient still wants a datasource URL to construct, so give it
// a placeholder when the shell has none. A real URL, if present, is left alone.
process.env.DATABASE_URL ??= 'mysql://placeholder:placeholder@127.0.0.1:3306/placeholder';
process.env.NODE_ENV ??= 'test';

export type Facts = Record<string, unknown>;
export type OpFn = (input: any) => Facts | Promise<Facts>;

const iso = (d: Date | string): string =>
  (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

/** Round to 2dp for comparison — float noise is an artefact, not a business rule. */
const money = (n: number): number => Math.round(n * 100) / 100;

export async function buildOps(): Promise<Record<string, OpFn>> {
  const loanCalculator = await import('../../lib/loanCalculator');
  const utils = await import('../../lib/utils');
  const repayments = await import('../../lib/repayments');
  const penalties = await import('../../lib/penalties');
  const foreclosure = await import('../../lib/foreclosure');
  const interestOnly = await import('../../lib/interestOnly');
  const npaClassifier = await import('../../lib/npa/npaClassifier');
  const provisioning = await import('../../lib/npa/provisioningCalculator');
  const wallet = await import('../../lib/wallet');
  const collectionPolicy = await import('../../lib/collectionPolicy');
  const loanPolicy = await import('../../lib/loanPolicy');
  const creditScore = await import('../../lib/creditScore');

  return {
    // ── Origination ────────────────────────────────────────────────────────
    'loan.preview': (input) => {
      const r = loanCalculator.calculateLoanPreview(input);
      const dueAmounts = r.schedule.map((s) => s.dueAmount);
      return {
        principal: r.principal,
        disbursedAmount: r.disbursedAmount,
        totalPayable: r.totalPayable,
        perInstalment: r.perInstalment,
        deduction: r.deduction,
        monthlyInterest: r.monthlyInterest ?? null,
        aprPercent: r.aprPercent ?? null,
        principalDueAtClosure: r.principalDueAtClosure ?? null,
        maturityDate: r.maturityDate ? iso(r.maturityDate) : null,
        effectiveAnnualPercent: r.effectiveAnnualPercent ?? null,
        scheduleLength: r.schedule.length,
        scheduleSum: sum(dueAmounts),
        dueAmounts,
        firstDueAmount: dueAmounts[0] ?? null,
        lastDueAmount: dueAmounts[dueAmounts.length - 1] ?? null,
        dueDates: r.schedule.map((s) => iso(s.dueDate)),
        firstDueDate: r.schedule.length ? iso(r.schedule[0].dueDate) : null,
        lastDueDate: r.schedule.length ? iso(r.schedule[r.schedule.length - 1].dueDate) : null,
        // Every model except interest_only spreads the whole payable across rows.
        scheduleSumEqualsPayable: sum(dueAmounts) === r.totalPayable,
      };
    },

    'loan.distribute': (input) => {
      const amounts = loanCalculator.distributeInstalmentAmounts(input.totalPayable, input.tenure);
      return { amounts, count: amounts.length, sum: sum(amounts) };
    },

    'loan.isInterestOnly': (input) => ({
      result: loanCalculator.isInterestOnly(input.interestType),
    }),

    'loan.validate': (input) => {
      const r = loanPolicy.validateLoanNumericInputs(input);
      return { valid: r.valid, error: (r as { error?: string }).error ?? null };
    },

    'loan.canCreateForRole': (input) => ({
      result: loanPolicy.canCreateLoanForRole(input.role),
    }),

    // ── Schedule dates ─────────────────────────────────────────────────────
    'schedule.dates': (input) => {
      const dates = utils.calculateInstalmentDates(
        new Date(input.startDate),
        input.frequency,
        input.tenure,
        input.dueDay ?? null,
      );
      return {
        dates: dates.map(iso),
        count: dates.length,
        first: dates.length ? iso(dates[0]) : null,
        last: dates.length ? iso(dates[dates.length - 1]) : null,
      };
    },

    'schedule.endDate': (input) => ({
      endDate: iso(utils.calculateEndDate(new Date(input.startDate), input.frequency, input.tenure)),
    }),

    // ── Repayment allocation ───────────────────────────────────────────────
    'repay.allocate': (input) => {
      const allocations = repayments.allocatePaymentsAcrossInstalments(
        input.instalments,
        input.totalCollected,
        new Date(input.now),
      );
      const s = repayments.summarizeAllocations(allocations);
      return {
        statuses: allocations.map((a) => a.status),
        received: allocations.map((a) => a.receivedAmount),
        outstanding: allocations.map((a) => a.outstandingAmount),
        overdue: allocations.map((a) => a.overdueAmount),
        daysOverdue: allocations.map((a) => a.daysOverdue),
        paidCount: s.paidCount,
        totalCollected: s.totalCollected,
        totalDue: s.totalDue,
        outstandingAmount: s.outstandingAmount,
        overdueAmount: s.overdueAmount,
        overdueCount: s.overdueCount,
        loanStatus: s.loanStatus,
      };
    },

    'repay.fillOrder': (input) => {
      const ordered = repayments.orderInstalmentsForCollectionFill(
        input.instalments,
        new Date(input.now),
      );
      return {
        order: ordered.map((i: any) => i.instalmentNo),
        dueDates: ordered.map((i: any) => iso(i.dueDate)),
      };
    },

    'repay.loanStatus': (input) => ({ status: repayments.resolveLoanStatus(input) }),

    'repay.instalmentOutstanding': (input) => ({
      outstanding: repayments.getInstalmentOutstanding(input),
    }),

    // ── Penalties ──────────────────────────────────────────────────────────
    'penalty.accrual': (input) => {
      const r = penalties.calculatePenaltyAccrual({
        overdueInstalments: input.overdueInstalments,
        asOf: new Date(input.asOf),
        penaltyPerDay: input.penaltyPerDay,
        gracePeriodDays: input.gracePeriodDays,
        maxCap: input.maxCap,
      });
      return { missedDays: r.missedDays, grossPenalty: r.grossPenalty };
    },

    'penalty.shouldUpdate': (input) => ({
      result: penalties.shouldUpdatePenaltyGross(input.existing, input.next),
    }),

    // ── Foreclosure ────────────────────────────────────────────────────────
    'foreclosure.build': (input) => {
      const r = foreclosure.buildForeclosureCalculation(
        input.loan,
        input.discount ?? 0,
        new Date(input.now ?? '2026-01-01'),
      );
      return {
        canForeclose: r.canForeclose,
        reason: r.reason ?? null,
        originalPrincipal: r.originalPrincipal,
        totalCollected: r.totalCollected,
        principalOutstanding: r.principalOutstanding,
        grossPenalty: r.grossPenalty,
        settledPenalty: r.settledPenalty,
        waivedPenalty: r.waivedPenalty,
        netPenaltyDue: r.netPenaltyDue,
        discount: r.discount,
        totalSettlementAmount: r.totalSettlementAmount,
        paidInstalments: r.paidInstalments,
        missedInstalments: r.missedInstalments,
        remainingInstalments: r.remainingInstalments,
        lineItemLabels: r.lineItems.map((l) => l.label),
      };
    },

    // ── Interest-only servicing ────────────────────────────────────────────
    'interestOnly.monthlyInterest': (input) => ({
      interest: interestOnly.monthlyInterestFor(input.principal, input.monthlyRatePercent),
      apr: interestOnly.toAprPercent(input.monthlyRatePercent),
    }),

    'interestOnly.summary': (input) => {
      const s = interestOnly.summarizeInterestOnlyLoan(input.loan);
      return {
        originalPrincipal: s.originalPrincipal,
        outstandingPrincipal: s.outstandingPrincipal,
        monthlyRatePercent: s.monthlyRatePercent,
        aprPercent: s.aprPercent,
        monthlyInterest: s.monthlyInterest,
        interestCollected: s.interestCollected,
        interestDueNow: s.interestDueNow,
        paidInstalments: s.paidInstalments,
        upcomingInstalments: s.upcomingInstalments,
        totalDueToClose: s.totalDueToClose,
      };
    },

    // ── NPA / provisioning ─────────────────────────────────────────────────
    'npa.overdueDays': (input) => ({
      days: npaClassifier.calculateMaxOverdueDays(input.instalments, new Date(input.today)),
    }),

    'npa.category': (input) => ({
      category: npaClassifier.determineCategory(
        input.daysOverdue,
        input.npaClassifiedAt ? new Date(input.npaClassifiedAt) : null,
        new Date(input.today),
      ),
    }),

    'npa.provisioning': (input) => {
      const r = provisioning.calculateProvisioning(
        input.category,
        input.outstandingAmount,
        input.isSecured ?? false,
      );
      return { rate: r.rate, amount: money(r.amount), basis: r.basis };
    },

    // ── Cash float ─────────────────────────────────────────────────────────
    'wallet.float': (input) => ({
      balance: wallet.calculateFloatBalance(input.available, input.delta, input.hardBlock ?? false),
    }),

    // ── Collection policy ──────────────────────────────────────────────────
    'collection.isCollectionDay': (input) => ({
      result: collectionPolicy.isCollectionDay(
        input.frequency,
        new Date(input.dueDate),
        new Date(input.today),
      ),
    }),

    'collection.blockReason': (input) => ({
      reason: collectionPolicy.getCollectionSubmissionBlockReason(input) ?? null,
    }),

    'collection.loanBlockReason': (input) => ({
      reason: collectionPolicy.getLoanCollectionBlockReason(input.status) ?? null,
    }),

    'collection.idempotencyKey': (input) => ({
      key: collectionPolicy.buildCollectionIdempotencyKey(input),
    }),

    // ── Credit score ───────────────────────────────────────────────────────
    'credit.score': (input) => {
      const r = creditScore.calculateCreditScore(input.loans);
      return {
        score: r.score,
        grade: r.grade,
        punctuality: r.stats.punctuality,
        totalBorrowed: r.stats.totalBorrowed,
        totalPaid: r.stats.totalPaid,
        activeLoans: r.stats.activeLoans,
        closedLoans: r.stats.closedLoans,
      };
    },
  };
}
