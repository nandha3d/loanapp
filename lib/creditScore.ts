/**
 * Calculates a credit score from 0 to 100 for a customer based on loan performance.
 */
export function calculateCreditScore(loans: any[]) {
  if (!loans || loans.length === 0) return { score: 0, grade: 'N/A', stats: { totalBorrowed: 0, totalPaid: 0, punctuality: 0, activeLoans: 0, closedLoans: 0 } };

  let totalPoints = 0;
  const totalLoans = loans.length;
  const closedLoans = loans.filter(l => l.status === 'closed').length;
  
  // 1. Punctuality (55% weight)
  let totalInstalmentsDue = 0;
  let totalOnTimePayments = 0;
  let totalBorrowed = 0;
  let totalPaid = 0;

  loans.forEach(loan => {
    totalBorrowed += Number(loan.principal);
    const instalments = loan.instalments || [];
    totalInstalmentsDue += loan.tenure || 0;
    const paidInstalments = instalments.filter((i: any) => i.status === 'paid').length;
    
    // Penalize missed/partial payments more heavily
    const missed = instalments.filter((i: any) => i.status === 'missed').length;
    const partial = instalments.filter((i: any) => i.status === 'partial').length;
    
    totalOnTimePayments += Math.max(0, paidInstalments - (missed * 1.5) - (partial * 0.5));
    
    instalments.forEach((i: any) => {
      if (i.status === 'paid' || i.status === 'partial') totalPaid += Number(i.receivedAmount || 0);
    });
  });

  const hasActivity = loans.some(loan =>
    loan.instalments?.some((i: any) => i.status === 'paid' || i.status === 'missed' || i.status === 'partial')
  );
  if (!hasActivity) {
    return {
      score: 0,
      grade: 'N/A',
      stats: { totalBorrowed, totalPaid: 0, punctuality: 0, activeLoans: totalLoans - closedLoans, closedLoans },
    };
  }

  const punctualityRatio = totalInstalmentsDue > 0 ? Math.max(0, totalOnTimePayments / totalInstalmentsDue) : 1;
  totalPoints += punctualityRatio * 55;

  // 2. Completion (35% weight)
  const completionRatio = totalLoans > 0 ? closedLoans / totalLoans : 0;
  totalPoints += completionRatio * 35;

  // 3. Volume / Stability (10% weight)
  const volumeBonus = Math.min(10, (totalBorrowed / 50000) * 10);
  totalPoints += volumeBonus;

  // Map 0-100 points to 300-850 range
  const score = 300 + Math.round(totalPoints * 5.5);
  
  let grade: string;
  if (score >= 780) grade = 'Excellent';
  else if (score >= 680) grade = 'Good';
  else if (score >= 560) grade = 'Fair';
  else if (score >= 440) grade = 'Poor';
  else grade = 'Very Poor';

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
