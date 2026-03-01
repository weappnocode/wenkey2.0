import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { calculateDeadlineProgress } from './deadlineProgress';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toTitleCase(str: string | null | undefined) {
  if (!str) return "";
  const exceptions = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'o', 'a', 'os', 'as', 'um', 'uma', 'por', 'pelo', 'pela', 'pelos', 'pelas'];
  return str
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && exceptions.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

type ForecastStatus = 'on_track' | 'at_risk' | 'off_track' | 'not_applicable';

interface ForecastResult {
  status: ForecastStatus;
  projectedValue: number;
  message: string;
}

export function calculateForecast(
  baseline: number | null,
  target: number | null,
  current: number,
  direction: string | null,
  startDateStr: string,
  endDateStr: string
): ForecastResult {
  if (baseline === null || target === null || !startDateStr || !endDateStr) {
    return { status: 'not_applicable', projectedValue: 0, message: 'Dados insuficientes' };
  }

  const start = new Date(startDateStr).getTime();
  const end = new Date(endDateStr).getTime();
  const today = new Date().getTime();

  // If before start date
  if (today < start) {
    return { status: 'not_applicable', projectedValue: 0, message: 'Quarter ainda não começou' };
  }

  // Se o Quarter já acabou, não prever, apenas avaliar aonde parou
  if (today > end) {
    return { status: 'not_applicable', projectedValue: current, message: 'Quarter finalizado' };
  }

  const totalTime = end - start;
  const elapsedTime = today - start;
  const timeProgress = elapsedTime / totalTime;

  // Só calcular se passou pelo menos 5% do Quarter para evitar loucura de projeção no 1º dia
  if (timeProgress < 0.05 && current === baseline) {
    return { status: 'not_applicable', projectedValue: 0, message: 'Muito recente para prever' };
  }

  // Previsão linear:
  // Se ele andou (current - baseline) em (elapsedTime)
  // Quanto andará no (totalTime)?
  const totalDifference = target - baseline;
  const achievedDifference = current - baseline;

  // Rate (velocidade) = o que atingimos / tempo que passou
  const rate = achievedDifference / timeProgress;

  // Onde vamos parar no dia 1.0 do Quarter (fim)
  const projectedDifference = rate; // rate * 1 (100% do quarter)
  const projectedValue = baseline + projectedDifference;

  // Convert to Atterment (o quanto ele atingiria em porcentagem da meta)
  let projectedAttainment = 0;

  if (direction === 'decrease' || direction === 'Reduzir') {
    if (baseline <= target) {
      projectedAttainment = 0; // caso inválido (baseline menor q target pra reduzir)
    } else {
      projectedAttainment = ((baseline - projectedValue) / (baseline - target)) * 100;
    }
  } else {
    // Default: Aumentar
    if (target <= baseline) {
      projectedAttainment = 0;
    } else {
      projectedAttainment = ((projectedValue - baseline) / (target - baseline)) * 100;
    }
  }

  let status: ForecastStatus = 'on_track';
  if (projectedAttainment >= 90) {
    status = 'on_track';
  } else if (projectedAttainment >= 60) {
    status = 'at_risk';
  } else {
    status = 'off_track';
  }

  return {
    status,
    projectedValue,
    message: ''
  };
}

export const calculateSimpleAttainment = (
  realized: number | null,
  target: number | null,
  direction: string | null,
  type?: string | null
): number | null => {
  if (target === null || target === undefined || Number.isNaN(Number(target)) || Number(target) === 0) return null;
  const safeRealized = (realized === null || realized === undefined || Number.isNaN(Number(realized))) ? null : Number(realized);
  if (safeRealized === null) return null;

  const safeTarget = Number(target);

  if (type === 'date' || type === 'data') {
    return null;
  }

  if (!direction || direction === 'increase' || direction === 'maior-é-melhor') {
    return (safeRealized / safeTarget) * 100;
  } else {
    if (safeRealized <= safeTarget) return 100;
    return (safeTarget / safeRealized) * 100;
  }
};

export const calculateKR = (
  realized: number | null,
  min: number | null,
  target: number | null,
  direction: string | null,
  type?: string | null
): number | null => {
  // Basic safety
  if (target === null || target === undefined || Number.isNaN(Number(target))) return null;

  const safeTarget = Number(target);
  const safeRealized = (realized === null || realized === undefined || Number.isNaN(Number(realized))) ? null : Number(realized);
  const safeMin = (min !== null && min !== undefined) ? Number(min) : null;

  // Lógica específica para DATAS
  if (type === 'date' || type === 'data') {
    if (safeRealized === null) return null;
    const limit = safeMin !== null ? safeMin : safeTarget;
    return calculateDeadlineProgress(safeTarget, limit, safeRealized);
  }

  if (safeRealized === null) return null;

  // Logic for "Increase" / "Maior é melhor" (Default)
  if (!direction || direction === 'increase' || direction === 'maior-é-melhor') {

    // If Minimum Budget (Piso) is defined
    if (safeMin !== null) {
      // Realized >= Target -> 100%
      if (safeRealized >= safeTarget) return 100;

      // Realized < Min -> 0%
      if (safeRealized < safeMin) return 0;

      // Formula: ((Realized - Min) / (Target - Min)) * 100
      const denominator = safeTarget - safeMin;
      if (denominator === 0) return 0; // Avoid division by zero

      const result = ((safeRealized - safeMin) / denominator) * 100;
      return Math.max(0, Math.min(100, result));
    }

    // Fallback if no Min is defined (Simple percentage)
    if (safeTarget === 0) return 0;
    const result = (safeRealized / safeTarget) * 100;
    return Math.min(100, Math.max(0, result));
  }

  // Logic for "Decrease" (Menor é melhor)
  if (direction === 'decrease' || direction === 'menor-é-melhor') {
    if (safeRealized <= safeTarget) return 100;

    // Simple linear decay for now as no formula provided for decrease
    if (safeTarget === 0) return 0; // Prevent div by zero
    // Example: 200% - (Realized/Target)%
    const result = ((2 * safeTarget - safeRealized) / safeTarget) * 100;
    return Math.max(0, result);
  }

  return 0;
};

