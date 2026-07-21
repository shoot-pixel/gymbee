import type { UnitPreference } from '../types/database';

/** Exact international avoirdupois pound. */
const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/**
 * Display-only rounding — never applied to what's persisted. kg rounds to
 * 1 decimal; lb rounds to the nearest 0.5, the typical plate/dumbbell
 * increment.
 */
export function roundForDisplay(value: number, pref: UnitPreference): number {
  return pref === 'kg' ? Math.round(value * 10) / 10 : Math.round(value * 2) / 2;
}

/** Canonical kg storage -> a display string in the given preference. */
export function formatWeight(kg: number | null | undefined, pref: UnitPreference): string {
  if (kg == null) return '';
  const converted = pref === 'kg' ? kg : kgToLb(kg);
  return String(roundForDisplay(converted, pref));
}

/**
 * User-typed text in the given preference -> kg for storage. Returns null on
 * invalid/empty input. Full precision — only the numeric(6,2) column itself
 * rounds on write, same as today.
 */
export function parseWeightInput(value: string, pref: UnitPreference): number | null {
  if (value.trim() === '') return null;
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) return null;
  return pref === 'kg' ? parsed : lbToKg(parsed);
}

export function unitLabel(pref: UnitPreference): string {
  return pref === 'kg' ? 'kg' : 'lb';
}

/** Large aggregate values (e.g. total volume) — whole number with thousands separators. */
export function formatVolume(kg: number, pref: UnitPreference): string {
  const converted = pref === 'kg' ? kg : kgToLb(kg);
  return Math.round(converted).toLocaleString();
}
