import React, { useMemo, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addWeeks, endOfWeek, format, startOfWeek } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, StatTile, Button, IconButton, TrendChart, ListRow, LoadingState } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useWeeklyReviewData } from '../../services/api/queries/weeklyReview';
import { coachingEngine } from '../../services/coaching';
import { useUnitPreference } from '../../hooks/useUnitPreference';
import { formatVolume, unitLabel } from '../../utils/units';

export function WeeklyReviewScreen() {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const unitPref = useUnitPreference();
  const [weekOffset, setWeekOffset] = useState(0);

  const { weekStart, weekEnd } = useMemo(() => {
    const anchor = addWeeks(new Date(), weekOffset);
    return {
      weekStart: startOfWeek(anchor, { weekStartsOn: 1 }),
      weekEnd: endOfWeek(anchor, { weekStartsOn: 1 }),
    };
  }, [weekOffset]);

  const { isLoading, params } = useWeeklyReviewData(userId, weekStart, weekEnd);
  const review = useMemo(() => (params ? coachingEngine.generateWeeklyReview(params) : null), [params]);

  const onShare = () => {
    if (!review) return;
    Share.share({ message: review.shareableSummary });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
        }}
      >
        <IconButton name="chevronLeft" variant="ghost" onPress={() => setWeekOffset(o => o - 1)} accessibilityLabel="Previous week" />
        <Text variant="subtitle">{weekOffset === 0 ? 'This Week' : `Week of ${format(weekStart, 'MMM d')}`}</Text>
        <IconButton
          name="chevronRight"
          variant="ghost"
          onPress={() => setWeekOffset(o => o + 1)}
          disabled={weekOffset === 0}
          accessibilityLabel="Next week"
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.lg }}>
        {isLoading || !review ? (
          <LoadingState fill={false} />
        ) : (
          <>
            <Card variant="elevated">
              <Text variant="body">{review.summary}</Text>
            </Card>

            <Card variant="elevated">
              <Text variant="subtitle">Daily readiness</Text>
              <View style={{ marginTop: theme.spacing.md }}>
                <TrendChart
                  points={[...params!.checkins]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(c => c.readinessScore)}
                  emptyLabel="No check-ins logged this week"
                />
              </View>
            </Card>

            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <View style={{ flex: 1 }}>
                <StatTile label="Completed" value={review.workoutsCompleted} />
              </View>
              <View style={{ flex: 1 }}>
                <StatTile label="Missed" value={review.workoutsMissed} />
              </View>
              <View style={{ flex: 1 }}>
                <StatTile
                  label="Consistency"
                  value={review.consistencyPercent != null ? `${Math.round(review.consistencyPercent)}%` : '—'}
                />
              </View>
            </View>

            <Card variant="elevated" style={{ gap: 0 }}>
              <Text variant="subtitle" style={{ marginBottom: theme.spacing.xs }}>
                Volume by muscle group
              </Text>
              <Text variant="caption" color="secondary" style={{ marginBottom: theme.spacing.xs }}>
                {formatVolume(review.totalVolumeKg, unitPref)} {unitLabel(unitPref)} total
              </Text>
              {review.volumeByMuscleGroup.length === 0 ? (
                <Text variant="body" color="secondary">
                  No sets logged this week.
                </Text>
              ) : (
                review.volumeByMuscleGroup.map((entry, index) => (
                  <ListRow
                    key={entry.muscle}
                    title={entry.muscle}
                    trailing={
                      <Text variant="body" color="secondary">
                        {formatVolume(entry.volumeKg, unitPref)} {unitLabel(unitPref)}
                      </Text>
                    }
                    style={index > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle } : undefined}
                  />
                ))
              )}
            </Card>

            <Card variant="elevated" style={{ gap: 0 }}>
              <Text variant="subtitle" style={{ marginBottom: theme.spacing.xs }}>
                Personal records
              </Text>
              {review.newPersonalRecords.length === 0 ? (
                <Text variant="body" color="secondary">
                  No PRs this week.
                </Text>
              ) : (
                review.newPersonalRecords.map((event, index) => (
                  <ListRow
                    key={`${event.exerciseId}-${event.loggedAt}`}
                    title={event.exerciseName}
                    subtitle={format(new Date(event.loggedAt), 'MMM d')}
                    trailing={
                      <Text variant="body" color="secondary">
                        {formatVolume(event.loadKg, unitPref)}{unitLabel(unitPref)} × {event.reps}
                      </Text>
                    }
                    style={index > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle } : undefined}
                  />
                ))
              )}
            </Card>

            <Card variant="elevated" style={{ gap: theme.spacing.xs }}>
              <Text variant="subtitle">Most improved</Text>
              <Text variant="body" color="secondary">
                {review.mostImprovedExercise
                  ? `${review.mostImprovedExercise.exerciseName}, up ~${Math.round(review.mostImprovedExercise.changePercent)}%`
                  : 'Nothing stood out this week.'}
              </Text>
            </Card>

            <Card variant="elevated" style={{ gap: theme.spacing.xs }}>
              <Text variant="subtitle">Most inconsistent</Text>
              <Text variant="body" color="secondary">
                {review.mostInconsistentExercise
                  ? `${review.mostInconsistentExercise.exerciseName} — ${review.mostInconsistentExercise.detail}`
                  : 'Load was consistent across your sets this week.'}
              </Text>
            </Card>

            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <View style={{ flex: 1 }}>
                <StatTile
                  label="Avg Sleep"
                  value={review.averageSleepHours != null ? `${review.averageSleepHours.toFixed(1)}h` : '—'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <StatTile label="Avg Stress" value={review.averageStress != null ? review.averageStress.toFixed(1) : '—'} />
              </View>
              <View style={{ flex: 1 }}>
                <StatTile
                  label="Avg Soreness"
                  value={review.averageSoreness != null ? review.averageSoreness.toFixed(1) : '—'}
                />
              </View>
            </View>

            <Card variant="elevated" style={{ gap: theme.spacing.xs }}>
              <Text variant="subtitle">Pain reports</Text>
              <Text variant="body" color="secondary">
                {review.painReportCount > 0
                  ? `Reported on ${review.painReportCount} day${review.painReportCount === 1 ? '' : 's'} this week.`
                  : 'None reported this week.'}
              </Text>
            </Card>

            {review.habitObservation ? (
              <Card variant="elevated" style={{ gap: theme.spacing.xs }}>
                <Text variant="subtitle">Observation</Text>
                <Text variant="body" color="secondary">
                  {review.habitObservation}
                </Text>
              </Card>
            ) : null}

            <Card variant="elevated" style={{ gap: theme.spacing.xs }}>
              <Text variant="subtitle">Next week</Text>
              <Text variant="body" color="secondary">
                {review.recommendedChangesNextWeek}
              </Text>
            </Card>

            <Card
              variant="elevated"
              style={{ gap: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border.default }}
            >
              <Text variant="subtitle">Share</Text>
              <Text variant="body" color="secondary">
                {review.shareableSummary}
              </Text>
              <Button label="Share Summary" icon="share" onPress={onShare} />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
