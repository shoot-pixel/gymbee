import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, StatTile, Card, TrendChart, ListRow, LoadingState } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import {
  useLoggedSets,
  computePrEvents,
  computeWeeklyVolume,
  computeDailyVolume,
  computeE1rmHistories,
  totalVolumeThisMonth,
  prsThisMonth,
} from '../../services/api/queries/progress';
import { coachingEngine } from '../../services/coaching';
import { useUnitPreference } from '../../hooks/useUnitPreference';
import { formatVolume, formatWeight, unitLabel } from '../../utils/units';
import type { ProgressStackParamList } from '../../navigation/types';
import { useIntegrationConnections } from '../../services/api/queries/integrations';
import { useSyncWhoopMetrics } from '../../services/api/queries/whoop';
import { WhoopMetricsSection } from './WhoopMetricsSection';

type Nav = NativeStackNavigationProp<ProgressStackParamList>;

export function ProgressDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore(state => state.userId);
  const { data: sets, isLoading, refetch } = useLoggedSets(userId);
  const unitPref = useUnitPreference();
  const { data: integrationConnections } = useIntegrationConnections(userId);
  const isWhoopConnected = integrationConnections?.some(c => c.provider === 'whoop' && c.access_token != null) ?? false;
  const syncWhoopMetrics = useSyncWhoopMetrics();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Fire-and-forget, same as WhoopMetricsSection's own focus-triggered
    // sync — a slow or failed Whoop round-trip shouldn't hold up the rest of
    // the pull-to-refresh. Its onSuccess invalidates the whoopMetrics query,
    // which WhoopMetricsSection reads from.
    if (isWhoopConnected && userId) {
      syncWhoopMetrics.mutate(userId);
    }
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch, isWhoopConnected, userId, syncWhoopMetrics]);

  const events = useMemo(() => (sets ? computePrEvents(sets) : []), [sets]);
  const weeklyVolume = useMemo(() => (sets ? computeWeeklyVolume(sets) : []), [sets]);
  // A brand-new (or lightly-tested) account's sets rarely span two calendar
  // weeks yet — computeWeeklyVolume needs at least two week-buckets to draw
  // a line, so fall back to daily buckets rather than showing an empty
  // trend for someone who has, in fact, already logged a few workouts.
  const dailyVolume = useMemo(() => (sets ? computeDailyVolume(sets) : []), [sets]);
  const hasWeeklyTrend = weeklyVolume.length >= 2;
  const strengthTrendPoints = (hasWeeklyTrend ? weeklyVolume : dailyVolume).map(w => w.volume);
  const volumeThisMonth = sets ? totalVolumeThisMonth(sets) : 0;
  const prCountThisMonth = prsThisMonth(events);
  const recentPrs = [...events].reverse().slice(0, 5);

  const topPrediction = useMemo(() => {
    if (!sets) return null;
    const predictions = coachingEngine.predictPersonalRecords({
      exerciseHistories: computeE1rmHistories(sets),
      asOf: format(new Date(), 'yyyy-MM-dd'),
      unitPref,
    });
    return predictions[0] ?? null;
  }, [sets, unitPref]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent.primary} />}
      >
        <Text variant="title">Stats</Text>

        <WhoopMetricsSection userId={userId} />

        {isLoading ? (
          <LoadingState fill={false} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <View style={{ flex: 1 }}>
                <StatTile
                  label="Volume This Month"
                  value={`${formatVolume(volumeThisMonth, unitPref)} ${unitLabel(unitPref)}`}
                />
              </View>
              <View style={{ flex: 1 }}>
                <StatTile label="PRs This Month" value={prCountThisMonth} />
              </View>
            </View>

            <Card variant="elevated">
              <Text variant="subtitle">Strength trend</Text>
              <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>
                {hasWeeklyTrend
                  ? `Weekly training volume, last ${weeklyVolume.length} weeks`
                  : `Training volume, last ${dailyVolume.length || 14} days`}
              </Text>
              <View style={{ marginTop: theme.spacing.md }}>
                <TrendChart
                  points={strengthTrendPoints}
                  emptyLabel="Log a few workouts to see your trend"
                />
              </View>
            </Card>

            <Card variant="elevated" style={{ gap: 0 }}>
              <Text variant="subtitle" style={{ marginBottom: theme.spacing.xs }}>
                Recent PRs
              </Text>
              {recentPrs.length === 0 ? (
                <Text variant="body" color="secondary">
                  No PRs yet — log some heavy sets to see them here.
                </Text>
              ) : (
                recentPrs.map((event, index) => (
                  <ListRow
                    key={`${event.exerciseId}-${event.loggedAt}`}
                    title={event.exerciseName}
                    subtitle={format(new Date(event.loggedAt), 'MMM d')}
                    trailing={
                      <Text variant="body" color="secondary">
                        {formatWeight(event.loadKg, unitPref)}{unitLabel(unitPref)} × {event.reps}
                      </Text>
                    }
                    onPress={() => navigation.navigate('PRDetail', { exerciseId: event.exerciseId })}
                    style={
                      index > 0
                        ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle }
                        : undefined
                    }
                  />
                ))
              )}
            </Card>

            {topPrediction ? (
              <Card
                variant="elevated"
                style={{ gap: theme.spacing.xs }}
              >
                <ListRow
                  title="Future You"
                  subtitle={topPrediction.summary}
                  showChevron
                  onPress={() => navigation.navigate('PRDetail', { exerciseId: topPrediction.exerciseId })}
                />
              </Card>
            ) : null}

            <Card variant="elevated" style={{ gap: 0 }}>
              <ListRow
                title="Weekly Review"
                showChevron
                onPress={() => navigation.navigate('WeeklyReview')}
              />
              <ListRow
                title="Body Metrics"
                showChevron
                onPress={() => navigation.navigate('BodyMetrics')}
                style={{ borderTopWidth: 1, borderTopColor: theme.colors.border.subtle }}
              />
              <ListRow
                title="Progress Timeline"
                showChevron
                onPress={() => navigation.navigate('ProgressTimeline')}
                style={{ borderTopWidth: 1, borderTopColor: theme.colors.border.subtle }}
              />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
