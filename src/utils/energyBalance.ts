import { SEX_ADJUSTMENT } from './cardioCalories';
import { kgToLb } from './units';
import type { NutritionGoal, Sex } from '../types/database';

/** Target daily net (intake minus burn) per body-composition goal. Flat,
 * population-typical numbers rather than a per-user rate — same rationale
 * as NEAT_BASELINE_CALORIES below: a reasonable deterministic default now,
 * refinable later rather than blocking Phase 1 on a settings UI for it. */
export const TARGET_NET_CALORIES_BY_GOAL: Record<NutritionGoal, number> = {
  cut: -500,
  bulk: 300,
  maintain: 0,
};

/** Flat non-exercise-activity-calories allowance added on top of BMR to
 * approximate TDEE — the same kind of population-average placeholder
 * BASE_MET's lookup table is in cardioCalories.ts, refinable later from a
 * connected wearable's own measured burn (this app already has Whoop
 * integration) instead of a flat number. */
export const NEAT_BASELINE_CALORIES = 500;

/** Resistance-training MET used for a completed strength session, which has
 * no cardio_log_entries side table of its own — a cardio session already
 * gets a real per-activity estimate via estimateCardioCalories; a lifting
 * day gets this flat reference value instead of contributing 0 to "calories
 * out". Compendium of Physical Activities, moderate resistance training. */
const RESISTANCE_TRAINING_MET = 5.0;

/** Used only when a profile is missing the weight/height/age/sex a real BMR
 * needs — a population-average placeholder so the energy card still shows
 * something before onboarding collects full body stats, rather than
 * blocking on them. computeDailyEnergyTotals flags when this was used via
 * `hasEnoughProfileData`, so callers can caveat the number if they want to. */
const FALLBACK_BMR = 1600;

export function calculateAge(birthDate: string, asOf: Date = new Date()): number {
  const birth = new Date(birthDate);
  let age = asOf.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    asOf.getMonth() > birth.getMonth() ||
    (asOf.getMonth() === birth.getMonth() && asOf.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

/**
 * Mifflin-St Jeor — the standard BMR formula. Computed client-side and
 * deterministically, same posture as estimateCardioCalories in
 * cardioCalories.ts (see that file's own comment: this app's "AI Coach" is
 * already entirely rule-based, not LLM-based, for arithmetic like this).
 */
export function calculateBmr(params: { weightKg: number; heightCm: number; age: number; sex: Sex }): number {
  const base = 10 * params.weightKg + 6.25 * params.heightCm - 5 * params.age;
  return Math.round(params.sex === 'male' ? base + 5 : base - 161);
}

/** Same MET x bodyweight(kg) x duration(hours) shape as
 * estimateCardioCalories, reusing its SEX_ADJUSTMENT rather than
 * duplicating the male/female correction factor. */
export function estimateStrengthSessionCalories(params: {
  durationMinutes: number;
  weightKg: number;
  sex?: Sex | null;
}): number {
  const hours = params.durationMinutes / 60;
  const adjustment = params.sex ? SEX_ADJUSTMENT[params.sex] : 1;
  return Math.round(RESISTANCE_TRAINING_MET * params.weightKg * hours * adjustment);
}

export type DailyEnergyTotalsParams = {
  /** Today's food_log_entries rows — raw snake_case fields, so callers can
   * pass query rows straight through with no adapter step. */
  foodEntries: Array<{ calories: number; protein_g: number; carbs_g: number; fat_g: number }>;
  /** Minutes spent in today's completed strength sessions (workout_logs with
   * no matching cardio_log_entries row) — summed from started_at/completed_at. */
  strengthSessionMinutes: number;
  /** Sum of today's cardio_log_entries.estimated_calories — already a real
   * per-activity estimate, just totaled here. */
  cardioCalories: number;
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: Sex | null;
  goal: NutritionGoal;
};

export type DailyEnergyTotals = {
  caloriesIn: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  bmr: number;
  /** BMR + NEAT_BASELINE_CALORIES. */
  baseOut: number;
  /** Cardio + strength-session burn on top of baseOut. */
  workoutOut: number;
  caloriesOut: number;
  /** caloriesOut + the goal's target net — the intake that would hit the
   * goal exactly today. */
  targetIntake: number;
  net: number;
  remaining: number;
  /** False when weight/height/age/sex weren't all available and `bmr` fell
   * back to FALLBACK_BMR — lets the UI caveat the number instead of
   * presenting a population-average guess as a personalized one. */
  hasEnoughProfileData: boolean;
};

/**
 * Default macro targets for a user with no per-user macro plan yet: protein
 * at 1g per lb of bodyweight (the standard strength-training heuristic),
 * then the goal's own target calories split between carbs/fat by a typical
 * ratio. A placeholder in the same spirit as NEAT_BASELINE_CALORIES —
 * replaced by a real per-user macro plan in a later phase, not this one.
 */
export function computeMacroTargets(params: {
  weightKg: number | null;
  targetIntake: number;
  goal: NutritionGoal;
}): { proteinTargetG: number; carbsTargetG: number; fatTargetG: number } {
  const proteinTargetG = params.weightKg != null ? Math.round(kgToLb(params.weightKg)) : 150;
  const proteinCalories = proteinTargetG * 4;
  const remainingCalories = Math.max(0, params.targetIntake - proteinCalories);
  const fatTargetG = Math.round((remainingCalories * 0.35) / 9);
  const carbsTargetG = Math.round((remainingCalories * 0.65) / 4);
  return { proteinTargetG, carbsTargetG, fatTargetG };
}

export function computeDailyEnergyTotals(params: DailyEnergyTotalsParams): DailyEnergyTotals {
  const caloriesIn = params.foodEntries.reduce((sum, e) => sum + e.calories, 0);
  const proteinG = params.foodEntries.reduce((sum, e) => sum + e.protein_g, 0);
  const carbsG = params.foodEntries.reduce((sum, e) => sum + e.carbs_g, 0);
  const fatG = params.foodEntries.reduce((sum, e) => sum + e.fat_g, 0);

  const hasEnoughProfileData =
    params.weightKg != null && params.heightCm != null && params.age != null && params.sex != null;
  const bmr = hasEnoughProfileData
    ? calculateBmr({
        weightKg: params.weightKg as number,
        heightCm: params.heightCm as number,
        age: params.age as number,
        sex: params.sex as Sex,
      })
    : FALLBACK_BMR;

  const strengthCalories =
    params.weightKg != null && params.strengthSessionMinutes > 0
      ? estimateStrengthSessionCalories({
          durationMinutes: params.strengthSessionMinutes,
          weightKg: params.weightKg,
          sex: params.sex,
        })
      : 0;

  const baseOut = bmr + NEAT_BASELINE_CALORIES;
  const workoutOut = params.cardioCalories + strengthCalories;
  const caloriesOut = baseOut + workoutOut;
  const targetIntake = caloriesOut + TARGET_NET_CALORIES_BY_GOAL[params.goal];
  const net = caloriesIn - caloriesOut;
  const remaining = targetIntake - caloriesIn;

  return {
    caloriesIn,
    proteinG,
    carbsG,
    fatG,
    bmr,
    baseOut,
    workoutOut,
    caloriesOut,
    targetIntake,
    net,
    remaining,
    hasEnoughProfileData,
  };
}
