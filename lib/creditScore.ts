/**
 * Calculates a credit score from 0 to 100 for a customer based on loan performance.
 */
export function calculateCreditScore(loans: any[]) {
  if (!loans || loans.length === 0) return { score: 0, grade: 'N/A', stats: { totalBorrowed: 0, totalPaid: 0, punctuality: 0 } };

  let totalPoints = 0;
  const totalLoans = loans.length;
  const closedLoans = loans.filter(l => l.status === 'closed').length;
  
  // 1. Punctuality (50 points)
  // Calculated as (On-time instalments / Total instalments due)
  let totalInstalmentsDue = 0;
  let totalOnTimePayments = 0;
  let totalBorrowed = 0;
  let totalPaid = 0;

  loans.forEach(loan => {
    totalBorrowed += Number(loan.principal);
    const instalments = loan.instalments || [];
    const penaltyCount = loan.penalties?.length || 0;
    
    totalInstalmentsDue += loan.tenure;
    const paidInstalments = instalments.filter((i: any) => i.status === 'paid').length;
    
    // Simple logic: every penalty is a missed/late payment
    // Every paid instalment that wasn't penalized is considered on-time
    totalOnTimePayments += Math.max(0, paidInstalments - penaltyCount);
    
    instalments.forEach((i: any) => {
      if (i.status === 'paid') totalPaid += Number(i.amountPaid);
    });
  });

  const punctualityRatio = totalInstalmentsDue > 0 ? totalOnTimePayments / totalInstalmentsDue : 1;
  totalPoints += punctualityRatio * 50;

  // 2. Completion (30 points)
  const completionRatio = closedLoans / totalLoans;
  totalPoints += completionRatio * 30;

  // 3. Volume / Stability (20 points)
  // Reward for high volume of successfully managed debt
  const volumeBonus = Math.min(20, (totalBorrowed / 100000) * 20);
  totalPoints += volumeBonus;

  const score = Math.round(totalPoints);
  
  let grade = 'D';
  if (score >= 90) grade = 'A+';
  else if (score >= 80) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 50) grade = 'C';

  return {
    score,
    grade,
    stats: {
      totalBorrowed,
      totalPaid,
      punctuality: Math.round(punctualityRatio * 100),
      activeLoans: totalLoans - closedLoans,
      closedLoans
    }
  };
}
