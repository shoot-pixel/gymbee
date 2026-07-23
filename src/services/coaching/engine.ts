import { addDays, differenceInCalendarDays, format, subDays } from 'date-fns';
import { estimateOneRepMax } from '../api/queries/progress';
import type { LoggedSet, PrEvent } from '../api/queries/progress';
import { estimateWorkoutMinutes } from '../../utils/workoutTiming';
import type { EquipmentType, ExerciseCategory, MovementPattern, WorkoutVariantType } from '../../types/database';
import type {
  AdaptationChange,
  AdaptationExerciseTarget,
  AdaptScheduledWorkoutParams,
  CoachingEngine,
  DetectTrainingPatternsParams,
  ExerciseExplanationResult,
  ExerciseImprovement,
  ExerciseInconsistency,
  ExerciseMetadata,
  ExercisePerformanceDelta,
  ExerciseRpeTrendInput,
  ExerciseSubstitution,
  GenerateExerciseExplanationParams,
  GeneratePostWorkoutSummaryParams,
  GenerateTodayFocusSummaryParams,
  GenerateWeeklyReviewParams,
  GenerateWorkoutVariantParams,
  MissedWeekdayInput,
  MuscleGroupVolume,
  PainRiskAssessment,
  PredictPersonalRecordsParams,
  PrPrediction,
  PostWorkoutBestSet,
  PostWorkoutSummaryResult,
  ReadinessBand,
  ReadinessFactor,
  ReadinessInputs,
  ReadinessResult,
  RecommendNextSetParams,
  RecommendSubstitutionParams,
  RecoveryNeed,
  RpeAdherence,
  SetRecommendation,
  SubstitutionMatchSignal,
  TodayFocusSummaryResult,
  TrainingLoadClassification,
  TrainingLoadResult,
  TrainingPattern,
  WeeklyPatternSnapshot,
  WeeklyReviewResult,
  WorkoutVariantChange,
  WorkoutVariantExercise,
  WorkoutVariantResult,
} from './types';

const SEVERE_PAIN_KEYWORDS = [
  'chest pain',
  'dizzy',
  'dizziness',
  'faint',
  'fainting',
  "can't breathe",
  'cannot breathe',
  'numbness',
  'numb',
  'shortness of breath',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function bandLabel(band: ReadinessBand): string {
  switch (band) {
    case 'high':
      return 'strong';
    case 'moderate':
      return 'moderate';
    case 'low':
      return 'lower than usual';
    case 'very_low':
      return 'very low';
  }
}

function bandFromScore(score: number): ReadinessBand {
  if (score >= 80) return 'high';
  if (score >= 60) return 'moderate';
  if (score >= 40) return 'low';
  return 'very_low';
}

export class LocalCoachingEngine implements CoachingEngine {
  calculateTrainingLoad(sets: LoggedSet[], asOf: Date = new Date()): TrainingLoadResult {
    const acuteStart = subDays(asOf, 7);
    const chronicStart = subDays(asOf, 35);

    let acuteVolumeKg = 0;
    let chronicVolumeKg = 0;
    let hasChronicHistory = false;

    for (const set of sets) {
      if (set.loadKg == null) continue;
      const loggedAt = new Date(set.loggedAt);
      const volume = set.loadKg * set.reps;
      if (loggedAt >= acuteStart && loggedAt <= asOf) {
        acuteVolumeKg += volume;
      } else if (loggedAt >= chronicStart && loggedAt < acuteStart) {
        chronicVolumeKg += volume;
        hasChronicHistory = true;
      }
    }

    const chronicAvgVolumeKg = hasChronicHistory ? chronicVolumeKg / 4 : 0;
    const loadRatio = hasChronicHistory && chronicAvgVolumeKg > 0 ? acuteVolumeKg / chronicAvgVolumeKg : null;

    let classification: TrainingLoadResult['classification'] = 'unknown';
    if (loadRatio != null) {
      if (loadRatio < 0.8) classification = 'low';
      else if (loadRatio <= 1.3) classification = 'normal';
      else classification = 'high';
    }

    return { acuteVolumeKg, chronicAvgVolumeKg, loadRatio, classification };
  }

  assessPainRisk(hasPain: boolean, painNotes: string | null): PainRiskAssessment {
    if (!hasPain) {
      return { riskLevel: 'none', recommendation: 'No pain reported.', stopAndSeekMedicalAttention: false };
    }

    const normalizedNotes = (painNotes ?? '').toLowerCase();
    const matchesSevereKeyword = SEVERE_PAIN_KEYWORDS.some(keyword => normalizedNotes.includes(keyword));

    if (matchesSevereKeyword) {
      return {
        riskLevel: 'severe',
        recommendation:
          'What you described includes warning-sign symptoms (e.g. chest pain, dizziness, fainting, numbness). ' +
          'Stop this workout and seek appropriate medical attention. This is informational and not medical advice.',
        stopAndSeekMedicalAttention: true,
      };
    }

    if (normalizedNotes.length === 0) {
      return {
        riskLevel: 'low',
        recommendation: 'Pain reported without detail — go easy on the affected area and stop if it worsens.',
        stopAndSeekMedicalAttention: false,
      };
    }

    return {
      riskLevel: 'moderate',
      recommendation:
        'Pain reported today. Consider training around the affected area or reducing intensity. ' +
        'This is informational and not medical advice — see a professional if pain persists or worsens.',
      stopAndSeekMedicalAttention: false,
    };
  }

  evaluateReadiness(inputs: ReadinessInputs): ReadinessResult {
    const factors: ReadinessFactor[] = [];
    let deduction = 0;

    const checkin = inputs.checkin;

    // Sleep duration.
    if (checkin?.sleepHours != null) {
      const hours = checkin.sleepHours;
      let sleepDeduction = 0;
      if (hours < 5) sleepDeduction = 20;
      else if (hours < 6) sleepDeduction = 12;
      else if (hours < 7) sleepDeduction = 6;
      else if (hours <= 9) sleepDeduction = 0;
      else sleepDeduction = 3;
      deduction += sleepDeduction;
      factors.push({
        key: 'sleep',
        label: 'Sleep duration',
        impact: sleepDeduction > 0 ? 'negative' : 'neutral',
        weight: clamp(sleepDeduction / 100, 0, 1),
        detail: `Slept ${hours}h last night.`,
        available: true,
      });
    } else {
      factors.push({
        key: 'sleep',
        label: 'Sleep duration',
        impact: 'neutral',
        weight: 0,
        detail: 'No sleep data logged today.',
        available: false,
      });
    }

    // Sleep quality.
    if (checkin?.sleepQuality != null) {
      const qualityDeduction = clamp((5 - checkin.sleepQuality) * 2.5, 0, 10);
      deduction += qualityDeduction;
      factors.push({
        key: 'sleep_quality',
        label: 'Sleep quality',
        impact: qualityDeduction > 0 ? 'negative' : 'neutral',
        weight: clamp(qualityDeduction / 100, 0, 1),
        detail: `Self-rated sleep quality: ${checkin.sleepQuality}/5.`,
        available: true,
      });
    } else {
      factors.push({
        key: 'sleep_quality',
        label: 'Sleep quality',
        impact: 'neutral',
        weight: 0,
        detail: 'No sleep quality rating logged today.',
        available: false,
      });
    }

    // Soreness.
    if (checkin?.soreness != null) {
      const sorenessDeduction = clamp((checkin.soreness - 1) * 3.75, 0, 15);
      deduction += sorenessDeduction;
      factors.push({
        key: 'soreness',
        label: 'Muscle soreness',
        impact: sorenessDeduction > 0 ? 'negative' : 'neutral',
        weight: clamp(sorenessDeduction / 100, 0, 1),
        detail: `Self-rated soreness: ${checkin.soreness}/5.`,
        available: true,
      });
    } else {
      factors.push({
        key: 'soreness',
        label: 'Muscle soreness',
        impact: 'neutral',
        weight: 0,
        detail: 'No soreness rating logged today.',
        available: false,
      });
    }

    // Stress.
    if (checkin?.stress != null) {
      const stressDeduction = clamp((checkin.stress - 1) * 2.5, 0, 10);
      deduction += stressDeduction;
      factors.push({
        key: 'stress',
        label: 'Stress level',
        impact: stressDeduction > 0 ? 'negative' : 'neutral',
        weight: clamp(stressDeduction / 100, 0, 1),
        detail: `Self-rated stress: ${checkin.stress}/5.`,
        available: true,
      });
    } else {
      factors.push({
        key: 'stress',
        label: 'Stress level',
        impact: 'neutral',
        weight: 0,
        detail: 'No stress rating logged today.',
        available: false,
      });
    }

    // Pain.
    const painRisk = this.assessPainRisk(checkin?.hasPain ?? false, checkin?.painNotes ?? null);
    const painDeductionMap: Record<typeof painRisk.riskLevel, number> = {
      none: 0,
      low: 10,
      moderate: 20,
      severe: 35,
    };
    const painDeduction = checkin ? painDeductionMap[painRisk.riskLevel] : 0;
    deduction += painDeduction;
    factors.push({
      key: 'pain',
      label: 'Reported pain',
      impact: painDeduction > 0 ? 'negative' : 'neutral',
      weight: clamp(painDeduction / 100, 0, 1),
      detail: checkin?.hasPain ? painRisk.recommendation : 'No pain reported today.',
      available: checkin != null,
    });

    // Wearable recovery (Whoop). Thresholds mirror Whoop's own red/yellow/
    // green recovery bands so the language stays recognizable to Whoop
    // users. Max deduction (30) is in the same range as the pain factor's
    // max (35) — an objective physiological signal should move the needle
    // meaningfully without swamping every self-reported factor combined.
    if (inputs.wearable != null) {
      const recovery = inputs.wearable.recoveryScore;
      let wearableDeduction = 0;
      if (recovery < 33) wearableDeduction = 30;
      else if (recovery < 66) wearableDeduction = 15;
      else if (recovery >= 90) wearableDeduction = -5;
      deduction += wearableDeduction;
      factors.push({
        key: 'wearable_recovery',
        label: 'Whoop recovery',
        impact: wearableDeduction > 0 ? 'negative' : wearableDeduction < 0 ? 'positive' : 'neutral',
        weight: clamp(Math.abs(wearableDeduction) / 100, 0, 1),
        detail: `Whoop recovery is ${recovery}% today.`,
        available: true,
      });
    } else {
      factors.push({
        key: 'wearable_recovery',
        label: 'Whoop recovery',
        impact: 'neutral',
        weight: 0,
        detail: 'No Whoop data available today.',
        available: false,
      });
    }

    // Training load.
    const loadDeductionMap: Record<TrainingLoadResult['classification'], number> = {
      low: -5,
      normal: 0,
      high: 15,
      unknown: 0,
    };
    const loadDeduction = loadDeductionMap[inputs.trainingLoad.classification];
    deduction += loadDeduction;
    factors.push({
      key: 'training_load',
      label: 'Recent training load',
      impact: loadDeduction > 0 ? 'negative' : loadDeduction < 0 ? 'positive' : 'neutral',
      weight: clamp(Math.abs(loadDeduction) / 100, 0, 1),
      detail:
        inputs.trainingLoad.classification === 'unknown'
          ? 'Not enough training history yet to estimate load.'
          : `This week's volume looks ${inputs.trainingLoad.classification} relative to your recent average.`,
      available: inputs.trainingLoad.classification !== 'unknown',
    });

    // Time since last workout.
    if (inputs.daysSinceLastWorkout != null) {
      const days = inputs.daysSinceLastWorkout;
      let timeDeduction = 0;
      if (days <= 0) timeDeduction = 5;
      else if (days >= 2 && days <= 3) timeDeduction = -3;
      else if (days >= 7) timeDeduction = 8;
      deduction += timeDeduction;
      factors.push({
        key: 'time_since_last_workout',
        label: 'Time since last workout',
        impact: timeDeduction > 0 ? 'negative' : timeDeduction < 0 ? 'positive' : 'neutral',
        weight: clamp(Math.abs(timeDeduction) / 100, 0, 1),
        detail: days <= 0 ? 'You already trained today.' : `${days} day(s) since your last workout.`,
        available: true,
      });
    } else {
      factors.push({
        key: 'time_since_last_workout',
        label: 'Time since last workout',
        impact: 'neutral',
        weight: 0,
        detail: 'No prior workout history yet.',
        available: false,
      });
    }

    // Missed workouts.
    const missed = inputs.missedWorkoutsLast14Days;
    const missedDeduction = missed >= 3 ? 8 : missed === 2 ? 5 : missed === 1 ? 2 : 0;
    deduction += missedDeduction;
    factors.push({
      key: 'missed_workouts',
      label: 'Recent consistency',
      impact: missedDeduction > 0 ? 'negative' : 'neutral',
      weight: clamp(missedDeduction / 100, 0, 1),
      detail:
        missed === 0
          ? 'No missed workouts in the last two weeks.'
          : `${missed} missed workout(s) in the last two weeks.`,
      available: true,
    });

    const score = clamp(Math.round(100 - deduction), 0, 100);
    const band = bandFromScore(score);

    const intensityMap: Record<ReadinessBand, ReadinessResult['recommendedIntensity']> = {
      high: 'full',
      moderate: 'reduced',
      low: 'light',
      very_low: 'recovery_only',
    };
    const rpeRangeMap: Record<ReadinessBand, [number, number]> = {
      high: [7, 9],
      moderate: [6, 8],
      low: [5, 7],
      very_low: [3, 5],
    };
    const qualityMap: Record<ReadinessBand, ReadinessResult['estimatedSessionQuality']> = {
      high: 'excellent',
      moderate: 'good',
      low: 'fair',
      very_low: 'poor',
    };

    const sortedFactors = [...factors].sort((a, b) => b.weight - a.weight);
    const topNegative = sortedFactors.filter(f => f.available && f.impact === 'negative').slice(0, 2);
    const summary =
      topNegative.length === 0
        ? `Readiness appears ${bandLabel(band)} today.`
        : `Readiness appears ${bandLabel(band)} today — ${topNegative
            .map(f => f.label.toLowerCase())
            .join(' and ')} may be the main factors.`;

    return {
      score,
      band,
      factors: sortedFactors,
      recommendedIntensity: intensityMap[band],
      recommendedRpeRange: rpeRangeMap[band],
      estimatedSessionQuality: qualityMap[band],
      summary,
      computedAt: new Date().toISOString(),
    };
  }

  adaptScheduledWorkout({ exercises, readiness, painRisk }: AdaptScheduledWorkoutParams): AdaptationChange[] {
    const changes: AdaptationChange[] = [];
    const now = Date.now();
    let idCounter = 0;
    const nextId = () => `adapt-${now}-${idCounter++}`;

    if (painRisk.riskLevel === 'severe' || readiness.band === 'very_low') {
      const reason =
        painRisk.riskLevel === 'severe'
          ? 'Reported pain matches warning-sign language — recommending recovery/mobility work instead of today’s planned session.'
          : readiness.summary;
      changes.push({
        id: nextId(),
        adaptationType: 'recovery_replacement',
        targetExerciseId: null,
        fieldChanged: 'workout_type',
        originalValue: 'planned_workout',
        updatedValue: 'recovery_or_mobility',
        reason,
        confidence: painRisk.riskLevel === 'severe' ? 0.9 : 0.7,
        source: 'rule_engine',
      });

      // No exercise-substitution catalog exists yet (deferred to a later phase), so
      // there's no real mobility/recovery session to swap in. Accepting the change
      // above still needs to do *something* concrete to the planned workout, so pair
      // it with an aggressive, purely numeric pullback on the existing exercises
      // rather than leaving "recovery_replacement" as a decision with no effect.
      for (const exercise of exercises) {
        const reducedSets = Math.max(1, Math.ceil(exercise.targetSets / 2));
        if (reducedSets < exercise.targetSets) {
          changes.push({
            id: nextId(),
            adaptationType: 'reduce_sets',
            targetExerciseId: exercise.exerciseId,
            fieldChanged: 'target_sets',
            originalValue: exercise.targetSets,
            updatedValue: reducedSets,
            reason,
            confidence: 0.65,
            source: 'rule_engine',
          });
        }
        if (exercise.targetRpe != null) {
          changes.push({
            id: nextId(),
            adaptationType: 'reduce_rpe',
            targetExerciseId: exercise.exerciseId,
            fieldChanged: 'target_rpe',
            originalValue: exercise.targetRpe,
            updatedValue: Math.max(3, exercise.targetRpe - 2),
            reason,
            confidence: 0.65,
            source: 'rule_engine',
          });
        }
        changes.push({
          id: nextId(),
          adaptationType: 'increase_rest',
          targetExerciseId: exercise.exerciseId,
          fieldChanged: 'rest_seconds',
          originalValue: exercise.restSeconds,
          updatedValue: (exercise.restSeconds ?? 90) + 45,
          reason,
          confidence: 0.6,
          source: 'rule_engine',
        });
      }
      return changes;
    }

    if (readiness.band === 'low') {
      for (const exercise of exercises) {
        if (exercise.targetSets > 1) {
          changes.push({
            id: nextId(),
            adaptationType: 'reduce_sets',
            targetExerciseId: exercise.exerciseId,
            fieldChanged: 'target_sets',
            originalValue: exercise.targetSets,
            updatedValue: exercise.targetSets - 1,
            reason: readiness.summary,
            confidence: 0.6,
            source: 'rule_engine',
          });
        }
        const currentRest = exercise.restSeconds ?? 90;
        changes.push({
          id: nextId(),
          adaptationType: 'increase_rest',
          targetExerciseId: exercise.exerciseId,
          fieldChanged: 'rest_seconds',
          originalValue: exercise.restSeconds,
          updatedValue: currentRest + 30,
          reason: 'Extra rest to help manage today’s lower readiness.',
          confidence: 0.55,
          source: 'rule_engine',
        });
        if (exercise.targetRpe != null) {
          changes.push({
            id: nextId(),
            adaptationType: 'reduce_rpe',
            targetExerciseId: exercise.exerciseId,
            fieldChanged: 'target_rpe',
            originalValue: exercise.targetRpe,
            updatedValue: Math.max(4, exercise.targetRpe - 1),
            reason: readiness.summary,
            confidence: 0.55,
            source: 'rule_engine',
          });
        }
      }
      return changes;
    }

    if (readiness.band === 'moderate' && painRisk.riskLevel !== 'none') {
      for (const exercise of exercises) {
        if (exercise.targetRpe != null) {
          changes.push({
            id: nextId(),
            adaptationType: 'reduce_rpe',
            targetExerciseId: exercise.exerciseId,
            fieldChanged: 'target_rpe',
            originalValue: exercise.targetRpe,
            updatedValue: Math.max(4, exercise.targetRpe - 0.5),
            reason: painRisk.recommendation,
            confidence: 0.5,
            source: 'rule_engine',
          });
        }
      }
    }

    return changes;
  }

  recommendNextSet({ target, completedSets, nextSetNumber, readinessBand }: RecommendNextSetParams): SetRecommendation | null {
    if (completedSets.length === 0) return null;

    const lastSet = completedSets[completedSets.length - 1];
    const firstSet = completedSets[0];
    const prevSet = completedSets.length >= 2 ? completedSets[completedSets.length - 2] : null;
    const hasLoad = target.targetLoadKg != null || lastSet.loadKg != null;
    const baseLoad = lastSet.loadKg ?? target.targetLoadKg ?? 0;
    const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 1. Severe decline — safety-first, same priority position as adaptScheduledWorkout's pain checks.
    const repsCratered = completedSets.length >= 2 && firstSet.reps > 0 && lastSet.reps <= firstSet.reps * 0.5;
    const twoHighRpeInARow =
      prevSet?.rpe != null && prevSet.rpe >= 9.5 && lastSet.rpe != null && lastSet.rpe >= 9.5;
    if (repsCratered || twoHighRpeInARow) {
      return {
        id,
        type: 'stop_exercise',
        recommendedReps: null,
        recommendedLoadKg: null,
        recommendedRpe: null,
        recommendedRestSeconds: null,
        reason: repsCratered
          ? `Reps dropped sharply from your first set (${firstSet.reps} → ${lastSet.reps}) — consider stopping this exercise for today.`
          : 'Two sets in a row at max effort — consider stopping this exercise for today.',
        confidence: repsCratered ? 0.6 : 0.65,
        source: 'rule_engine',
      };
    }

    // 2. An add-on set beyond the plan came in weak — offer to drop it rather than count it.
    if (
      target.targetSets != null &&
      lastSet.setNumber > target.targetSets &&
      target.targetRepsMin != null &&
      lastSet.reps < target.targetRepsMin
    ) {
      return {
        id,
        type: 'remove_last_set',
        recommendedReps: null,
        recommendedLoadKg: null,
        recommendedRpe: null,
        recommendedRestSeconds: null,
        reason: 'That extra set came in under your rep range — you can remove it without affecting your planned work.',
        confidence: 0.5,
        source: 'rule_engine',
      };
    }

    const missedTarget = target.targetRepsMin != null && lastSet.reps < target.targetRepsMin;
    const nearFailure = lastSet.rpe != null && lastSet.rpe >= 9.5;

    // 3. Missed the rep target or right at failure, with more sets planned.
    if (nextSetNumber != null && (missedTarget || nearFailure)) {
      if (hasLoad) {
        return {
          id,
          type: 'reduce_weight',
          recommendedReps: null,
          recommendedLoadKg: roundToHalf(baseLoad * 0.9),
          recommendedRpe: null,
          recommendedRestSeconds: null,
          reason: missedTarget
            ? 'You came in under your rep target — dropping the weight slightly for the next set.'
            : 'That set was at max effort — dropping the weight slightly for the next set.',
          confidence: 0.65,
          source: 'rule_engine',
        };
      }
      return {
        id,
        type: 'adjust_reps',
        recommendedReps: Math.max(1, (target.targetRepsMin ?? lastSet.reps) - 2),
        recommendedLoadKg: null,
        recommendedRpe: null,
        recommendedRestSeconds: null,
        reason: 'That rep range looked tough today — aiming a little lower for the next set.',
        confidence: 0.6,
        source: 'rule_engine',
      };
    }

    // 4. RPE climbing fast between sets — more fatigue than expected, add rest before the next one.
    if (nextSetNumber != null && prevSet?.rpe != null && lastSet.rpe != null && lastSet.rpe - prevSet.rpe >= 1.5) {
      return {
        id,
        type: 'increase_rest',
        recommendedReps: null,
        recommendedLoadKg: null,
        recommendedRpe: null,
        recommendedRestSeconds: (target.restSeconds ?? 90) + 30,
        reason: 'Effort jumped a lot between sets — a bit more rest before the next one.',
        confidence: 0.55,
        source: 'rule_engine',
      };
    }

    const hitTopOfRange =
      target.targetRepsMax != null &&
      lastSet.reps >= target.targetRepsMax &&
      (lastSet.rpe == null ||
        (target.targetRpe != null && lastSet.rpe <= target.targetRpe - 1) ||
        (target.targetRpe == null && lastSet.rpe <= 7));

    // 5. Comfortably hit the top of the rep range — progress it, unless readiness already flagged today as low.
    if (nextSetNumber != null && hitTopOfRange) {
      if (readinessBand === 'low' || readinessBand === 'very_low') {
        return {
          id,
          type: 'keep_weight',
          recommendedReps: lastSet.reps,
          recommendedLoadKg: lastSet.loadKg,
          recommendedRpe: null,
          recommendedRestSeconds: null,
          reason: 'Strong set, but today\'s readiness is lower than usual — holding steady instead of adding weight.',
          confidence: 0.55,
          source: 'rule_engine',
        };
      }
      if (hasLoad) {
        return {
          id,
          type: 'increase_weight',
          recommendedReps: null,
          recommendedLoadKg: roundToHalf(baseLoad * 1.025),
          recommendedRpe: null,
          recommendedRestSeconds: null,
          reason: 'You hit the top of your rep range comfortably — try a bit more weight next set.',
          confidence: 0.6,
          source: 'rule_engine',
        };
      }
      return {
        id,
        type: 'adjust_reps',
        recommendedReps: (target.targetRepsMax ?? lastSet.reps) + 2,
        recommendedLoadKg: null,
        recommendedRpe: null,
        recommendedRestSeconds: null,
        reason: 'You hit the top of your rep range comfortably — aiming a bit higher next set.',
        confidence: 0.55,
        source: 'rule_engine',
      };
    }

    // 6. Right on target — repeat it.
    const onTarget =
      target.targetRepsMin != null &&
      lastSet.reps >= target.targetRepsMin &&
      (target.targetRepsMax == null || lastSet.reps <= target.targetRepsMax);
    if (nextSetNumber != null && onTarget) {
      return {
        id,
        type: 'keep_weight',
        recommendedReps: lastSet.reps,
        recommendedLoadKg: lastSet.loadKg,
        recommendedRpe: null,
        recommendedRestSeconds: null,
        reason: 'Right on target — repeat this weight and reps.',
        confidence: 0.65,
        source: 'rule_engine',
      };
    }

    return null;
  }

  /**
   * Shared scoring/filtering core for equipment- and pattern-aware exercise
   * matching — used both by the public recommendExerciseSubstitution and
   * internally by generateWorkoutVariant's equipment/impact strategies, so
   * there's exactly one ranking algorithm rather than two that can drift.
   */
  private rankSubstitutes(
    exercise: ExerciseMetadata,
    candidates: ExerciseMetadata[],
    availableEquipment: EquipmentType[] | null,
    excludeEquipment: EquipmentType | undefined,
    preferLowerJointStress = false,
  ): Array<{ candidate: ExerciseMetadata; score: number; matchedOn: SubstitutionMatchSignal[] }> {
    const scored: Array<{ candidate: ExerciseMetadata; score: number; matchedOn: SubstitutionMatchSignal[] }> = [];

    for (const candidate of candidates) {
      if (candidate.id === exercise.id) continue;
      if (excludeEquipment && candidate.equipment === excludeEquipment) continue;
      if (
        availableEquipment != null &&
        candidate.equipment !== 'bodyweight' &&
        !availableEquipment.includes(candidate.equipment)
      ) {
        continue;
      }

      const matchedOn: SubstitutionMatchSignal[] = [];
      let score = 0;

      if (exercise.movementPattern != null && candidate.movementPattern === exercise.movementPattern) {
        score += 3;
        matchedOn.push('movement_pattern');
      }
      if (candidate.primaryMuscle === exercise.primaryMuscle) {
        score += 2;
        matchedOn.push('primary_muscle');
      }
      if (candidate.category === exercise.category) {
        score += 1;
        matchedOn.push('category');
      }
      const secondaryOverlap = candidate.secondaryMuscles.some(m => exercise.secondaryMuscles.includes(m));
      if (secondaryOverlap) {
        score += 1;
        matchedOn.push('secondary_muscle');
      }
      if (
        exercise.difficulty != null &&
        candidate.difficulty != null &&
        Math.abs(DIFFICULTY_ORDER[exercise.difficulty] - DIFFICULTY_ORDER[candidate.difficulty]) >= 2
      ) {
        score -= 1;
      }
      if (
        preferLowerJointStress &&
        exercise.jointStress != null &&
        candidate.jointStress != null &&
        JOINT_STRESS_ORDER[candidate.jointStress] < JOINT_STRESS_ORDER[exercise.jointStress]
      ) {
        score += 2;
      }

      if (score > 0) scored.push({ candidate, score, matchedOn });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  recommendExerciseSubstitution({
    exercise,
    candidates,
    availableEquipment,
    excludeEquipment,
  }: RecommendSubstitutionParams): ExerciseSubstitution[] {
    const scored = this.rankSubstitutes(exercise, candidates, availableEquipment, excludeEquipment);

    return scored.slice(0, 5).map(({ candidate, score, matchedOn }) => ({
      id: `sub-${Date.now()}-${candidate.id}`,
      exerciseId: candidate.id,
      exerciseName: candidate.name,
      reason: buildSubstitutionReason(exercise, candidate, matchedOn),
      confidence: clamp(score / 7, 0.3, 0.9),
      matchedOn,
    }));
  }

  generateWorkoutVariant({
    source,
    variantType,
    candidates,
    availableEquipment,
  }: GenerateWorkoutVariantParams): WorkoutVariantResult {
    let working = source.map(e => ({ metadata: e.metadata, target: { ...e.target } }));
    const changes = new Map<string, WorkoutVariantChange>();
    for (const e of working) {
      changes.set(e.target.exerciseId, {
        exerciseId: e.target.exerciseId,
        type: 'kept',
        reason: VARIANT_DESCRIPTIONS[variantType],
      });
    }

    switch (variantType) {
      case 'full':
        break;
      case 'time_45':
        working = this.fitToTimeBudget(working, 45, changes);
        break;
      case 'time_30':
        working = this.fitToTimeBudget(working, 30, changes);
        break;
      case 'hotel':
      case 'home':
      case 'bodyweight': {
        const allowlist = equipmentAllowlistFor(variantType, availableEquipment);
        working = working.map(e => this.applyEquipmentConstraint(e, candidates, allowlist, changes));
        break;
      }
      case 'low_readiness':
        working = working.map(e => this.applyLowReadiness(e, changes));
        break;
      case 'strength_focus':
        working = working.map(e => this.applyStrengthFocus(e, changes));
        break;
      case 'hypertrophy_focus':
        working = working.map(e => this.applyHypertrophyFocus(e, changes));
        break;
      case 'reduced_impact':
        working = working.map(e => this.applyReducedImpact(e, candidates, changes));
        break;
    }

    const exercises: WorkoutVariantExercise[] = working.map(e => ({
      exerciseId: e.target.exerciseId,
      exerciseName: e.metadata.name,
      targetSets: e.target.targetSets,
      targetRepsMin: e.target.targetRepsMin,
      targetRepsMax: e.target.targetRepsMax,
      targetLoadKg: e.target.targetLoadKg,
      targetRpe: e.target.targetRpe,
      restSeconds: e.target.restSeconds,
    }));

    return {
      variantType,
      label: VARIANT_LABELS[variantType],
      summary: VARIANT_DESCRIPTIONS[variantType],
      estimatedMinutes:
        estimateWorkoutMinutes(exercises.map(e => ({ targetSets: e.targetSets, restSeconds: e.restSeconds }))) ?? 0,
      exercises,
      changes: [...changes.values()],
    };
  }

  private fitToTimeBudget(
    working: Array<{ metadata: ExerciseMetadata; target: AdaptationExerciseTarget }>,
    budgetMinutes: number,
    changes: Map<string, WorkoutVariantChange>,
  ): Array<{ metadata: ExerciseMetadata; target: AdaptationExerciseTarget }> {
    let list = working;
    const minutes = () =>
      estimateWorkoutMinutes(list.map(e => ({ targetSets: e.target.targetSets, restSeconds: e.target.restSeconds }))) ?? 0;

    if (minutes() <= budgetMinutes) return list;

    // 1. Trim accessory sets by 1 (floor 1).
    for (const e of list) {
      if (minutes() <= budgetMinutes) break;
      if (!isCompoundPattern(e.metadata.movementPattern) && e.target.targetSets > 1) {
        e.target.targetSets -= 1;
        changes.set(e.target.exerciseId, {
          exerciseId: e.target.exerciseId,
          type: 'sets_reduced',
          reason: `Reduced to ${e.target.targetSets} sets to fit a ${budgetMinutes}-minute session.`,
        });
      }
    }

    // 2. Drop accessory exercises entirely, from the end, before ever touching a compound lift.
    for (let i = list.length - 1; i >= 0 && minutes() > budgetMinutes; i--) {
      if (!isCompoundPattern(list[i].metadata.movementPattern)) {
        const removed = list[i];
        changes.set(removed.target.exerciseId, {
          exerciseId: removed.target.exerciseId,
          type: 'dropped',
          reason: `Dropped to fit a ${budgetMinutes}-minute session — prioritizing your main lifts.`,
        });
        list = [...list.slice(0, i), ...list.slice(i + 1)];
      }
    }

    // 3. Only if compounds are all that's left and still over budget, lighten them too.
    for (const e of list) {
      if (minutes() <= budgetMinutes) break;
      if (e.target.targetSets > 2) {
        e.target.targetSets -= 1;
        changes.set(e.target.exerciseId, {
          exerciseId: e.target.exerciseId,
          type: 'sets_reduced',
          reason: `Reduced to ${e.target.targetSets} sets to fit a ${budgetMinutes}-minute session.`,
        });
      }
    }

    return list;
  }

  private applyEquipmentConstraint(
    e: { metadata: ExerciseMetadata; target: AdaptationExerciseTarget },
    candidates: ExerciseMetadata[],
    allowlist: EquipmentType[],
    changes: Map<string, WorkoutVariantChange>,
  ): { metadata: ExerciseMetadata; target: AdaptationExerciseTarget } {
    if (e.metadata.equipment === 'bodyweight' || allowlist.includes(e.metadata.equipment)) {
      return e;
    }
    const ranked = this.rankSubstitutes(e.metadata, candidates, allowlist, undefined);
    const best = ranked[0];
    if (!best) {
      changes.set(e.target.exerciseId, {
        exerciseId: e.target.exerciseId,
        type: 'kept',
        reason: `No equipment-compatible substitute found for ${e.metadata.name} — keeping it as planned.`,
      });
      return e;
    }
    changes.set(e.target.exerciseId, {
      exerciseId: e.target.exerciseId,
      type: 'substituted',
      reason: buildSubstitutionReason(e.metadata, best.candidate, best.matchedOn),
    });
    return { metadata: best.candidate, target: { ...e.target, exerciseId: best.candidate.id, targetLoadKg: null } };
  }

  private applyLowReadiness(
    e: { metadata: ExerciseMetadata; target: AdaptationExerciseTarget },
    changes: Map<string, WorkoutVariantChange>,
  ): { metadata: ExerciseMetadata; target: AdaptationExerciseTarget } {
    const target = { ...e.target };
    target.targetSets = Math.max(1, target.targetSets - 1);
    if (target.targetRpe != null) target.targetRpe = Math.max(4, target.targetRpe - 1);
    target.restSeconds = Math.round((target.restSeconds ?? 90) * 1.3);
    changes.set(e.target.exerciseId, {
      exerciseId: e.target.exerciseId,
      type: 'sets_reduced',
      reason: 'Lightened for a lower-readiness session — fewer sets, easier target RPE, more rest.',
    });
    return { metadata: e.metadata, target };
  }

  private applyStrengthFocus(
    e: { metadata: ExerciseMetadata; target: AdaptationExerciseTarget },
    changes: Map<string, WorkoutVariantChange>,
  ): { metadata: ExerciseMetadata; target: AdaptationExerciseTarget } {
    const target = { ...e.target };
    if (target.targetRepsMax != null) target.targetRepsMax = Math.min(target.targetRepsMax, 6);
    if (target.targetRepsMin != null) target.targetRepsMin = Math.min(target.targetRepsMin, 5);
    target.targetRpe = Math.max(target.targetRpe ?? 8, 8);
    target.restSeconds = (target.restSeconds ?? 90) + 30;
    changes.set(e.target.exerciseId, {
      exerciseId: e.target.exerciseId,
      type: 'reps_adjusted',
      reason: 'Shifted toward lower reps and higher effort for a strength-focused session.',
    });
    return { metadata: e.metadata, target };
  }

  private applyHypertrophyFocus(
    e: { metadata: ExerciseMetadata; target: AdaptationExerciseTarget },
    changes: Map<string, WorkoutVariantChange>,
  ): { metadata: ExerciseMetadata; target: AdaptationExerciseTarget } {
    const target = { ...e.target };
    target.targetRepsMin = Math.max(target.targetRepsMin ?? 8, 8);
    target.targetRepsMax = Math.min(Math.max(target.targetRepsMax ?? 12, 12), 15);
    if (target.targetRpe != null) target.targetRpe = Math.min(target.targetRpe, 8);
    target.restSeconds = Math.min(target.restSeconds ?? 90, 75);
    changes.set(e.target.exerciseId, {
      exerciseId: e.target.exerciseId,
      type: 'reps_adjusted',
      reason: 'Shifted toward moderate-to-higher reps and shorter rest for a hypertrophy-focused session.',
    });
    return { metadata: e.metadata, target };
  }

  private applyReducedImpact(
    e: { metadata: ExerciseMetadata; target: AdaptationExerciseTarget },
    candidates: ExerciseMetadata[],
    changes: Map<string, WorkoutVariantChange>,
  ): { metadata: ExerciseMetadata; target: AdaptationExerciseTarget } {
    if (e.metadata.jointStress !== 'high') return e;
    const ranked = this.rankSubstitutes(e.metadata, candidates, null, undefined, true);
    const best = ranked[0];
    if (!best) return e;
    changes.set(e.target.exerciseId, {
      exerciseId: e.target.exerciseId,
      type: 'substituted',
      reason: `${buildSubstitutionReason(e.metadata, best.candidate, best.matchedOn)} Lower joint stress than ${e.metadata.name}.`,
    });
    return { metadata: best.candidate, target: { ...e.target, exerciseId: best.candidate.id, targetLoadKg: null } };
  }

  generateTodayFocusSummary(params: GenerateTodayFocusSummaryParams): TodayFocusSummaryResult {
    const { readiness, plan, recentPr, missedYesterday, isMilestoneWeek, currentWeekNumber, weeksCount, streak } =
      params;

    const headline =
      plan.kind === 'rest_day'
        ? 'Rest day'
        : readiness == null
          ? 'Today'
          : ({ high: 'Ready to train', moderate: 'Good to go', low: 'Ease in today', very_low: 'Take it easy today' } as const)[
              readiness.band
            ];

    const summary = buildTodayFocusSummaryText({
      readiness,
      plan,
      recentPr,
      missedYesterday,
      isMilestoneWeek,
      currentWeekNumber,
      weeksCount,
      streak,
    });

    return { headline, summary, band: readiness?.band ?? null };
  }

  generatePostWorkoutSummary({
    exercises,
    previousVolumeByExercise,
    previousBestE1rmByExercise,
    sessionPrEvents,
    readiness,
    trainingLoad,
    painRisk,
  }: GeneratePostWorkoutSummaryParams): PostWorkoutSummaryResult {
    let totalVolumeKg = 0;
    let bestSet: PostWorkoutBestSet | null = null;
    let bestSetE1rm = 0;
    const ratedDeltas: number[] = [];
    const actualRpes: number[] = [];
    let onTargetSetCount = 0;
    const bestE1rmThisSessionByExercise = new Map<string, number>();

    for (const exercise of exercises) {
      let exerciseBestE1rm = 0;
      for (const set of exercise.sets) {
        totalVolumeKg += (set.loadKg ?? 0) * set.reps;

        if (set.loadKg != null && set.loadKg > 0) {
          const e1rm = estimateOneRepMax(set.loadKg, set.reps);
          if (e1rm > exerciseBestE1rm) exerciseBestE1rm = e1rm;
          if (e1rm > bestSetE1rm) {
            bestSetE1rm = e1rm;
            bestSet = {
              exerciseId: exercise.exerciseId,
              exerciseName: exercise.exerciseName,
              loadKg: set.loadKg,
              reps: set.reps,
              e1rm,
            };
          }
        }

        if (set.rpe != null) {
          actualRpes.push(set.rpe);
          if (exercise.targetRpe != null) {
            const delta = set.rpe - exercise.targetRpe;
            ratedDeltas.push(delta);
            if (Math.abs(delta) <= 1) onTargetSetCount++;
          }
        }
      }
      if (exerciseBestE1rm > 0) bestE1rmThisSessionByExercise.set(exercise.exerciseId, exerciseBestE1rm);
    }

    let previousVolumeTotal = 0;
    let hasPriorVolumeData = false;
    for (const exercise of exercises) {
      const prev = previousVolumeByExercise[exercise.exerciseId];
      if (prev != null) {
        previousVolumeTotal += prev;
        hasPriorVolumeData = true;
      }
    }
    const volumeChangeKg = hasPriorVolumeData ? totalVolumeKg - previousVolumeTotal : null;
    const volumeChangePercent =
      volumeChangeKg != null && previousVolumeTotal > 0 ? (volumeChangeKg / previousVolumeTotal) * 100 : null;

    const improvedExercises: ExercisePerformanceDelta[] = [];
    const declinedExercises: ExercisePerformanceDelta[] = [];
    for (const exercise of exercises) {
      const prevBest = previousBestE1rmByExercise[exercise.exerciseId];
      const thisBest = bestE1rmThisSessionByExercise.get(exercise.exerciseId);
      if (prevBest == null || prevBest <= 0 || thisBest == null) continue;
      const changePercent = ((thisBest - prevBest) / prevBest) * 100;
      if (changePercent > 2) {
        improvedExercises.push({
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          direction: 'improved',
          detail: `Estimated 1RM up ~${Math.round(changePercent)}% from last time.`,
        });
      } else if (changePercent < -2) {
        declinedExercises.push({
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          direction: 'declined',
          detail: `Estimated 1RM down ~${Math.round(Math.abs(changePercent))}% from last time.`,
        });
      }
    }

    const rpeAdherence: RpeAdherence = {
      ratedSetCount: ratedDeltas.length,
      averageDelta: ratedDeltas.length > 0 ? average(ratedDeltas) : null,
      onTargetSetCount,
    };

    const avgActualRpe = actualRpes.length > 0 ? average(actualRpes) : null;

    let readinessVsPerformance: string | null = null;
    if (readiness && avgActualRpe != null) {
      const [lo, hi] = readiness.recommendedRpeRange;
      const rounded = avgActualRpe.toFixed(1);
      if (avgActualRpe > hi + 0.5) {
        readinessVsPerformance = `You trained at an average RPE of ${rounded}, above today's recommended ${lo}-${hi} range given your readiness.`;
      } else if (avgActualRpe < lo - 0.5) {
        readinessVsPerformance = `You trained at an average RPE of ${rounded}, below today's recommended ${lo}-${hi} range — there may have been room to push a bit more.`;
      } else {
        readinessVsPerformance = `You trained at an average RPE of ${rounded}, right within today's recommended ${lo}-${hi} range.`;
      }
    }

    let estimatedRecoveryNeeds: RecoveryNeed = 'normal';
    if (trainingLoad.classification === 'high' || (avgActualRpe != null && avgActualRpe >= 9)) {
      estimatedRecoveryNeeds = 'extra_rest';
    } else if (trainingLoad.classification === 'low' && avgActualRpe != null && avgActualRpe <= 6) {
      estimatedRecoveryNeeds = 'light_next_session';
    }

    let painOrFatigueConcern: string | null = null;
    if (painRisk.riskLevel !== 'none') {
      painOrFatigueConcern = painRisk.recommendation;
    } else if (rpeAdherence.averageDelta != null && rpeAdherence.averageDelta >= 2) {
      painOrFatigueConcern = 'Effort ran noticeably higher than planned today — keep an eye on recovery before your next session.';
    }

    const suggestedNextAction = buildSuggestedNextAction({
      sessionPrEvents,
      improvedExercises,
      declinedExercises,
      estimatedRecoveryNeeds,
    });
    const summary = buildPostWorkoutSummaryText({
      totalVolumeKg,
      volumeChangePercent,
      sessionPrEvents,
      improvedExercises,
      declinedExercises,
      estimatedRecoveryNeeds,
      painOrFatigueConcern,
    });

    return {
      totalVolumeKg,
      volumeChangeKg,
      volumeChangePercent,
      newPersonalRecords: sessionPrEvents,
      bestSet,
      improvedExercises,
      declinedExercises,
      rpeAdherence,
      readinessVsPerformance,
      estimatedRecoveryNeeds,
      suggestedNextAction,
      painOrFatigueConcern,
      summary,
    };
  }

  generateWeeklyReview({
    weekStart,
    weekEnd,
    workoutsCompleted,
    workoutsMissed,
    weekSets,
    priorBestE1rmByExercise,
    weekPrEvents,
    checkins,
    trainingLoad,
  }: GenerateWeeklyReviewParams): WeeklyReviewResult {
    const totalPlanned = workoutsCompleted + workoutsMissed;
    const consistencyPercent = totalPlanned > 0 ? (workoutsCompleted / totalPlanned) * 100 : null;

    let totalVolumeKg = 0;
    const volumeByMuscle = new Map<string, number>();
    const setsByExercise = new Map<string, typeof weekSets>();
    for (const set of weekSets) {
      const volume = (set.loadKg ?? 0) * set.reps;
      totalVolumeKg += volume;
      volumeByMuscle.set(set.primaryMuscle, (volumeByMuscle.get(set.primaryMuscle) ?? 0) + volume);
      const list = setsByExercise.get(set.exerciseId) ?? [];
      list.push(set);
      setsByExercise.set(set.exerciseId, list);
    }
    const volumeByMuscleGroup: MuscleGroupVolume[] = [...volumeByMuscle.entries()]
      .map(([muscle, volumeKg]) => ({ muscle, volumeKg }))
      .sort((a, b) => b.volumeKg - a.volumeKg);

    let mostImprovedExercise: ExerciseImprovement | null = null;
    let bestImprovementPercent = 0;
    let mostInconsistentExercise: ExerciseInconsistency | null = null;
    let highestCv = INCONSISTENCY_CV_THRESHOLD;

    for (const [exerciseId, sets] of setsByExercise) {
      const exerciseName = sets[0].exerciseName;
      const loadedSets = sets.filter(s => s.loadKg != null && s.loadKg > 0);

      if (loadedSets.length > 0) {
        const bestE1rmThisWeek = loadedSets.reduce(
          (best, s) => Math.max(best, estimateOneRepMax(s.loadKg as number, s.reps)),
          0,
        );
        const priorBest = priorBestE1rmByExercise[exerciseId];
        if (priorBest != null && priorBest > 0) {
          const changePercent = ((bestE1rmThisWeek - priorBest) / priorBest) * 100;
          if (changePercent > 0 && changePercent > bestImprovementPercent) {
            bestImprovementPercent = changePercent;
            mostImprovedExercise = { exerciseId, exerciseName, changePercent };
          }
        }
      }

      if (loadedSets.length >= 2) {
        const loads = loadedSets.map(s => s.loadKg as number);
        const mean = average(loads);
        if (mean > 0) {
          const variance = average(loads.map(l => (l - mean) ** 2));
          const cv = Math.sqrt(variance) / mean;
          if (cv > highestCv) {
            highestCv = cv;
            mostInconsistentExercise = {
              exerciseId,
              exerciseName,
              detail: `Load varied notably across sets this week (${Math.round(Math.min(...loads))}-${Math.round(Math.max(...loads))}kg).`,
            };
          }
        }
      }
    }

    const sleepValues = checkins.map(c => c.sleepHours).filter((v): v is number => v != null);
    const sorenessValues = checkins.map(c => c.soreness).filter((v): v is number => v != null);
    const stressValues = checkins.map(c => c.stress).filter((v): v is number => v != null);
    const painReportCount = checkins.filter(c => c.hasPain).length;

    const averageReadinessScore = checkins.length > 0 ? average(checkins.map(c => c.readinessScore)) : null;
    const averageSleepHours = sleepValues.length > 0 ? average(sleepValues) : null;
    const averageSoreness = sorenessValues.length > 0 ? average(sorenessValues) : null;
    const averageStress = stressValues.length > 0 ? average(stressValues) : null;

    const habitObservation = buildHabitObservation({
      painReportCount,
      consistencyPercent,
      averageStress,
      averageSleepHours,
    });
    const recommendedChangesNextWeek = buildWeeklyRecommendation({
      painReportCount,
      trainingLoadClassification: trainingLoad.classification,
      consistencyPercent,
      mostImprovedExercise,
    });
    const summary = buildWeeklyReviewSummary({
      workoutsCompleted,
      workoutsMissed,
      totalVolumeKg,
      weekPrEvents,
      mostImprovedExercise,
      habitObservation,
    });
    const shareableSummary = buildShareableWeeklySummary({
      workoutsCompleted,
      totalVolumeKg,
      prCount: weekPrEvents.length,
      consistencyPercent,
    });

    return {
      weekStart,
      weekEnd,
      workoutsCompleted,
      workoutsMissed,
      consistencyPercent,
      totalVolumeKg,
      volumeByMuscleGroup,
      newPersonalRecords: weekPrEvents,
      mostImprovedExercise,
      mostInconsistentExercise,
      averageReadinessScore,
      averageSleepHours,
      averageSoreness,
      averageStress,
      painReportCount,
      trainingLoadClassification: trainingLoad.classification,
      habitObservation,
      recommendedChangesNextWeek,
      summary,
      shareableSummary,
    };
  }

  detectTrainingPatterns({
    weeklySnapshots,
    missedWeekdays,
    exerciseRpeTrends,
    dismissedKeys,
  }: DetectTrainingPatternsParams): TrainingPattern[] {
    const dismissed = new Set(dismissedKeys);
    const candidates: TrainingPattern[] = [
      ...detectInconsistentWeekdays(missedWeekdays),
      ...detectDecliningConsistency(weeklySnapshots),
      ...detectRecurringPain(weeklySnapshots),
      ...detectRpeCreep(exerciseRpeTrends),
      ...detectLowSleep(weeklySnapshots),
    ];

    return candidates
      .filter(pattern => !dismissed.has(pattern.key))
      .sort((a, b) => b.confidence - a.confidence);
  }

  predictPersonalRecords({ exerciseHistories, asOf }: PredictPersonalRecordsParams): PrPrediction[] {
    const asOfDate = new Date(asOf);
    const lookbackStart = subDays(asOfDate, PREDICTION_LOOKBACK_DAYS);
    const targetDate = format(addDays(asOfDate, PREDICTION_HORIZON_DAYS), 'yyyy-MM-dd');

    const predictions: PrPrediction[] = [];
    for (const history of exerciseHistories) {
      const points = history.points.filter(p => {
        const pointDate = new Date(p.date);
        return pointDate >= lookbackStart && pointDate <= asOfDate;
      });
      if (points.length < PREDICTION_MIN_POINTS) continue;

      const firstDate = new Date(points[0].date);
      const spanDays = differenceInCalendarDays(new Date(points[points.length - 1].date), firstDate);
      if (spanDays < PREDICTION_MIN_SPAN_DAYS) continue;

      const { slope, intercept, r2 } = linearRegression(
        points.map(p => ({ x: differenceInCalendarDays(new Date(p.date), firstDate), y: p.e1rm })),
      );
      if (slope <= 0 || r2 < PREDICTION_MIN_R2) continue;

      const currentBestE1rm = Math.max(...points.map(p => p.e1rm));
      const horizonX = differenceInCalendarDays(addDays(asOfDate, PREDICTION_HORIZON_DAYS), firstDate);
      const predictedE1rm = intercept + slope * horizonX;
      if (predictedE1rm - currentBestE1rm < PREDICTION_MIN_GAIN_KG) continue;

      predictions.push({
        exerciseId: history.exerciseId,
        exerciseName: history.exerciseName,
        currentBestE1rm,
        predictedE1rm,
        targetDate,
        confidence: clamp(r2, 0, 1),
        summary: buildPrPredictionSummary({ exerciseName: history.exerciseName, predictedE1rm, targetDate }),
      });
    }

    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  generateExerciseExplanation({ exercise }: GenerateExerciseExplanationParams): ExerciseExplanationResult {
    return {
      purpose: buildExercisePurpose(exercise),
      progressionCriteria: buildProgressionCriteria(exercise),
      regressionCriteria: buildRegressionCriteria(exercise),
    };
  }
}

const DIFFICULTY_ORDER: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };
const JOINT_STRESS_ORDER: Record<string, number> = { low: 0, moderate: 1, high: 2 };

const COMPOUND_PATTERNS = new Set<string>([
  'squat',
  'hinge',
  'lunge',
  'push_horizontal',
  'push_vertical',
  'pull_horizontal',
  'pull_vertical',
  'carry',
]);

function isCompoundPattern(pattern: string | null): boolean {
  return pattern != null && COMPOUND_PATTERNS.has(pattern);
}

const VARIANT_LABELS: Record<WorkoutVariantType, string> = {
  full: 'Full Workout',
  time_45: '45-Minute Version',
  time_30: '30-Minute Version',
  hotel: 'Hotel Gym Version',
  home: 'Home Gym Version',
  bodyweight: 'Bodyweight Version',
  low_readiness: 'Low-Readiness Version',
  strength_focus: 'Strength-Focused Version',
  hypertrophy_focus: 'Hypertrophy-Focused Version',
  reduced_impact: 'Reduced-Impact Version',
};

const VARIANT_DESCRIPTIONS: Record<WorkoutVariantType, string> = {
  full: 'No changes — full session.',
  time_45: 'Trimmed to fit roughly 45 minutes, prioritizing your main lifts.',
  time_30: 'Trimmed to fit roughly 30 minutes, prioritizing your main lifts.',
  hotel: 'Swapped exercises that need a full gym for dumbbell/band/bodyweight versions.',
  home: 'Swapped exercises your home equipment can\'t cover.',
  bodyweight: 'Swapped every exercise for a bodyweight-only version.',
  low_readiness: 'Lightened for a lower-readiness day — fewer sets, easier RPE, more rest.',
  strength_focus: 'Shifted toward lower reps and higher effort.',
  hypertrophy_focus: 'Shifted toward moderate-to-higher reps and shorter rest.',
  reduced_impact: 'Swapped high-joint-stress exercises for gentler alternatives where possible.',
};

function equipmentAllowlistFor(
  variantType: 'hotel' | 'home' | 'bodyweight',
  availableEquipment: EquipmentType[] | null,
): EquipmentType[] {
  switch (variantType) {
    case 'bodyweight':
      return ['bodyweight'];
    case 'hotel':
      return ['bodyweight', 'dumbbell', 'band'];
    case 'home':
      return availableEquipment ?? ['bodyweight'];
  }
}

function buildSubstitutionReason(
  exercise: ExerciseMetadata,
  candidate: ExerciseMetadata,
  matchedOn: SubstitutionMatchSignal[],
): string {
  const parts: string[] = [];
  if (matchedOn.includes('movement_pattern') && exercise.movementPattern) {
    parts.push(`same ${exercise.movementPattern.replace('_', ' ')} pattern`);
  }
  if (matchedOn.includes('primary_muscle')) {
    parts.push(`same ${exercise.primaryMuscle} focus`);
  } else if (matchedOn.includes('category')) {
    parts.push(`similar ${exercise.category} movement`);
  }
  const whatMatched = parts.length > 0 ? parts.join(' and ') : 'a reasonable overall match';
  const equipmentNote =
    candidate.equipment !== exercise.equipment
      ? ` — uses ${candidate.equipment} instead of ${exercise.equipment}`
      : '';
  return `${whatMatched[0].toUpperCase()}${whatMatched.slice(1)}${equipmentNote}.`;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function buildSuggestedNextAction(input: {
  sessionPrEvents: PrEvent[];
  improvedExercises: ExercisePerformanceDelta[];
  declinedExercises: ExercisePerformanceDelta[];
  estimatedRecoveryNeeds: RecoveryNeed;
}): string {
  if (input.sessionPrEvents.length > 0) {
    return 'Great session — keep the same approach next time and let the new numbers become your new baseline.';
  }
  if (input.estimatedRecoveryNeeds === 'extra_rest') {
    return 'Consider an extra rest day (or a lighter session) before your next workout.';
  }
  if (input.declinedExercises.length > input.improvedExercises.length) {
    return "A few lifts dipped today — make sure you're recovering well before the next session.";
  }
  if (input.estimatedRecoveryNeeds === 'light_next_session') {
    return "That felt manageable — you're in good shape to push a little harder next time.";
  }
  return 'Right on track — keep progressing as planned.';
}

function buildTodayFocusSummaryText(input: GenerateTodayFocusSummaryParams): string {
  const { readiness, plan, recentPr, missedYesterday, isMilestoneWeek, currentWeekNumber, weeksCount, streak } =
    input;
  const parts: string[] = [];

  switch (plan.kind) {
    case 'rest_day':
      parts.push('Today is a rest day — recovery is part of the plan.');
      break;
    case 'training_day':
      parts.push(
        `Today's plan is ${plan.dayTitle ?? 'a training day'} (${plan.exerciseCount} exercise${plan.exerciseCount === 1 ? '' : 's'})${plan.isDeload ? ', a deload week' : ''}.`,
      );
      break;
    case 'scheduled':
      parts.push(`You have "${plan.name}" scheduled for today.`);
      break;
    case 'completed':
      parts.push(`You've already completed ${plan.dayTitle ?? "today's workout"} — nice work.`);
      break;
    case 'none':
      parts.push('Nothing is scheduled on today’s calendar.');
      break;
  }

  if (readiness) {
    parts.push(readiness.summary);
    if (plan.kind === 'training_day' || plan.kind === 'scheduled') {
      const [lo, hi] = readiness.recommendedRpeRange;
      parts.push(`Aim for RPE ${lo}-${hi} today.`);
    }
  }

  if (missedYesterday) {
    parts.push("Yesterday's session is still open — jump back in when you're ready.");
  } else if (recentPr) {
    parts.push(`You just set a PR on ${recentPr.exerciseName} — nice momentum.`);
  } else if (isMilestoneWeek && currentWeekNumber != null) {
    parts.push(
      currentWeekNumber === weeksCount
        ? `Week ${currentWeekNumber} of ${weeksCount} — final week, finish strong.`
        : `Week ${currentWeekNumber} of ${weeksCount} — right on schedule.`,
    );
  } else if (streak > 2) {
    parts.push(`You're on a ${streak}-day streak.`);
  }

  return parts.join(' ');
}

function buildPostWorkoutSummaryText(input: {
  totalVolumeKg: number;
  volumeChangePercent: number | null;
  sessionPrEvents: PrEvent[];
  improvedExercises: ExercisePerformanceDelta[];
  declinedExercises: ExercisePerformanceDelta[];
  estimatedRecoveryNeeds: RecoveryNeed;
  painOrFatigueConcern: string | null;
}): string {
  const parts: string[] = [];

  let volumeSentence = `You moved ${Math.round(input.totalVolumeKg).toLocaleString()}kg of total volume today`;
  if (input.volumeChangePercent != null) {
    const direction = input.volumeChangePercent >= 0 ? 'up' : 'down';
    volumeSentence += `, ${direction} ${Math.abs(Math.round(input.volumeChangePercent))}% from last time`;
  }
  parts.push(`${volumeSentence}.`);

  if (input.sessionPrEvents.length > 0) {
    parts.push(
      `You set ${input.sessionPrEvents.length} new personal record${input.sessionPrEvents.length === 1 ? '' : 's'} — nice work.`,
    );
  }

  if (input.improvedExercises.length > 0 || input.declinedExercises.length > 0) {
    const bits: string[] = [];
    if (input.improvedExercises.length > 0) {
      bits.push(`${input.improvedExercises.length} exercise${input.improvedExercises.length === 1 ? '' : 's'} trending up`);
    }
    if (input.declinedExercises.length > 0) {
      bits.push(`${input.declinedExercises.length} trending down`);
    }
    parts.push(`Compared with last time: ${bits.join(', ')}.`);
  }

  if (input.painOrFatigueConcern) {
    parts.push(input.painOrFatigueConcern);
  } else if (input.estimatedRecoveryNeeds === 'extra_rest') {
    parts.push('This looked like a demanding session — plan for a bit more recovery.');
  }

  return parts.join(' ');
}

/** Coefficient-of-variation floor below which load variance across a week's
 * sets is just normal noise, not something worth flagging as "inconsistent." */
const INCONSISTENCY_CV_THRESHOLD = 0.15;

function buildHabitObservation(input: {
  painReportCount: number;
  consistencyPercent: number | null;
  averageStress: number | null;
  averageSleepHours: number | null;
}): string | null {
  if (input.painReportCount > 0) {
    return `Discomfort came up on ${input.painReportCount} day${input.painReportCount === 1 ? '' : 's'} this week.`;
  }
  if (input.consistencyPercent != null && input.consistencyPercent < 70) {
    return 'A few planned sessions were missed this week.';
  }
  if (input.averageStress != null && input.averageStress >= 4) {
    return 'Stress levels ran high this week.';
  }
  if (input.averageSleepHours != null && input.averageSleepHours < 6) {
    return 'Sleep averaged under 6 hours this week.';
  }
  return null;
}

function buildWeeklyRecommendation(input: {
  painReportCount: number;
  trainingLoadClassification: TrainingLoadClassification;
  consistencyPercent: number | null;
  mostImprovedExercise: ExerciseImprovement | null;
}): string {
  if (input.painReportCount > 0) {
    return "Consider addressing the discomfort you reported before next week's sessions.";
  }
  if (input.trainingLoadClassification === 'high') {
    return 'Ease off slightly next week to let recovery catch up.';
  }
  if (input.consistencyPercent != null && input.consistencyPercent < 70) {
    return 'Aim to hit more of your planned sessions next week.';
  }
  if (input.mostImprovedExercise) {
    return `Keep building on the momentum with ${input.mostImprovedExercise.exerciseName}.`;
  }
  return "Keep the same approach — it's working.";
}

function buildWeeklyReviewSummary(input: {
  workoutsCompleted: number;
  workoutsMissed: number;
  totalVolumeKg: number;
  weekPrEvents: PrEvent[];
  mostImprovedExercise: ExerciseImprovement | null;
  habitObservation: string | null;
}): string {
  const parts: string[] = [];
  parts.push(
    `You completed ${input.workoutsCompleted} workout${input.workoutsCompleted === 1 ? '' : 's'} this week` +
      (input.workoutsMissed > 0 ? ` and missed ${input.workoutsMissed}` : '') +
      `, moving ${Math.round(input.totalVolumeKg).toLocaleString()}kg of total volume.`,
  );
  if (input.weekPrEvents.length > 0) {
    parts.push(
      `You set ${input.weekPrEvents.length} new personal record${input.weekPrEvents.length === 1 ? '' : 's'}.`,
    );
  }
  if (input.mostImprovedExercise) {
    parts.push(
      `${input.mostImprovedExercise.exerciseName} looked strongest, up ~${Math.round(input.mostImprovedExercise.changePercent)}%.`,
    );
  }
  if (input.habitObservation) {
    parts.push(input.habitObservation);
  }
  return parts.join(' ');
}

function buildShareableWeeklySummary(input: {
  workoutsCompleted: number;
  totalVolumeKg: number;
  prCount: number;
  consistencyPercent: number | null;
}): string {
  const parts: string[] = [
    `${input.workoutsCompleted} workout${input.workoutsCompleted === 1 ? '' : 's'} completed this week`,
    `${Math.round(input.totalVolumeKg).toLocaleString()}kg total volume`,
  ];
  if (input.prCount > 0) {
    parts.push(`${input.prCount} new PR${input.prCount === 1 ? '' : 's'}`);
  }
  if (input.consistencyPercent != null) {
    parts.push(`${Math.round(input.consistencyPercent)}% consistency`);
  }
  return parts.join(' · ');
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const INCONSISTENT_WEEKDAY_MIN_OPPORTUNITIES = 3;
const INCONSISTENT_WEEKDAY_RATIO_THRESHOLD = 0.6;

function detectInconsistentWeekdays(missedWeekdays: MissedWeekdayInput[]): TrainingPattern[] {
  const patterns: TrainingPattern[] = [];
  for (const entry of missedWeekdays) {
    if (entry.opportunities < INCONSISTENT_WEEKDAY_MIN_OPPORTUNITIES) continue;
    const ratio = entry.missed / entry.opportunities;
    if (ratio < INCONSISTENT_WEEKDAY_RATIO_THRESHOLD) continue;
    const dayName = WEEKDAY_NAMES[entry.weekday];
    patterns.push({
      key: `inconsistent_weekday:${entry.weekday}`,
      type: 'inconsistent_weekday',
      confidence: clamp(ratio, 0, 1),
      title: `${dayName} sessions keep getting skipped`,
      detail: `You've missed ${entry.missed} of ${entry.opportunities} planned ${dayName} sessions recently.`,
      evidenceSummary: `${entry.missed}/${entry.opportunities} ${dayName} sessions missed`,
    });
  }
  return patterns;
}

const DECLINING_CONSISTENCY_MIN_RUN = 3;

function detectDecliningConsistency(weeklySnapshots: WeeklyPatternSnapshot[]): TrainingPattern[] {
  let runEnd = weeklySnapshots.length - 1;
  while (runEnd >= 0 && weeklySnapshots[runEnd].consistencyPercent == null) runEnd--;
  if (runEnd < DECLINING_CONSISTENCY_MIN_RUN - 1) return [];

  let runStart = runEnd;
  while (
    runStart > 0 &&
    weeklySnapshots[runStart - 1].consistencyPercent != null &&
    (weeklySnapshots[runStart - 1].consistencyPercent as number) >
      (weeklySnapshots[runStart].consistencyPercent as number)
  ) {
    runStart--;
  }

  const runLength = runEnd - runStart + 1;
  if (runLength < DECLINING_CONSISTENCY_MIN_RUN) return [];

  const first = weeklySnapshots[runStart].consistencyPercent as number;
  const last = weeklySnapshots[runEnd].consistencyPercent as number;
  const confidence = clamp(0.5 + (first - last) / 100, 0.5, 1);

  return [
    {
      key: 'declining_consistency',
      type: 'declining_consistency',
      confidence,
      title: 'Consistency has been sliding',
      detail: `Weekly consistency dropped for ${runLength} weeks in a row, from ${Math.round(first)}% to ${Math.round(last)}%.`,
      evidenceSummary: `${runLength} consecutive declining weeks (${Math.round(first)}% -> ${Math.round(last)}%)`,
    },
  ];
}

const RECURRING_PAIN_LOOKBACK_WEEKS = 4;
const RECURRING_PAIN_MIN_WEEKS = 2;

function detectRecurringPain(weeklySnapshots: WeeklyPatternSnapshot[]): TrainingPattern[] {
  const recent = weeklySnapshots.slice(-RECURRING_PAIN_LOOKBACK_WEEKS);
  if (recent.length === 0) return [];
  const painWeeks = recent.filter(w => w.painReportCount > 0).length;
  if (painWeeks < RECURRING_PAIN_MIN_WEEKS) return [];

  return [
    {
      key: 'recurring_pain',
      type: 'recurring_pain',
      confidence: clamp(painWeeks / recent.length, 0, 1),
      title: 'Discomfort has come up more than once',
      detail: `You've reported some discomfort in ${painWeeks} of the last ${recent.length} weeks. Worth mentioning to a professional if it continues.`,
      evidenceSummary: `Pain reported in ${painWeeks}/${recent.length} recent weeks`,
    },
  ];
}

const RPE_CREEP_MIN_SESSIONS = 6;
const RPE_CREEP_MIN_INCREASE = 1;
const RPE_CREEP_MAX_LOAD_INCREASE_RATIO = 1.05;

function detectRpeCreep(exerciseRpeTrends: ExerciseRpeTrendInput[]): TrainingPattern[] {
  const patterns: TrainingPattern[] = [];

  for (const trend of exerciseRpeTrends) {
    if (trend.sessions.length < RPE_CREEP_MIN_SESSIONS) continue;

    const thirdSize = Math.floor(trend.sessions.length / 3);
    const earliest = trend.sessions.slice(0, thirdSize);
    const latest = trend.sessions.slice(trend.sessions.length - thirdSize);
    const earliestAvgRpe = average(earliest.map(s => s.rpe));
    const latestAvgRpe = average(latest.map(s => s.rpe));
    const rpeIncrease = latestAvgRpe - earliestAvgRpe;
    if (rpeIncrease < RPE_CREEP_MIN_INCREASE) continue;

    const earliestLoads = earliest.map(s => s.loadKg).filter((v): v is number => v != null);
    const latestLoads = latest.map(s => s.loadKg).filter((v): v is number => v != null);
    if (earliestLoads.length > 0 && latestLoads.length > 0) {
      const earliestAvgLoad = average(earliestLoads);
      const latestAvgLoad = average(latestLoads);
      // A load increase is a legitimate reason RPE rose too — only flag creep
      // when the exercise got harder without getting meaningfully heavier.
      if (earliestAvgLoad > 0 && latestAvgLoad / earliestAvgLoad > RPE_CREEP_MAX_LOAD_INCREASE_RATIO) continue;
    }

    patterns.push({
      key: `rpe_creep:${trend.exerciseId}`,
      type: 'rpe_creep',
      confidence: clamp(0.4 + rpeIncrease * 0.2, 0, 1),
      title: `${trend.exerciseName} is feeling harder`,
      detail: `Average effort on ${trend.exerciseName} rose about ${rpeIncrease.toFixed(1)} RPE points at a similar load — a sign of accumulating fatigue.`,
      evidenceSummary: `RPE ${earliestAvgRpe.toFixed(1)} -> ${latestAvgRpe.toFixed(1)} at ~stable load`,
    });
  }

  return patterns;
}

const LOW_SLEEP_LOOKBACK_WEEKS = 4;
const LOW_SLEEP_MIN_WEEKS = 3;
const LOW_SLEEP_THRESHOLD_HOURS = 6.5;

function detectLowSleep(weeklySnapshots: WeeklyPatternSnapshot[]): TrainingPattern[] {
  const recent = weeklySnapshots
    .slice(-LOW_SLEEP_LOOKBACK_WEEKS)
    .filter((w): w is WeeklyPatternSnapshot & { averageSleepHours: number } => w.averageSleepHours != null);
  if (recent.length < LOW_SLEEP_MIN_WEEKS) return [];
  const lowSleepWeeks = recent.filter(w => w.averageSleepHours < LOW_SLEEP_THRESHOLD_HOURS).length;
  if (lowSleepWeeks < LOW_SLEEP_MIN_WEEKS) return [];

  return [
    {
      key: 'low_sleep_pattern',
      type: 'low_sleep_pattern',
      confidence: clamp(lowSleepWeeks / recent.length, 0, 1),
      title: 'Sleep has been running short',
      detail: `Average sleep was under ${LOW_SLEEP_THRESHOLD_HOURS}h in ${lowSleepWeeks} of the last ${recent.length} weeks with check-ins.`,
      evidenceSummary: `Low sleep in ${lowSleepWeeks}/${recent.length} recent weeks`,
    },
  ];
}

const PREDICTION_LOOKBACK_DAYS = 90;
const PREDICTION_HORIZON_DAYS = 42;
const PREDICTION_MIN_POINTS = 4;
const PREDICTION_MIN_SPAN_DAYS = 14;
const PREDICTION_MIN_R2 = 0.3;
const PREDICTION_MIN_GAIN_KG = 1;

function linearRegression(points: Array<{ x: number; y: number }>): { slope: number; intercept: number; r2: number } {
  const meanX = average(points.map(p => p.x));
  const meanY = average(points.map(p => p.y));

  let ssXY = 0;
  let ssXX = 0;
  let ssYY = 0;
  for (const { x, y } of points) {
    ssXY += (x - meanX) * (y - meanY);
    ssXX += (x - meanX) ** 2;
    ssYY += (y - meanY) ** 2;
  }

  const slope = ssXX > 0 ? ssXY / ssXX : 0;
  const intercept = meanY - slope * meanX;
  const r2 = ssXX > 0 && ssYY > 0 ? (ssXY * ssXY) / (ssXX * ssYY) : 0;

  return { slope, intercept, r2 };
}

function buildPrPredictionSummary(input: { exerciseName: string; predictedE1rm: number; targetDate: string }): string {
  const formattedDate = format(new Date(input.targetDate), 'MMM d');
  return (
    `At this pace, your ${input.exerciseName} could reach ~${Math.round(input.predictedE1rm)}kg by ${formattedDate}` +
    ' — a rough projection based on your recent trend, not a guarantee.'
  );
}

const MOVEMENT_PATTERN_PURPOSE: Record<MovementPattern, string> = {
  squat:
    'builds lower-body strength through a squat pattern — the hip/knee mechanics carry over to your other squat and lunge work',
  hinge:
    'trains the hip-hinge pattern, building posterior-chain strength that underpins deadlifts and carries over to sprinting and jumping power',
  lunge: "trains a single-leg squat/lunge pattern, building unilateral strength and balance a barbell squat alone doesn't cover",
  push_horizontal: 'builds horizontal pushing strength (chest, shoulders, triceps) — the pattern behind bench-press-style lifts',
  push_vertical: 'builds vertical pushing strength (shoulders, triceps) — the pattern behind overhead-press-style lifts',
  pull_horizontal: 'builds horizontal pulling strength through your upper back, balancing out your pushing work and supporting posture',
  pull_vertical: 'builds vertical pulling strength through your lats and back — the pattern behind pull-up/lat-pulldown-style lifts',
  carry: 'builds total-body stability and grip under load — a pattern that rarely gets trained directly outside loaded-carry work',
  rotation: "trains rotational core strength and control, which most straight-line lifts don't challenge directly",
  isolation: 'isolates a single muscle group directly — useful for targeted growth or bringing up an area compound lifts undertrain',
  core: 'builds core strength and stability that supports every other lift in your program',
  cardio: 'builds cardiovascular conditioning and work capacity, supporting recovery between sets and sessions',
};

const CATEGORY_PURPOSE: Record<ExerciseCategory, string> = {
  push: 'builds pushing strength through your chest, shoulders, and triceps',
  pull: 'builds pulling strength through your back and biceps, balancing out your pushing work',
  legs: 'builds lower-body strength and stability',
  core: 'builds core strength and stability that supports every other lift in your program',
  full_body: 'trains multiple muscle groups together, building coordination as well as strength',
  cardio: 'builds cardiovascular conditioning and work capacity',
  mobility: 'improves range of motion and movement quality, supporting your other lifts',
};

function buildExercisePurpose(exercise: ExerciseMetadata): string {
  const description = exercise.movementPattern
    ? MOVEMENT_PATTERN_PURPOSE[exercise.movementPattern]
    : CATEGORY_PURPOSE[exercise.category];
  return `This exercise ${description}. It primarily targets your ${exercise.primaryMuscle}.`;
}

function buildProgressionCriteria(exercise: ExerciseMetadata): string {
  if (exercise.category === 'cardio') {
    return 'Progress by extending duration or increasing pace/intensity once the current session feels comfortably sustainable — not by adding load.';
  }
  if (exercise.category === 'mobility') {
    return 'Progress by increasing range of motion or hold time once the current range feels controlled and pain-free.';
  }
  return 'Once you can complete every set at the top of your rep range with 1-2 reps left in reserve, add weight next session.';
}

function buildRegressionCriteria(exercise: ExerciseMetadata): string {
  let base: string;
  if (exercise.category === 'cardio') {
    base = "If you can't sustain the target pace or duration, reduce the intensity or shorten the session rather than pushing through.";
  } else if (exercise.category === 'mobility') {
    base = "If a position causes pain or you can't control the range, back off to a smaller range of motion.";
  } else {
    base = "If you're missing reps or grinding well before the target RPE, drop the weight or trim the rep range for a session or two.";
  }
  if (exercise.jointStress === 'high') {
    base +=
      " This one is higher-impact on your joints — if it's bothering you, check the suitable alternatives below for a lower-impact swap.";
  }
  return base;
}

export type { AdaptationExerciseTarget };
