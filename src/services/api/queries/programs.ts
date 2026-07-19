import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import type { Database } from '../../../types/database';

type ProgramRow = Database['public']['Tables']['programs']['Row'];
type ProgramWeekRow = Database['public']['Tables']['program_weeks']['Row'];
type ProgramDayRow = Database['public']['Tables']['program_days']['Row'];
type ProgramExerciseRow = Database['public']['Tables']['program_exercises']['Row'];
type ExerciseRow = Database['public']['Tables']['exercises']['Row'];

export type ProgramExerciseWithExercise = ProgramExerciseRow & {
  exercises: Pick<ExerciseRow, 'id' | 'name' | 'category' | 'primary_muscle'>;
};
export type ProgramDayWithExercises = ProgramDayRow & {
  program_exercises: ProgramExerciseWithExercise[];
};
export type ProgramWeekWithDays = ProgramWeekRow & {
  program_days: ProgramDayWithExercises[];
};
export type ProgramTree = ProgramRow & {
  program_weeks: ProgramWeekWithDays[];
};

async function fetchActiveProgramTree(userId: string): Promise<ProgramTree | null> {
  const { data, error } = await supabase
    .from('programs')
    .select(
      `*,
      program_weeks (
        *,
        program_days (
          *,
          program_exercises (
            *,
            exercises ( id, name, category, primary_muscle )
          )
        )
      )`,
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('week_number', { foreignTable: 'program_weeks' })
    .order('day_number', { foreignTable: 'program_weeks.program_days' })
    .order('order_index', { foreignTable: 'program_weeks.program_days.program_exercises' })
    .maybeSingle();

  if (error) throw error;
  return data as ProgramTree | null;
}

export function useActiveProgramTree(userId: string | null) {
  return useQuery({
    queryKey: ['program', 'active', userId],
    queryFn: () => fetchActiveProgramTree(userId as string),
    enabled: userId != null,
  });
}

async function fetchProgramTreeById(programId: string): Promise<ProgramTree> {
  const { data, error } = await supabase
    .from('programs')
    .select(
      `*,
      program_weeks (
        *,
        program_days (
          *,
          program_exercises (
            *,
            exercises ( id, name, category, primary_muscle )
          )
        )
      )`,
    )
    .eq('id', programId)
    .order('week_number', { foreignTable: 'program_weeks' })
    .order('day_number', { foreignTable: 'program_weeks.program_days' })
    .order('order_index', { foreignTable: 'program_weeks.program_days.program_exercises' })
    .single();

  if (error) throw error;
  return data as ProgramTree;
}

export function useProgramTree(programId: string | undefined) {
  return useQuery({
    queryKey: ['program', programId],
    queryFn: () => fetchProgramTreeById(programId as string),
    enabled: programId != null,
  });
}

type ProgramDayWithContext = ProgramDayWithExercises & {
  program_weeks: Pick<ProgramWeekRow, 'week_number' | 'focus'> & {
    programs: Pick<ProgramRow, 'title'>;
  };
};

async function fetchProgramDay(programDayId: string): Promise<ProgramDayWithContext> {
  const { data, error } = await supabase
    .from('program_days')
    .select(
      `*,
      program_exercises (
        *,
        exercises ( id, name, category, primary_muscle )
      ),
      program_weeks (
        week_number,
        focus,
        programs ( title )
      )`,
    )
    .eq('id', programDayId)
    .order('order_index', { foreignTable: 'program_exercises' })
    .single();

  if (error) throw error;
  return data as ProgramDayWithContext;
}

export function useProgramDay(programDayId: string | undefined) {
  return useQuery({
    queryKey: ['programDay', programDayId],
    queryFn: () => fetchProgramDay(programDayId as string),
    enabled: programDayId != null,
  });
}

/**
 * Resolves which program_week is "current" from the program's start_date
 * (weeks progress sequentially, clamped to the program's length) and which
 * program_day within it matches today's day-of-week (0 = Sunday, JS convention).
 */
export function getTodayProgramDay(
  program: ProgramTree | null | undefined,
): { week: ProgramWeekWithDays; day: ProgramDayWithExercises } | null {
  if (!program) return null;

  const start = new Date(program.start_date);
  const today = new Date();
  const daysSinceStart = Math.floor(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      86_400_000,
  );
  const currentWeekNumber = Math.min(
    Math.max(Math.floor(daysSinceStart / 7) + 1, 1),
    program.weeks_count,
  );

  const week = program.program_weeks.find(w => w.week_number === currentWeekNumber);
  if (!week) return null;

  const todayDayOfWeek = today.getDay();
  const day = week.program_days.find(d => d.day_of_week === todayDayOfWeek);
  if (!day) return null;

  return { week, day };
}
