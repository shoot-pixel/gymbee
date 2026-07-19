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
export type ProgramSource = 'ai_generated' | 'manual' | 'template';
export type ProgramStatus = 'active' | 'completed' | 'archived';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          experience_level: ExperienceLevel | null;
          goal: TrainingGoal | null;
          days_per_week: number | null;
          equipment_access: string[];
          injuries_notes: string | null;
          unit_preference: UnitPreference;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          experience_level?: ExperienceLevel | null;
          goal?: TrainingGoal | null;
          days_per_week?: number | null;
          equipment_access?: string[];
          injuries_notes?: string | null;
          unit_preference?: UnitPreference;
          onboarding_completed?: boolean;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          experience_level?: ExperienceLevel | null;
          goal?: TrainingGoal | null;
          days_per_week?: number | null;
          equipment_access?: string[];
          injuries_notes?: string | null;
          unit_preference?: UnitPreference;
          onboarding_completed?: boolean;
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
        };
        Update: {
          name?: string;
          category?: ExerciseCategory;
          primary_muscle?: string;
          equipment?: EquipmentType;
          instructions?: string | null;
          demo_media_url?: string | null;
          demo_media_type?: DemoMediaType | null;
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
      workout_logs: {
        Row: {
          id: string;
          user_id: string;
          program_day_id: string | null;
          started_at: string;
          completed_at: string | null;
          notes: string | null;
          overall_rpe: number | null;
        };
        Insert: {
          user_id: string;
          program_day_id?: string | null;
          started_at?: string;
          completed_at?: string | null;
          notes?: string | null;
          overall_rpe?: number | null;
        };
        Update: {
          completed_at?: string | null;
          notes?: string | null;
          overall_rpe?: number | null;
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
    };
    Views: {
      public_profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
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
    };
  };
}
