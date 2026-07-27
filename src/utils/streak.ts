import { format } from 'date-fns';
import { getProgramDayForDate, type ProgramTree } from '../services/api/queries/programs';
import { getWeeklyScheduleForDate, type WeeklyScheduleEntry } from '../services/api/queries/weeklySchedule';

const MAX_LOOKBACK_DAYS = 90;

/**
 * Consecutive-day streak ending today, walking backward. Rest days pass
 * through without breaking or extending the streak; a training day that
 * wasn't completed ends it. Today itself only counts once it's completed —
 * an unfinished "today" doesn't retroactively break yesterday's streak, it
 * just isn't added yet. Capped at a 90-day lookback so a very long streak
 * still resolves in bounded time; callers can display "90+" at the cap.
 *
 * A day counts as non-rest if either the AI program resolves a training day
 * or a recurring weekly_schedule assignment exists for that weekday — most
 * users have no active program, so relying on `program` alone would leave
 * their streak blind to every missed recurring day.
 */
export function computeStreak(
  program: ProgramTree | null | undefined,
  completedDates: Set<string>,
  today: Date = new Date(),
  weeklySchedule?: WeeklyScheduleEntry[] | null,
): number {
  const todayKey = format(today, 'yyyy-MM-dd');
  let streak = completedDates.has(todayKey) ? 1 : 0;

  const cursor = new Date(today);
  cursor.setDate(cursor.getDate() - 1);

  for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
    const key = format(cursor, 'yyyy-MM-dd');
    if (completedDates.has(key)) {
      streak++;
    } else {
      const resolved = getProgramDayForDate(program, cursor);
      const hasWeeklyPlan = getWeeklyScheduleForDate(weeklySchedule, cursor) != null;
      const isRestDay = (!resolved || resolved.day.is_rest_day) && !hasWeeklyPlan;
      if (!isRestDay) break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
