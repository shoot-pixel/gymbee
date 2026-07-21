import { computeE1rmHistories, type LoggedSet } from '../progress';

function loggedSet(overrides: Partial<LoggedSet>): LoggedSet {
  return {
    id: 'set-1',
    exerciseId: 'ex1',
    exerciseName: 'Squat',
    reps: 5,
    loadKg: 100,
    loggedAt: '2024-01-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('computeE1rmHistories', () => {
  it('collapses multiple sets on the same day to that day\'s max e1RM', () => {
    const histories = computeE1rmHistories([
      loggedSet({ id: 's1', loadKg: 100, reps: 5, loggedAt: '2024-01-01T10:00:00.000Z' }),
      loggedSet({ id: 's2', loadKg: 110, reps: 3, loggedAt: '2024-01-01T11:00:00.000Z' }),
      loggedSet({ id: 's3', loadKg: 80, reps: 5, loggedAt: '2024-01-01T12:00:00.000Z' }),
    ]);

    expect(histories).toHaveLength(1);
    expect(histories[0].points).toHaveLength(1);
    expect(histories[0].points[0].date).toBe('2024-01-01');
    expect(histories[0].points[0].e1rm).toBeCloseTo(110 * (1 + 3 / 30), 5);
  });

  it('returns points in chronological order across multiple days', () => {
    const histories = computeE1rmHistories([
      loggedSet({ id: 's1', loggedAt: '2024-01-10T00:00:00.000Z', loadKg: 100 }),
      loggedSet({ id: 's2', loggedAt: '2024-01-01T00:00:00.000Z', loadKg: 90 }),
      loggedSet({ id: 's3', loggedAt: '2024-01-05T00:00:00.000Z', loadKg: 95 }),
    ]);

    expect(histories[0].points.map(p => p.date)).toEqual(['2024-01-01', '2024-01-05', '2024-01-10']);
  });

  it('keeps different exercises in separate histories', () => {
    const histories = computeE1rmHistories([
      loggedSet({ id: 's1', exerciseId: 'ex1', exerciseName: 'Squat', loggedAt: '2024-01-01T00:00:00.000Z' }),
      loggedSet({ id: 's2', exerciseId: 'ex2', exerciseName: 'Bench Press', loggedAt: '2024-01-01T00:00:00.000Z' }),
    ]);

    expect(histories.map(h => h.exerciseId).sort()).toEqual(['ex1', 'ex2']);
  });

  it('ignores sets with no recorded load', () => {
    const histories = computeE1rmHistories([loggedSet({ loadKg: null })]);
    expect(histories).toHaveLength(0);
  });
});
