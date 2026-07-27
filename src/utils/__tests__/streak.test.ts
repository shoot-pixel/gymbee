import { format } from 'date-fns';
import { computeStreak } from '../streak';
import type { WeeklyScheduleEntry } from '../../services/api/queries/weeklySchedule';

function daysAgo(n: number, from: Date): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
}

function key(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function weeklyScheduleEntry(dayOfWeek: number): WeeklyScheduleEntry {
  return {
    id: 'ws-1',
    user_id: 'user-1',
    day_of_week: dayOfWeek,
    workout_template_id: 'template-1',
    day_type: 'training',
    created_at: '2024-01-01T00:00:00.000Z',
    workout_templates: { id: 'template-1', name: 'Core Day', workout_template_exercises: [] },
  };
}

describe('computeStreak', () => {
  it('returns 0 when nothing is completed and there is no program or weekly schedule', () => {
    const today = new Date('2026-03-05T12:00:00.000Z');
    expect(computeStreak(null, new Set(), today)).toBe(0);
  });

  it('counts consecutive completed days ending today', () => {
    const today = new Date('2026-03-05T12:00:00.000Z');
    const completed = new Set([key(today), key(daysAgo(1, today)), key(daysAgo(2, today))]);
    expect(computeStreak(null, completed, today)).toBe(3);
  });

  it('does not break the streak on a missed recurring (non-program) training day', () => {
    const today = new Date('2026-03-05T12:00:00.000Z'); // Thursday
    const missedRecurringDay = daysAgo(1, today); // Wednesday, recurring day, not completed
    const completed = new Set([key(today), key(daysAgo(2, today))]);
    const weeklySchedule = [weeklyScheduleEntry(missedRecurringDay.getDay())];

    // Without weekly-schedule awareness, the missed Wednesday would be
    // treated as a rest day (no program at all) and the streak would run
    // straight through to 3. With awareness, it's a missed training day and
    // the streak stops at today's single completion.
    expect(computeStreak(null, completed, today, weeklySchedule)).toBe(1);
  });

  it('continues past a completed recurring training day', () => {
    const today = new Date('2026-03-05T12:00:00.000Z'); // Thursday
    const recurringDay = daysAgo(1, today); // Wednesday
    const completed = new Set([key(today), key(recurringDay), key(daysAgo(2, today))]);
    const weeklySchedule = [weeklyScheduleEntry(recurringDay.getDay())];

    expect(computeStreak(null, completed, today, weeklySchedule)).toBe(3);
  });
});
