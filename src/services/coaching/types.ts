import type { ExerciseE1rmHistory, LoggedSet, PrEvent } from '../api/queries/progress';
import type {
  AdaptationType,
  ExerciseCategory,
  ExerciseDifficulty,
  EquipmentType,
  MovementPattern,
  SetRecommendationType,
  StressLevel,
  WorkoutVariantType,
} from '../../types/database';

export type ReadinessBand = 'high' | 'moderate' | 'low' | 'very_low';

export type ReadinessFactorKey =
  | 'sleep'
  | 'sleep_quality'
  | 'soreness'
  | 'stress'
  | 'pain'
  | 'training_load'
  | 'time_since_last_workout'
  | 'missed_workouts'
  | 'wearable_recovery';

export type ReadinessFactor = {
  key: ReadinessFactorKey;
  label: string;
  /** Whether this factor moved the score up, down, or was a wash. */
  impact: 'positive' | 'negative' | 'neutral';
  /** Relative contribution to the final score, 0..1. */
  weight: number;
  /** Human-readable detail, e.g. "Slept 5.5h — below your recent average." */
  detail: string;
  /** False when the underlying signal wasn't available (no check-in, no wearable yet). */
  available: boolean;
};

export type ReadinessResult = {
  /** 0-100. */
  score: number;
  band: ReadinessBand;
  /** Sorted by |weight| desc; the ones actually worth showing the user. */
  factors: ReadinessFactor[];
  recommendedIntensity: 'full' | 'reduced' | 'light' | 'recovery_only';
  recommendedRpeRange: [number, number];
  estimatedSessionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  /** One-line, hedged ("appears," "may") explanation — never stated as fact. */
  summary: string;
  computedAt: string;
};

export type TrainingLoadClassification = 'low' | 'normal' | 'high' | 'unknown';

export type TrainingLoadResult = {
  acuteVolumeKg: number;
  chronicAvgVolumeKg: number;
  /** acute / chronic; null when there isn't enough history to compute one. */
  loadRatio: number | null;
  classification: TrainingLoadClassification;
};

export type PainRiskLevel = 'none' | 'low' | 'moderate' | 'severe';

export type PainRiskAssessment = {
  riskLevel: PainRiskLevel;
  recommendation: string;
  /** True on warning-sign language (chest pain, dizziness, fainting, ...). */
  stopAndSeekMedicalAttention: boolean;
};

export type ReadinessCheckinInput = {
  sleepHours: number | null;
  sleepQuality: number | null;
  soreness: number | null;
  stress: number | null;
  hasPain: boolean;
  painNotes: string | null;
} | null;

export type WearableReadinessInput = {
  /** 0-100, Whoop's own recovery score. */
  recoveryScore: number;
  sleepPerformancePct: number | null;
  strain: number | null;
} | null;

export type ReadinessInputs = {
  checkin: ReadinessCheckinInput;
  wearable: WearableReadinessInput;
  trainingLoad: TrainingLoadResult;
  daysSinceLastWorkout: number | null;
  missedWorkoutsLast14Days: number;
};

export type AdaptationExerciseTarget = {
  exerciseId: string;
  targetSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetLoadKg: number | null;
  targetRpe: number | null;
  restSeconds: number | null;
};

export type AdaptationChange = {
  /** Client-side id, stable for the review session, before persistence. */
  id: string;
  adaptationType: AdaptationType;
  targetExerciseId: string | null;
  fieldChanged: string;
  originalValue: unknown;
  updatedValue: unknown;
  reason: string;
  confidence: number;
  source: 'rule_engine' | 'ai' | 'user';
};

export type AdaptScheduledWorkoutParams = {
  exercises: AdaptationExerciseTarget[];
  readiness: ReadinessResult;
  painRisk: PainRiskAssessment;
};

export type CompletedSetInfo = {
  setNumber: number;
  reps: number;
  loadKg: number | null;
  rpe: number | null;
};

export type SetRecommendation = {
  /** Client-side id, stable for the review session, before persistence. */
  id: string;
  type: SetRecommendationType;
  recommendedReps: number | null;
  recommendedLoadKg: number | null;
  recommendedRpe: number | null;
  recommendedRestSeconds: number | null;
  reason: string;
  confidence: number;
  source: 'rule_engine' | 'ai' | 'user';
};

export type RecommendNextSetParams = {
  target: AdaptationExerciseTarget;
  /** Chronological, completed, non-warmup working sets for this exercise so far — the just-completed set is the last element. */
  completedSets: CompletedSetInfo[];
  /** The set number the recommendation would apply to, or null if none remain. */
  nextSetNumber: number | null;
  readinessBand: ReadinessBand | null;
};

export type ExerciseMetadata = {
  id: string;
  name: string;
  category: ExerciseCategory;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: EquipmentType;
  movementPattern: MovementPattern | null;
  difficulty: ExerciseDifficulty | null;
  jointStress: StressLevel | null;
  skillRequirement: StressLevel | null;
};

export type SubstitutionMatchSignal = 'movement_pattern' | 'primary_muscle' | 'category' | 'secondary_muscle';

export type ExerciseSubstitution = {
  /** Client-side id, stable for the review session, before persistence. */
  id: string;
  exerciseId: string;
  exerciseName: string;
  reason: string;
  confidence: number;
  matchedOn: SubstitutionMatchSignal[];
};

export type RecommendSubstitutionParams = {
  exercise: ExerciseMetadata;
  candidates: ExerciseMetadata[];
  /** null means unrestricted (e.g. browsing alternatives, not a live equipment gap). */
  availableEquipment: EquipmentType[] | null;
  /** The specific equipment that's unavailable right now, if that's what triggered this — always excluded regardless of availableEquipment. */
  excludeEquipment?: EquipmentType;
};

export type VariantSourceExercise = {
  metadata: ExerciseMetadata;
  target: AdaptationExerciseTarget;
};

export type WorkoutVariantChangeType =
  | 'kept'
  | 'sets_reduced'
  | 'reps_adjusted'
  | 'rpe_adjusted'
  | 'rest_adjusted'
  | 'substituted'
  | 'dropped';

export type WorkoutVariantChange = {
  /** The *original* exercise's id — stable even when the exercise was substituted or dropped. */
  exerciseId: string;
  type: WorkoutVariantChangeType;
  reason: string;
};

export type WorkoutVariantExercise = {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetLoadKg: number | null;
  targetRpe: number | null;
  restSeconds: number | null;
};

export type WorkoutVariantResult = {
  variantType: WorkoutVariantType;
  label: string;
  summary: string;
  estimatedMinutes: number;
  exercises: WorkoutVariantExercise[];
  /** One entry per original exercise, always present — including unchanged ones. */
  changes: WorkoutVariantChange[];
};

export type GenerateWorkoutVariantParams = {
  source: VariantSourceExercise[];
  variantType: WorkoutVariantType;
  candidates: ExerciseMetadata[];
  /** The user's own equipment (profiles.equipment_access) — used by the 'home' variant, and as a relevance signal elsewhere. */
  availableEquipment: EquipmentType[] | null;
};

export type PostWorkoutExerciseInput = {
  exerciseId: string;
  exerciseName: string;
  targetRpe: number | null;
  sets: Array<{ reps: number; loadKg: number | null; rpe: number | null }>;
};

export type ExercisePerformanceDelta = {
  exerciseId: string;
  exerciseName: string;
  direction: 'improved' | 'declined';
  detail: string;
};

export type RpeAdherence = {
  ratedSetCount: number;
  /** actual - target, averaged over sets with both values; null when no set has both. */
  averageDelta: number | null;
  onTargetSetCount: number;
};

export type RecoveryNeed = 'normal' | 'light_next_session' | 'extra_rest';

export type PostWorkoutBestSet = {
  exerciseId: string;
  exerciseName: string;
  loadKg: number;
  reps: number;
  e1rm: number;
};

export type PostWorkoutSummaryResult = {
  totalVolumeKg: number;
  /** null when none of this session's exercises have prior-session data to compare against. */
  volumeChangeKg: number | null;
  volumeChangePercent: number | null;
  newPersonalRecords: PrEvent[];
  bestSet: PostWorkoutBestSet | null;
  improvedExercises: ExercisePerformanceDelta[];
  declinedExercises: ExercisePerformanceDelta[];
  rpeAdherence: RpeAdherence;
  /** null when no pre-workout readiness data is available for today. */
  readinessVsPerformance: string | null;
  estimatedRecoveryNeeds: RecoveryNeed;
  suggestedNextAction: string;
  /** null when nothing concerning was flagged. */
  painOrFatigueConcern: string | null;
  /** The synthesized, plain-language coaching note. */
  summary: string;
};

export type TodayPlanContext =
  | { kind: 'rest_day' }
  | { kind: 'training_day'; dayTitle: string | null; exerciseCount: number; isDeload: boolean }
  | { kind: 'scheduled'; name: string }
  | { kind: 'completed'; dayTitle: string | null }
  | { kind: 'none' };

export type GenerateTodayFocusSummaryParams = {
  /** null only when there's not enough signal to evaluate readiness at all. */
  readiness: ReadinessResult | null;
  plan: TodayPlanContext;
  recentPr: { exerciseName: string; loadKg: number; reps: number } | null;
  missedYesterday: boolean;
  isMilestoneWeek: boolean;
  currentWeekNumber: number | null;
  weeksCount: number;
  streak: number;
};

export type TodayFocusSummaryResult = {
  /** Short label for the card, e.g. "Ready to train", "Take it easy today", "Rest day". */
  headline: string;
  /** The synthesized paragraph. */
  summary: string;
  /** null when readiness wasn't available — lets the UI skip a readiness-colored icon. */
  band: ReadinessBand | null;
};

export type GeneratePostWorkoutSummaryParams = {
  exercises: PostWorkoutExerciseInput[];
  /** exerciseId -> that exercise's total volume the last *other* time it was trained. Absent key = no prior data. */
  previousVolumeByExercise: Record<string, number>;
  /** exerciseId -> that exercise's best e1RM the last *other* time it was trained. Absent key = no prior data. */
  previousBestE1rmByExercise: Record<string, number>;
  sessionPrEvents: PrEvent[];
  readiness: ReadinessResult | null;
  trainingLoad: TrainingLoadResult;
  painRisk: PainRiskAssessment;
};

export type MuscleGroupVolume = { muscle: string; volumeKg: number };

export type ExerciseImprovement = {
  exerciseId: string;
  exerciseName: string;
  changePercent: number;
};

export type ExerciseInconsistency = {
  exerciseId: string;
  exerciseName: string;
  detail: string;
};

export type WeeklySetInput = {
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string;
  reps: number;
  loadKg: number | null;
};

export type WeeklyCheckinInput = {
  date: string;
  sleepHours: number | null;
  soreness: number | null;
  stress: number | null;
  hasPain: boolean;
  painNotes: string | null;
  /** Pre-computed by the caller via evaluateReadiness on that day's check-in alone (other inputs marked unavailable — not re-derived for past days). */
  readinessScore: number;
};

export type WeeklyReviewResult = {
  weekStart: string;
  weekEnd: string;
  workoutsCompleted: number;
  workoutsMissed: number;
  /** null when no training days were planned this week. */
  consistencyPercent: number | null;
  totalVolumeKg: number;
  /** Sorted descending by volume. */
  volumeByMuscleGroup: MuscleGroupVolume[];
  newPersonalRecords: PrEvent[];
  mostImprovedExercise: ExerciseImprovement | null;
  mostInconsistentExercise: ExerciseInconsistency | null;
  averageReadinessScore: number | null;
  averageSleepHours: number | null;
  averageSoreness: number | null;
  averageStress: number | null;
  painReportCount: number;
  trainingLoadClassification: TrainingLoadClassification;
  /** A single one-week heuristic observation, not the cross-week pattern memory of a later phase. */
  habitObservation: string | null;
  recommendedChangesNextWeek: string;
  summary: string;
  /** Privacy-safe subset only — no readiness/sleep/soreness/stress/pain/per-exercise data. */
  shareableSummary: string;
};

export type GenerateWeeklyReviewParams = {
  weekStart: string;
  weekEnd: string;
  workoutsCompleted: number;
  workoutsMissed: number;
  weekSets: WeeklySetInput[];
  /** exerciseId -> best e1RM before weekStart. Absent key = no prior data. */
  priorBestE1rmByExercise: Record<string, number>;
  weekPrEvents: PrEvent[];
  checkins: WeeklyCheckinInput[];
  trainingLoad: TrainingLoadResult;
};

export type TrainingPatternType =
  | 'inconsistent_weekday'
  | 'declining_consistency'
  | 'recurring_pain'
  | 'rpe_creep'
  | 'low_sleep_pattern';

export type TrainingPattern = {
  /** Stable id for persistence/dismissal, e.g. "inconsistent_weekday:5" or "rpe_creep:<exerciseId>". */
  key: string;
  type: TrainingPatternType;
  /** 0..1, recomputed fresh each detection run from the current lookback window. */
  confidence: number;
  title: string;
  detail: string;
  evidenceSummary: string;
};

export type WeeklyPatternSnapshot = {
  weekStart: string;
  consistencyPercent: number | null;
  painReportCount: number;
  averageSleepHours: number | null;
};

export type MissedWeekdayInput = {
  /** 0 = Sunday .. 6 = Saturday, matching Date#getDay(). */
  weekday: number;
  opportunities: number;
  missed: number;
};

export type ExerciseRpeTrendInput = {
  exerciseId: string;
  exerciseName: string;
  /** Chronological (oldest -> newest) working-set RPE/load pairs over the lookback window. */
  sessions: Array<{ rpe: number; loadKg: number | null }>;
};

export type DetectTrainingPatternsParams = {
  /** Oldest -> newest. */
  weeklySnapshots: WeeklyPatternSnapshot[];
  missedWeekdays: MissedWeekdayInput[];
  exerciseRpeTrends: ExerciseRpeTrendInput[];
  /** Pattern keys the user has already dismissed — excluded from the output entirely. */
  dismissedKeys: string[];
};

export type PrPrediction = {
  exerciseId: string;
  exerciseName: string;
  currentBestE1rm: number;
  predictedE1rm: number;
  /** ISO date (yyyy-MM-dd), asOf + the fixed prediction horizon. */
  targetDate: string;
  /** 0..1, the regression fit's clamped R². */
  confidence: number;
  /** Hedged, non-guaranteed "Future You" framing — "could," "at this pace," never a promise. */
  summary: string;
};

export type PredictPersonalRecordsParams = {
  exerciseHistories: ExerciseE1rmHistory[];
  /** ISO date (yyyy-MM-dd) to project forward from — explicit for determinism, not `new Date()` inside the engine. */
  asOf: string;
};

export type ExerciseExplanationResult = {
  /** Why this exercise is worth doing — the "why am I doing this" cue. */
  purpose: string;
  progressionCriteria: string;
  regressionCriteria: string;
};

export type GenerateExerciseExplanationParams = {
  exercise: ExerciseMetadata;
};

/**
 * The UI depends on this interface, never on a specific engine implementation
 * or AI provider directly. A later phase (generateVoiceCue) extends this
 * same interface as it's built, rather than replacing it.
 */
export interface CoachingEngine {
  evaluateReadiness(inputs: ReadinessInputs): ReadinessResult;
  calculateTrainingLoad(sets: LoggedSet[], asOf?: Date): TrainingLoadResult;
  assessPainRisk(hasPain: boolean, painNotes: string | null): PainRiskAssessment;
  adaptScheduledWorkout(params: AdaptScheduledWorkoutParams): AdaptationChange[];
  recommendNextSet(params: RecommendNextSetParams): SetRecommendation | null;
  recommendExerciseSubstitution(params: RecommendSubstitutionParams): ExerciseSubstitution[];
  generateWorkoutVariant(params: GenerateWorkoutVariantParams): WorkoutVariantResult;
  generateTodayFocusSummary(params: GenerateTodayFocusSummaryParams): TodayFocusSummaryResult;
  generatePostWorkoutSummary(params: GeneratePostWorkoutSummaryParams): PostWorkoutSummaryResult;
  generateWeeklyReview(params: GenerateWeeklyReviewParams): WeeklyReviewResult;
  detectTrainingPatterns(params: DetectTrainingPatternsParams): TrainingPattern[];
  predictPersonalRecords(params: PredictPersonalRecordsParams): PrPrediction[];
  generateExerciseExplanation(params: GenerateExerciseExplanationParams): ExerciseExplanationResult;
}
