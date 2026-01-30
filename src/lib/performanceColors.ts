/**
 * Centraliza a regra de coloração de performance usada em barras lineares e circulares.
 * Mantém a mesma paleta/intervalos que já aparecem no dashboard.
 */
export const getPerformanceColor = (pct: number) => {
  if (pct <= 20) return '#FF0000';
  if (pct <= 40) return '#FF6600';
  if (pct <= 60) return '#FFCC00';
  if (pct <= 80) return '#99CC00';
  if (pct <= 100) return '#00CC00';
  return '#009900';
};
