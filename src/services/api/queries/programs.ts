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

export type ProgramDayWithContext = ProgramDayWithExercises & {
  program_weeks: Pick<ProgramWeekRow, 'week_number' | 'focus'> & {
    programs: Pick<ProgramRow, 'title'>;
  };
};

export async function fetchProgramDay(programDayId: string): Promise<ProgramDayWithContext> {
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

export type ProgramDaySummary = {
  programDayId: string;
  title: string;
  programTitle: string;
  exerciseCount: number;
  previewNames: string[];
};

type ProgramDayForSummary = {
  id: string;
  title: string | null;
  is_rest_day: boolean;
  program_exercises: Array<{ order_index: number; exercises: Pick<ExerciseRow, 'name'> }>;
};

/** Flattens every non-rest-day across all of the user's programs (not just
 * the active one) — used by the Library's "Existing Workouts" section. */
async function fetchAllProgramDaysWithExercises(userId: string): Promise<ProgramDaySummary[]> {
  const { data, error } = await supabase
    .from('programs')
    .select(
      `id, title,
      program_weeks (
        program_days (
          id, title, is_rest_day,
          program_exercises ( order_index, exercises ( name ) )
        )
      )`,
    )
    .eq('user_id', userId);

  if (error) throw error;

  const programs = data as unknown as Array<{
    id: string;
    title: string;
    program_weeks: Array<{ program_days: ProgramDayForSummary[] }>;
  }>;

  const summaries: ProgramDaySummary[] = [];
  for (const program of programs) {
    for (const week of program.program_weeks) {
      for (const day of week.program_days) {
        if (day.is_rest_day) continue;
        const sorted = [...day.program_exercises].sort((a, b) => a.order_index - b.order_index);
        summaries.push({
          programDayId: day.id,
          title: day.title ?? 'Training Day',
          programTitle: program.title,
          exerciseCount: sorted.length,
          previewNames: sorted.slice(0, 3).map(pe => pe.exercises.name),
        });
      }
    }
  }
  return summaries;
}

export function useAllProgramDaysWithExercises(userId: string | null) {
  return useQuery({
    queryKey: ['programDays', 'all', userId],
    queryFn: () => fetchAllProgramDaysWithExercises(userId as string),
    enabled: userId != null,
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

/**
 * Same idea as `getTodayProgramDay` but for an arbitrary date — used by the
 * Home calendar to resolve any visible day, not just today. Unlike
 * `getTodayProgramDay`, this does NOT clamp to the program's date range: a
 * date before the program started or after it ends correctly resolves to
 * `null` rather than being pulled into week 1 or the final week, since
 * showing "week 1" for a date three months before the program began would
 * misrepresent the calendar.
 */
export function getProgramDayForDate(
  program: ProgramTree | null | undefined,
  date: Date,
): { week: ProgramWeekWithDays; day: ProgramDayWithExercises } | null {
  if (!program) return null;

  const start = new Date(program.start_date);
  const daysSinceStart = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      86_400_000,
  );
  if (daysSinceStart < 0) return null;

  const weekNumber = Math.floor(daysSinceStart / 7) + 1;
  if (weekNumber > program.weeks_count) return null;

  const week = program.program_weeks.find(w => w.week_number === weekNumber);
  if (!week) return null;

  const dayOfWeek = date.getDay();
  const day = week.program_days.find(d => d.day_of_week === dayOfWeek);
  if (!day) return null;

  return { week, day };
}
