/**
 * Hand-authored to match supabase/migrations/*.sql exactly (the Supabase CLI
 * isn't linked to the project in this environment, so
 * `supabase gen types typescript` can't run here). If the user links the CLI
 * later, this file can be regenerated and should match structurally.
 */

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainingGoal = 'strength' | 'hypertrophy' | 'endurance' | 'general_fitness';
export type UnitPreference = 'kg' | 'lb';
export type ExerciseCategory =
  | 'push'
  | 'pull'
  | 'legs'
  | 'core'
  | 'full_body'
  | 'cardio'
  | 'mobility';
export type EquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'other';
export type DemoMediaType = 'video' | 'image';
/** Mirrors activeWorkoutStore's `SetMetric` — kept independent (rather than
 * imported) since database.ts describes wire/DB shapes and the store
 * imports from here, not the other way around. */
export type ExerciseDefaultMetric = 'weight_lb' | 'weight_kg' | 'weight_pct' | 'reps' | 'time';
export type ProgramSource = 'ai_generated' | 'manual' | 'template';
export type ProgramStatus = 'active' | 'completed' | 'archived';
export type ChatRole = 'user' | 'assistant';
export type AdaptationType =
  | 'reduce_sets'
  | 'reduce_weight'
  | 'reduce_rpe'
  | 'increase_rest'
  | 'swap_exercise'
  | 'lighter_variation'
  | 'recovery_replacement'
  | 'shorten_workout'
  | 'reschedule';
export type AdaptationSource = 'rule_engine' | 'ai' | 'user';
export type AdaptationStatus = 'pending' | 'accepted' | 'rejected' | 'edited';
export type SetRecommendationType =
  | 'increase_weight'
  | 'keep_weight'
  | 'reduce_weight'
  | 'increase_rest'
  | 'stop_exercise'
  | 'remove_last_set'
  | 'adjust_reps';
export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'push_horizontal'
  | 'push_vertical'
  | 'pull_horizontal'
  | 'pull_vertical'
  | 'carry'
  | 'rotation'
  | 'isolation'
  | 'core'
  | 'cardio';
export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced';
/** Reused for both joint_stress and skill_requirement columns. */
export type StressLevel = 'low' | 'moderate' | 'high';
export type SubstitutionScope = 'workout_only' | 'permanent';
export type WorkoutVariantType =
  | 'full'
  | 'time_45'
  | 'time_30'
  | 'hotel'
  | 'home'
  | 'bodyweight'
  | 'low_readiness'
  | 'strength_focus'
  | 'hypertrophy_focus'
  | 'reduced_impact';
export type TrainingPatternType =
  | 'inconsistent_weekday'
  | 'declining_consistency'
  | 'recurring_pain'
  | 'rpe_creep'
  | 'low_sleep_pattern';
export type TrainingPatternStatus = 'active' | 'dismissed' | 'resolved';
export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';
export type PostType = 'progress_photo' | 'before_after_photo';
export type PostVisibility = 'private' | 'friends';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          handle: string | null;
          experience_level: ExperienceLevel | null;
          goal: TrainingGoal | null;
          days_per_week: number | null;
          equipment_access: string[];
          injuries_notes: string | null;
          unit_preference: UnitPreference;
          onboarding_completed: boolean;
          hide_stats_from_friends: boolean;
          hide_photos_from_friends: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          handle?: string | null;
          experience_level?: ExperienceLevel | null;
          goal?: TrainingGoal | null;
          days_per_week?: number | null;
          equipment_access?: string[];
          injuries_notes?: string | null;
          unit_preference?: UnitPreference;
          onboarding_completed?: boolean;
          hide_stats_from_friends?: boolean;
          hide_photos_from_friends?: boolean;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          handle?: string | null;
          experience_level?: ExperienceLevel | null;
          goal?: TrainingGoal | null;
          days_per_week?: number | null;
          equipment_access?: string[];
          injuries_notes?: string | null;
          unit_preference?: UnitPreference;
          onboarding_completed?: boolean;
          hide_stats_from_friends?: boolean;
          hide_photos_from_friends?: boolean;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          category: ExerciseCategory;
          primary_muscle: string;
          equipment: EquipmentType;
          instructions: string | null;
          demo_media_url: string | null;
          demo_media_type: DemoMediaType | null;
          is_custom: boolean;
          created_by: string | null;
          created_at: string;
          movement_pattern: MovementPattern | null;
          secondary_muscles: string[];
          difficulty: ExerciseDifficulty | null;
          joint_stress: StressLevel | null;
          skill_requirement: StressLevel | null;
          default_metric: ExerciseDefaultMetric | null;
        };
        Insert: {
          name: string;
          category: ExerciseCategory;
          primary_muscle: string;
          equipment: EquipmentType;
          instructions?: string | null;
          demo_media_url?: string | null;
          demo_media_type?: DemoMediaType | null;
          is_custom?: boolean;
          created_by?: string | null;
          movement_pattern?: MovementPattern | null;
          secondary_muscles?: string[];
          difficulty?: ExerciseDifficulty | null;
          joint_stress?: StressLevel | null;
          skill_requirement?: StressLevel | null;
          default_metric?: ExerciseDefaultMetric | null;
        };
        Update: {
          name?: string;
          category?: ExerciseCategory;
          primary_muscle?: string;
          equipment?: EquipmentType;
          instructions?: string | null;
          demo_media_url?: string | null;
          demo_media_type?: DemoMediaType | null;
          movement_pattern?: MovementPattern | null;
          secondary_muscles?: string[];
          difficulty?: ExerciseDifficulty | null;
          joint_stress?: StressLevel | null;
          default_metric?: ExerciseDefaultMetric | null;
          skill_requirement?: StressLevel | null;
        };
        Relationships: [];
      };
      programs: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          goal: TrainingGoal | null;
          source: ProgramSource;
          status: ProgramStatus;
          start_date: string;
          weeks_count: number;
          days_per_week: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          title: string;
          goal?: TrainingGoal | null;
          source?: ProgramSource;
          status?: ProgramStatus;
          start_date?: string;
          weeks_count: number;
          days_per_week: number;
        };
        Update: {
          title?: string;
          goal?: TrainingGoal | null;
          source?: ProgramSource;
          status?: ProgramStatus;
          start_date?: string;
          weeks_count?: number;
          days_per_week?: number;
        };
        Relationships: [];
      };
      program_weeks: {
        Row: {
          id: string;
          program_id: string;
          week_number: number;
          focus: string | null;
          deload: boolean;
        };
        Insert: {
          program_id: string;
          week_number: number;
          focus?: string | null;
          deload?: boolean;
        };
        Update: {
          week_number?: number;
          focus?: string | null;
          deload?: boolean;
        };
        Relationships: [];
      };
      program_days: {
        Row: {
          id: string;
          program_week_id: string;
          day_number: number;
          day_of_week: number | null;
          title: string | null;
          is_rest_day: boolean;
        };
        Insert: {
          program_week_id: string;
          day_number: number;
          day_of_week?: number | null;
          title?: string | null;
          is_rest_day?: boolean;
        };
        Update: {
          day_number?: number;
          day_of_week?: number | null;
          title?: string | null;
          is_rest_day?: boolean;
        };
        Relationships: [];
      };
      program_exercises: {
        Row: {
          id: string;
          program_day_id: string;
          exercise_id: string;
          order_index: number;
          target_sets: number;
          target_reps_min: number | null;
          target_reps_max: number | null;
          target_load_kg: number | null;
          target_rpe: number | null;
          rest_seconds: number | null;
          notes: string | null;
        };
        Insert: {
          program_day_id: string;
          exercise_id: string;
          order_index?: number;
          target_sets: number;
          target_reps_min?: number | null;
          target_reps_max?: number | null;
          target_load_kg?: number | null;
          target_rpe?: number | null;
          rest_seconds?: number | null;
          notes?: string | null;
        };
        Update: {
          order_index?: number;
          target_sets?: number;
          target_reps_min?: number | null;
          target_reps_max?: number | null;
          target_load_kg?: number | null;
          target_rpe?: number | null;
          rest_seconds?: number | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      workout_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          notes: string | null;
          estimated_duration_minutes: number | null;
          source_program_day_id: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          name: string;
          notes?: string | null;
          estimated_duration_minutes?: number | null;
          source_program_day_id?: string | null;
        };
        Update: {
          name?: string;
          notes?: string | null;
          estimated_duration_minutes?: number | null;
        };
        Relationships: [];
      };
      workout_template_exercises: {
        Row: {
          id: string;
          workout_template_id: string;
          exercise_id: string;
          order_index: number;
          target_sets: number;
          target_reps_min: number | null;
          target_reps_max: number | null;
          target_load_kg: number | null;
          target_rpe: number | null;
          rest_seconds: number | null;
          notes: string | null;
        };
        Insert: {
          workout_template_id: string;
          exercise_id: string;
          order_index?: number;
          target_sets: number;
          target_reps_min?: number | null;
          target_reps_max?: number | null;
          target_load_kg?: number | null;
          target_rpe?: number | null;
          rest_seconds?: number | null;
          notes?: string | null;
        };
        Update: {
          order_index?: number;
          target_sets?: number;
          target_reps_min?: number | null;
          target_reps_max?: number | null;
          target_load_kg?: number | null;
          target_rpe?: number | null;
          rest_seconds?: number | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      scheduled_workouts: {
        Row: {
          id: string;
          user_id: string;
          scheduled_date: string;
          name: string;
          notes: string | null;
          source_template_id: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          scheduled_date: string;
          name: string;
          notes?: string | null;
          source_template_id?: string | null;
        };
        Update: {
          scheduled_date?: string;
          name?: string;
          notes?: string | null;
        };
        Relationships: [];
      };
      scheduled_workout_exercises: {
        Row: {
          id: string;
          scheduled_workout_id: string;
          exercise_id: string;
          order_index: number;
          target_sets: number;
          target_reps_min: number | null;
          target_reps_max: number | null;
          target_load_kg: number | null;
          target_rpe: number | null;
          rest_seconds: number | null;
          notes: string | null;
        };
        Insert: {
          scheduled_workout_id: string;
          exercise_id: string;
          order_index?: number;
          target_sets: number;
          target_reps_min?: number | null;
          target_reps_max?: number | null;
          target_load_kg?: number | null;
          target_rpe?: number | null;
          rest_seconds?: number | null;
          notes?: string | null;
        };
        Update: {
          order_index?: number;
          target_sets?: number;
          target_reps_min?: number | null;
          target_reps_max?: number | null;
          target_load_kg?: number | null;
          target_rpe?: number | null;
          rest_seconds?: number | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      workout_logs: {
        Row: {
          id: string;
          user_id: string;
          program_day_id: string | null;
          scheduled_workout_id: string | null;
          started_at: string;
          completed_at: string | null;
          notes: string | null;
          overall_rpe: number | null;
          rating: number | null;
          variant_type: WorkoutVariantType | null;
        };
        Insert: {
          user_id: string;
          program_day_id?: string | null;
          scheduled_workout_id?: string | null;
          started_at?: string;
          completed_at?: string | null;
          notes?: string | null;
          overall_rpe?: number | null;
          rating?: number | null;
          variant_type?: WorkoutVariantType | null;
        };
        Update: {
          completed_at?: string | null;
          notes?: string | null;
          overall_rpe?: number | null;
          rating?: number | null;
        };
        Relationships: [];
      };
      workout_log_sets: {
        Row: {
          id: string;
          workout_log_id: string;
          exercise_id: string;
          set_number: number;
          reps: number;
          load_kg: number | null;
          rpe: number | null;
          is_warmup: boolean;
          completed: boolean;
          logged_at: string;
        };
        Insert: {
          workout_log_id: string;
          exercise_id: string;
          set_number: number;
          reps: number;
          load_kg?: number | null;
          rpe?: number | null;
          is_warmup?: boolean;
          completed?: boolean;
        };
        Update: {
          reps?: number;
          load_kg?: number | null;
          rpe?: number | null;
          is_warmup?: boolean;
          completed?: boolean;
        };
        Relationships: [];
      };
      body_metrics: {
        Row: {
          id: string;
          user_id: string;
          logged_at: string;
          weight_kg: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          logged_at?: string;
          weight_kg: number;
          notes?: string | null;
        };
        Update: {
          logged_at?: string;
          weight_kg?: number;
          notes?: string | null;
        };
        Relationships: [];
      };
      chat_conversations: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
        };
        Update: never;
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: ChatRole;
          content: string;
          created_at: string;
        };
        Insert: {
          conversation_id: string;
          role: ChatRole;
          content: string;
        };
        Update: never;
        Relationships: [];
      };
      follows: {
        Row: {
          follower_id: string;
          followee_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          followee_id: string;
        };
        Update: never;
        Relationships: [];
      };
      friend_requests: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: FriendRequestStatus;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          requester_id: string;
          addressee_id: string;
          status?: FriendRequestStatus;
          resolved_at?: string | null;
        };
        Update: {
          status?: FriendRequestStatus;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      blocked_users: {
        Row: {
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
        };
        Update: never;
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          post_type: PostType;
          visibility: PostVisibility;
          caption: string | null;
          photo_path: string | null;
          before_photo_path: string | null;
          after_photo_path: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          post_type: PostType;
          visibility?: PostVisibility;
          caption?: string | null;
          photo_path?: string | null;
          before_photo_path?: string | null;
          after_photo_path?: string | null;
        };
        Update: {
          visibility?: PostVisibility;
          caption?: string | null;
          photo_path?: string | null;
          before_photo_path?: string | null;
          after_photo_path?: string | null;
        };
        Relationships: [];
      };
      readiness_checkins: {
        Row: {
          id: string;
          user_id: string;
          checkin_date: string;
          sleep_hours: number | null;
          sleep_quality: number | null;
          soreness: number | null;
          stress: number | null;
          has_pain: boolean;
          pain_notes: string | null;
          resting_heart_rate: number | null;
          hrv_ms: number | null;
          wearable_recovery_score: number | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          checkin_date: string;
          sleep_hours?: number | null;
          sleep_quality?: number | null;
          soreness?: number | null;
          stress?: number | null;
          has_pain?: boolean;
          pain_notes?: string | null;
          resting_heart_rate?: number | null;
          hrv_ms?: number | null;
          wearable_recovery_score?: number | null;
        };
        Update: {
          sleep_hours?: number | null;
          sleep_quality?: number | null;
          soreness?: number | null;
          stress?: number | null;
          has_pain?: boolean;
          pain_notes?: string | null;
          resting_heart_rate?: number | null;
          hrv_ms?: number | null;
          wearable_recovery_score?: number | null;
        };
        Relationships: [];
      };
      workout_adaptations: {
        Row: {
          id: string;
          user_id: string;
          program_day_id: string | null;
          scheduled_workout_id: string | null;
          readiness_checkin_id: string | null;
          target_exercise_id: string | null;
          adaptation_type: AdaptationType;
          field_changed: string;
          original_value: unknown;
          updated_value: unknown;
          reason: string;
          confidence: number;
          source: AdaptationSource;
          status: AdaptationStatus;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          user_id: string;
          program_day_id?: string | null;
          scheduled_workout_id?: string | null;
          readiness_checkin_id?: string | null;
          target_exercise_id?: string | null;
          adaptation_type: AdaptationType;
          field_changed: string;
          original_value: unknown;
          updated_value: unknown;
          reason: string;
          confidence: number;
          source?: AdaptationSource;
          status?: AdaptationStatus;
          resolved_at?: string | null;
        };
        Update: {
          status?: AdaptationStatus;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      set_recommendations: {
        Row: {
          id: string;
          user_id: string;
          workout_log_id: string;
          exercise_id: string;
          after_set_number: number;
          recommendation_type: SetRecommendationType;
          recommended_reps: number | null;
          recommended_load_kg: number | null;
          recommended_rpe: number | null;
          recommended_rest_seconds: number | null;
          reason: string;
          confidence: number;
          source: AdaptationSource;
          status: AdaptationStatus;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          user_id: string;
          workout_log_id: string;
          exercise_id: string;
          after_set_number: number;
          recommendation_type: SetRecommendationType;
          recommended_reps?: number | null;
          recommended_load_kg?: number | null;
          recommended_rpe?: number | null;
          recommended_rest_seconds?: number | null;
          reason: string;
          confidence: number;
          source?: AdaptationSource;
          status?: AdaptationStatus;
          resolved_at?: string | null;
        };
        Update: {
          status?: AdaptationStatus;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      exercise_substitutions: {
        Row: {
          id: string;
          user_id: string;
          workout_log_id: string | null;
          original_exercise_id: string;
          substitute_exercise_id: string;
          reason: string;
          confidence: number;
          scope: SubstitutionScope;
          created_at: string;
        };
        Insert: {
          user_id: string;
          workout_log_id?: string | null;
          original_exercise_id: string;
          substitute_exercise_id: string;
          reason: string;
          confidence: number;
          scope: SubstitutionScope;
        };
        Update: never;
        Relationships: [];
      };
      training_patterns: {
        Row: {
          id: string;
          user_id: string;
          pattern_key: string;
          pattern_type: TrainingPatternType;
          confidence: number;
          title: string;
          detail: string;
          evidence_summary: string;
          status: TrainingPatternStatus;
          first_detected_at: string;
          last_detected_at: string;
          dismissed_at: string | null;
        };
        Insert: {
          user_id: string;
          pattern_key: string;
          pattern_type: TrainingPatternType;
          confidence: number;
          title: string;
          detail: string;
          evidence_summary: string;
          status?: TrainingPatternStatus;
          first_detected_at?: string;
          last_detected_at?: string;
          dismissed_at?: string | null;
        };
        Update: {
          confidence?: number;
          title?: string;
          detail?: string;
          evidence_summary?: string;
          status?: TrainingPatternStatus;
          last_detected_at?: string;
          dismissed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      public_profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          handle: string | null;
          hide_stats_from_friends: boolean;
          hide_photos_from_friends: boolean;
        };
        Relationships: [];
      };
      leaderboard_stats: {
        Row: {
          user_id: string;
          volume_this_month: number;
          workouts_this_month: number;
        };
        Relationships: [];
      };
      activity_feed: {
        Row: {
          workout_log_id: string;
          user_id: string;
          display_name: string | null;
          avatar_url: string | null;
          completed_at: string;
          day_title: string | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      experience_level: ExperienceLevel;
      training_goal: TrainingGoal;
      unit_preference: UnitPreference;
      exercise_category: ExerciseCategory;
      equipment_type: EquipmentType;
      demo_media_type: DemoMediaType;
      program_source: ProgramSource;
      program_status: ProgramStatus;
      chat_role: ChatRole;
      adaptation_type: AdaptationType;
      adaptation_source: AdaptationSource;
      adaptation_status: AdaptationStatus;
      set_recommendation_type: SetRecommendationType;
      movement_pattern: MovementPattern;
      exercise_difficulty: ExerciseDifficulty;
      stress_level: StressLevel;
      substitution_scope: SubstitutionScope;
      workout_variant_type: WorkoutVariantType;
      training_pattern_type: TrainingPatternType;
      training_pattern_status: TrainingPatternStatus;
      friend_request_status: FriendRequestStatus;
      post_type: PostType;
      post_visibility: PostVisibility;
    };
  };
}
