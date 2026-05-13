/**
 * Calculates a credit score from 0 to 100 for a customer based on loan performance.
 */
export function calculateCreditScore(loans: any[]) {
  if (!loans || loans.length === 0) return { score: 300, grade: 'N/A', stats: { totalBorrowed: 0, totalPaid: 0, punctuality: 0 } };

  let totalPoints = 0;
  const totalLoans = loans.length;
  const closedLoans = loans.filter(l => l.status === 'closed').length;
  
  // 1. Punctuality (50% weight)
  let totalInstalmentsDue = 0;
  let totalOnTimePayments = 0;
  let totalBorrowed = 0;
  let totalPaid = 0;

  loans.forEach(loan => {
    totalBorrowed += Number(loan.principal);
    const instalments = loan.instalments || [];
    const penaltyCount = loan.penalties?.length || 0;
    
    totalInstalmentsDue += loan.totalInstalments || loan.tenure;
    const paidInstalments = instalments.filter((i: any) => i.status === 'paid').length;
    
    // Penalize missed/partial payments more heavily
    const missed = instalments.filter((i: any) => i.status === 'missed').length;
    const partial = instalments.filter((i: any) => i.status === 'partial').length;
    
    totalOnTimePayments += Math.max(0, paidInstalments - (missed * 1.5) - (partial * 0.5));
    
    instalments.forEach((i: any) => {
      if (i.status === 'paid') totalPaid += Number(i.receivedAmount);
    });
  });

  const punctualityRatio = totalInstalmentsDue > 0 ? Math.max(0, totalOnTimePayments / totalInstalmentsDue) : 1;
  totalPoints += punctualityRatio * 50;

  // 2. Completion (30% weight)
  const completionRatio = totalLoans > 0 ? closedLoans / totalLoans : 0;
  totalPoints += completionRatio * 30;

  // 3. Volume / Stability (20% weight)
  const volumeBonus = Math.min(20, (totalBorrowed / 100000) * 20);
  totalPoints += volumeBonus;

  // Map 0-100 points to 300-850 range
  const score = 300 + Math.round(totalPoints * 5.5);
  
  let grade = 'Poor';
  if (score >= 750) grade = 'Excellent';
  else if (score >= 650) grade = 'Good';
  else if (score >= 550) grade = 'Fair';
  else if (score >= 450) grade = 'Poor';
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
