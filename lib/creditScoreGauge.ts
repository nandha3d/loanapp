export function getCreditScoreGaugePresentation(score: number, grade: string) {
  const min = 300;
  const max = 850;
  const pct = Math.max(0, Math.min(100, ((score - min) / (max - min)) * 100));
  const rotation = (pct * 1.8) - 90;

  let color = '#16A34A';
  if (score < 500) color = '#EF4444';
  else if (score < 650) color = '#F59E0B';
  else if (score < 750) color = '#EAB308';

  return {
    rotation,
    color,
    ariaLabel: `Credit score: ${score} - ${grade}`,
  };
}
