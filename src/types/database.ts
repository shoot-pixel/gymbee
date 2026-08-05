/**
 * Hand-authored to match supabase/migrations/*.sql exactly (the Supabase CLI
 * isn't linked to the project in this environment, so
 * `supabase gen types typescript` can't run here). If the user links the CLI
 * later, this file can be regenerated and should match structurally.
 */

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainingGoal = 'strength' | 'hypertrophy' | 'endurance' | 'general_fitness';
export type UnitPreference = 'kg' | 'lb';
export type Sex = 'male' | 'female';
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
export type DayType = 'training' | 'rest' | 'cardio';
export type DayOverrideStatus = 'rest' | 'missed';
export type CardioEffort = 'easy' | 'moderate' | 'hard';
export type ProgramStatus = 'active' | 'completed' | 'archived';
export type ChatRole = 'user' | 'assistant';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
/** Body-composition intent — a separate axis from TrainingGoal (how you
 * train, not what you're trying to do to your body composition). */
export type NutritionGoal = 'cut' | 'bulk' | 'maintain';
/** 'pending' entries (from an unconfirmed AI photo estimate) never count
 * toward the Home energy card's totals until the athlete confirms/edits
 * them — see 0063_food_photo_logging.sql. Manual entries default straight
 * to 'confirmed'. */
export type FoodLogStatus = 'pending' | 'confirmed' | 'skipped';
export type FoodLogConfidence = 'high' | 'medium' | 'low';
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
export type DmConversationStatus = 'pending' | 'accepted' | 'declined';
export type IntegrationProvider = 'whoop' | 'spotify';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'nudity_or_sexual_content'
  | 'violence_or_dangerous_behavior'
  | 'impersonation'
  | 'false_information'
  | 'other';
export type ReportTarget = 'post' | 'comment' | 'message' | 'conversation' | 'profile';
export type ReportStatus = 'open' | 'actioned' | 'dismissed';
export type SubscriptionSource = 'revenuecat' | 'manual_grant';
export type SubscriptionStatus = 'active' | 'canceled' | 'expired';
export type WorkoutShareType = 'single_workout' | 'weekly_plan';
export type WorkoutShareStatus = 'pending' | 'accepted' | 'declined';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          /** Normalized 0-1 fraction of the source photo's own bounding box —
           * same convention as CSS `object-position` — that the circular
           * Avatar crop centers on. (0.5, 0.5) is a plain center crop. */
          avatar_focal_x: number;
          avatar_focal_y: number;
          handle: string | null;
          bio: string | null;
          birth_date: string | null;
          height_cm: number | null;
          sex: Sex | null;
          experience_level: ExperienceLevel | null;
          goal: TrainingGoal | null;
          /** Body-composition intent (0062_food_logging.sql) — defaults
           * 'maintain' for every existing athlete since none of them ever
           * chose one; onboarding/settings UI to set it explicitly is a
           * later phase. */
          nutrition_goal: NutritionGoal;
          days_per_week: number | null;
          equipment_access: string[];
          injuries_notes: string | null;
          unit_preference: UnitPreference;
          onboarding_completed: boolean;
          hide_stats_from_friends: boolean;
          hide_photos_from_friends: boolean;
          /** Opts out of the Live Now rail/leaderboard indicator (see
           * 0051_live_friend_workouts.sql) — friends stop seeing your
           * current exercise while you're mid-workout. Doesn't affect
           * anything else (posts, stats, At My Gym). */
          hide_live_workout_from_friends: boolean;
          /** Instagram-style private-account toggle — true (the default)
           * means adding this athlete as a friend requires their approval;
           * false means a friend_requests row addressed to them is
           * auto-accepted server-side (see the trigger in
           * 0036_profile_visibility.sql) instead of staying pending. */
          is_private: boolean;
          /** Last time this athlete opened Messages / their own profile —
           * the cutoff a new message or a new like/comment on their posts
           * is compared against to decide whether it's still "unseen". */
          messages_seen_at: string;
          activity_seen_at: string;
          /** Per-category push toggles from the Notifications settings
           * screen — Messages has no UI toggle (always-on there) but still
           * carries a column for schema symmetry; send-push checks it like
           * any other category. */
          push_messages_enabled: boolean;
          push_friends_enabled: boolean;
          push_activity_enabled: boolean;
          push_ai_coach_enabled: boolean;
          /** Sub-toggle under push_ai_coach_enabled — send-push requires
           * both before sending a meal-gap reminder. */
          push_meal_reminders_enabled: boolean;
          /** Set the first time the in-app permission primer is shown, so it
           * never shows twice for the same athlete — see
           * useNotificationPrimer. */
          push_primer_shown_at: string | null;
          /** IANA zone name (e.g. "America/New_York"), synced from the
           * client's own Intl.DateTimeFormat().resolvedOptions().timeZone
           * on app start (see useSyncTimezone) — the proactive-coach cron
           * sweep is the first thing that ever needs a user's local time
           * server-side. Null until synced; treated as UTC until then. */
          timezone: string | null;
          /** Denormalized from subscriptions (0050_premium_subscriptions.sql)
           * — kept correct exclusively by sync_is_premium(), never a client
           * write. Deliberately absent from the Insert/Update types below:
           * the DB itself revokes UPDATE on this column from `authenticated`,
           * and this file shouldn't offer a type-safe way to attempt it. */
          is_premium: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          avatar_focal_x?: number;
          avatar_focal_y?: number;
          handle?: string | null;
          bio?: string | null;
          birth_date?: string | null;
          height_cm?: number | null;
          sex?: Sex | null;
          experience_level?: ExperienceLevel | null;
          goal?: TrainingGoal | null;
          nutrition_goal?: NutritionGoal;
          days_per_week?: number | null;
          equipment_access?: string[];
          injuries_notes?: string | null;
          unit_preference?: UnitPreference;
          onboarding_completed?: boolean;
          hide_stats_from_friends?: boolean;
          hide_photos_from_friends?: boolean;
          hide_live_workout_from_friends?: boolean;
          is_private?: boolean;
          messages_seen_at?: string;
          activity_seen_at?: string;
          push_messages_enabled?: boolean;
          push_friends_enabled?: boolean;
          push_activity_enabled?: boolean;
          push_ai_coach_enabled?: boolean;
          push_meal_reminders_enabled?: boolean;
          push_primer_shown_at?: string | null;
          timezone?: string | null;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          avatar_focal_x?: number;
          avatar_focal_y?: number;
          handle?: string | null;
          bio?: string | null;
          birth_date?: string | null;
          height_cm?: number | null;
          sex?: Sex | null;
          experience_level?: ExperienceLevel | null;
          goal?: TrainingGoal | null;
          nutrition_goal?: NutritionGoal;
          days_per_week?: number | null;
          equipment_access?: string[];
          injuries_notes?: string | null;
          unit_preference?: UnitPreference;
          onboarding_completed?: boolean;
          hide_stats_from_friends?: boolean;
          hide_photos_from_friends?: boolean;
          hide_live_workout_from_friends?: boolean;
          is_private?: boolean;
          messages_seen_at?: string;
          activity_seen_at?: string;
          push_messages_enabled?: boolean;
          push_friends_enabled?: boolean;
          push_activity_enabled?: boolean;
          push_ai_coach_enabled?: boolean;
          push_meal_reminders_enabled?: boolean;
          push_primer_shown_at?: string | null;
          timezone?: string | null;
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
          day_type: DayType;
        };
        Insert: {
          program_week_id: string;
          day_number: number;
          day_of_week?: number | null;
          title?: string | null;
          is_rest_day?: boolean;
          day_type?: DayType;
        };
        Update: {
          day_number?: number;
          day_of_week?: number | null;
          title?: string | null;
          is_rest_day?: boolean;
          day_type?: DayType;
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
      weekly_schedule: {
        Row: {
          id: string;
          user_id: string;
          day_of_week: number;
          workout_template_id: string | null;
          day_type: DayType;
          created_at: string;
        };
        Insert: {
          user_id: string;
          day_of_week: number;
          workout_template_id?: string | null;
          day_type?: DayType;
        };
        Update: {
          workout_template_id?: string | null;
          day_type?: DayType;
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
      day_overrides: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          status: DayOverrideStatus;
          created_at: string;
        };
        Insert: {
          user_id: string;
          date: string;
          status: DayOverrideStatus;
        };
        Update: {
          status?: DayOverrideStatus;
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
          duration_seconds: number | null;
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
          duration_seconds?: number | null;
          is_warmup?: boolean;
          completed?: boolean;
        };
        Update: {
          reps?: number;
          load_kg?: number | null;
          rpe?: number | null;
          duration_seconds?: number | null;
          is_warmup?: boolean;
          completed?: boolean;
        };
        Relationships: [];
      };
      cardio_log_entries: {
        Row: {
          id: string;
          user_id: string;
          workout_log_id: string;
          exercise_id: string | null;
          custom_activity_name: string | null;
          duration_minutes: number;
          incline_pct: number | null;
          speed_kmh: number | null;
          distance_km: number | null;
          effort: CardioEffort | null;
          estimated_calories: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          workout_log_id: string;
          exercise_id?: string | null;
          custom_activity_name?: string | null;
          duration_minutes: number;
          incline_pct?: number | null;
          speed_kmh?: number | null;
          distance_km?: number | null;
          effort?: CardioEffort | null;
          estimated_calories: number;
        };
        Update: never;
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
      food_log_entries: {
        Row: {
          id: string;
          user_id: string;
          logged_at: string;
          name: string;
          meal_type: MealType | null;
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          status: FoodLogStatus;
          confidence: FoodLogConfidence | null;
          photo_path: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          logged_at?: string;
          name: string;
          meal_type?: MealType | null;
          calories: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          status?: FoodLogStatus;
          confidence?: FoodLogConfidence | null;
          photo_path?: string | null;
        };
        Update: {
          logged_at?: string;
          name?: string;
          meal_type?: MealType | null;
          calories?: number;
          protein_g?: number;
          carbs_g?: number;
          fat_g?: number;
          status?: FoodLogStatus;
          confidence?: FoodLogConfidence | null;
          photo_path?: string | null;
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
          content: string | null;
          /** Path within the private `chat-photos` bucket — a food photo
           * the athlete attached, or null for a plain-text message. */
          photo_path: string | null;
          /** Set on the assistant reply that resulted in a food estimate
           * (see chat-coach's log_food_estimate tool) — the client renders
           * FoodEstimateCard instead of plain text when this is present. */
          food_log_entry_id: string | null;
          created_at: string;
        };
        Insert: {
          conversation_id: string;
          role: ChatRole;
          content?: string | null;
          photo_path?: string | null;
          food_log_entry_id?: string | null;
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
      gym_checkins: {
        Row: {
          user_id: string;
          latitude: number;
          longitude: number;
          checked_in_at: string;
          expires_at: string;
        };
        Insert: {
          user_id: string;
          latitude: number;
          longitude: number;
          checked_in_at?: string;
          expires_at: string;
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
      post_comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          body: string;
        };
        Update: never;
        Relationships: [];
      };
      post_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
        };
        Update: never;
        Relationships: [];
      };
      post_tags: {
        Row: {
          id: string;
          post_id: string;
          tagged_user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          tagged_user_id: string;
        };
        Update: never;
        Relationships: [];
      };
      dm_conversations: {
        Row: {
          id: string;
          requester_id: string;
          recipient_id: string;
          status: DmConversationStatus;
          created_at: string;
          last_message_at: string;
          /** Kept current by the dm_touch_conversation trigger — lets
           * "do I have an unread message here" exclude threads whose last
           * message was the caller's own, without a second query. */
          last_message_sender_id: string | null;
          /** "Delete conversation" is per-participant, not a real delete —
           * whichever side hid it stops seeing it in their inbox until the
           * other side sends a new message (dm_touch_conversation resets
           * both back to false). Never written directly by the client —
           * only via the set_dm_conversation_hidden() RPC, so it's absent
           * from Update below. */
          hidden_for_requester: boolean;
          hidden_for_recipient: boolean;
        };
        Insert: {
          requester_id: string;
          recipient_id: string;
          status?: DmConversationStatus;
        };
        Update: {
          status?: DmConversationStatus;
        };
        Relationships: [];
      };
      dm_messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string | null;
          photo_path: string | null;
          workout_share_id: string | null;
          created_at: string;
        };
        Insert: {
          conversation_id: string;
          sender_id: string;
          body?: string | null;
          photo_path?: string | null;
          workout_share_id?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      dm_message_likes: {
        Row: {
          id: string;
          message_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          message_id: string;
          user_id: string;
        };
        Update: never;
        Relationships: [];
      };
      /** `payload`'s shape depends on `share_type` — see WorkoutSnapshot /
       * SingleWorkoutPayload / WeeklyPlanPayload in
       * services/api/queries/workoutShares.ts. Kept as a plain `unknown`
       * jsonb here (not a discriminated union) since Supabase's own jsonb
       * columns are untyped at this layer everywhere else in this file too. */
      workout_shares: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string;
          share_type: WorkoutShareType;
          title: string;
          payload: unknown;
          status: WorkoutShareStatus;
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          sender_id: string;
          recipient_id: string;
          share_type: WorkoutShareType;
          title: string;
          payload: unknown;
          status?: WorkoutShareStatus;
        };
        Update: {
          status?: WorkoutShareStatus;
          responded_at?: string | null;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          token: string;
          user_id: string;
          platform: 'ios';
          created_at: string;
          last_seen_at: string;
        };
        Insert: {
          token: string;
          user_id: string;
          platform?: 'ios';
          last_seen_at?: string;
        };
        Update: {
          last_seen_at?: string;
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
          notes: string | null;
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
          notes?: string | null;
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
          notes?: string | null;
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
      integration_connections: {
        Row: {
          id: string;
          user_id: string;
          provider: IntegrationProvider;
          client_id: string | null;
          client_secret: string | null;
          access_token: string | null;
          refresh_token: string | null;
          token_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          provider: IntegrationProvider;
          client_id?: string | null;
          client_secret?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
        };
        Update: {
          client_id?: string | null;
          client_secret?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
        };
        Relationships: [];
      };
      oauth_states: {
        Row: {
          state: string;
          user_id: string;
          provider: IntegrationProvider;
          created_at: string;
        };
        Insert: {
          user_id: string;
          provider: IntegrationProvider;
        };
        Update: never;
        Relationships: [];
      };
      whoop_metrics: {
        Row: {
          id: string;
          user_id: string;
          cycle_date: string;
          whoop_cycle_id: string | null;
          score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
          recovery_score: number | null;
          sleep_performance_pct: number | null;
          strain: number | null;
          hrv_ms: number | null;
          resting_heart_rate: number | null;
          synced_at: string;
        };
        // Client is select-only (RLS has no insert/update policy) — all
        // writes go through whoop-sync's service-role client.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_user_id: string;
          target_type: ReportTarget;
          target_id: string;
          reason: ReportReason;
          details: string | null;
          status: ReportStatus;
          created_at: string;
        };
        Insert: {
          reporter_id: string;
          reported_user_id: string;
          target_type: ReportTarget;
          target_id: string;
          reason: ReportReason;
          details?: string | null;
        };
        // Insert-only from the client — see migration 0042.
        Update: never;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          source: SubscriptionSource;
          status: SubscriptionStatus;
          plan: string;
          started_at: string;
          expires_at: string | null;
          revenuecat_customer_id: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        // Read-only from the client — every write goes through
        // admin_grant_premium/admin_revoke_premium (SQL editor only) or the
        // RevenueCat webhook handler (service_role). See 0050_premium_subscriptions.sql.
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      public_profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          avatar_focal_x: number;
          avatar_focal_y: number;
          handle: string | null;
          bio: string | null;
          hide_stats_from_friends: boolean;
          hide_photos_from_friends: boolean;
          is_private: boolean;
          is_premium: boolean;
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
    // Left as Record<string, never> rather than typing is_handle_taken (see
    // migration 0033) here — populating Functions with a concrete shape
    // breaks unrelated embedded-relationship inference on totally unrelated
    // tables elsewhere in this file (a confirmed supabase-js/TS generic
    // resolution quirk, not a real schema conflict). SignUpScreen types that
    // one RPC call locally instead.
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
      integration_provider: IntegrationProvider;
      report_reason: ReportReason;
      report_target: ReportTarget;
    };
  };
}
