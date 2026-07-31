import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, StatTile, Card, TrendChart, SegmentedControl, ListRow, LoadingState, LockedFeatureCard } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useProfile } from '../../services/api/queries/profiles';
import {
  useLoggedSets,
  computePrEvents,
  computeStrengthTrend,
  computeE1rmHistories,
  totalVolumeThisMonth,
  prsThisMonth,
  type StrengthTrendRange,
} from '../../services/api/queries/progress';
import { coachingEngine } from '../../services/coaching';
import { useUnitPreference } from '../../hooks/useUnitPreference';
import { formatVolume, formatWeight, unitLabel } from '../../utils/units';
import type { ProgressStackParamList, RootStackParamList } from '../../navigation/types';
import { useIntegrationConnections } from '../../services/api/queries/integrations';
import { useSyncWhoopMetrics } from '../../services/api/queries/whoop';
import { WhoopMetricsSection } from './WhoopMetricsSection';

type Nav = NativeStackNavigationProp<ProgressStackParamList>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

const STRENGTH_TREND_RANGE_OPTIONS: { value: StrengthTrendRange; label: string }[] = [
  { value: '1w', label: '1W' },
  { value: '2w', label: '2W' },
  { value: '1m', label: '1M' },
  { value: 'ytd', label: 'YTD' },
];

const STRENGTH_TREND_CAPTIONS: Record<StrengthTrendRange, string> = {
  '1w': 'Training volume, last 7 days',
  '2w': 'Training volume, last 14 days',
  '1m': 'Training volume, last 30 days',
  ytd: 'Training volume, year to date',
};

export function ProgressDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const rootNavigation = useNavigation<RootNav>();
  const userId = useAuthStore(state => state.userId);
  const { data: profile } = useProfile(userId);
  const isPremium = profile?.is_premium ?? false;
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
  const [strengthTrendRange, setStrengthTrendRange] = useState<StrengthTrendRange>('1w');
  const strengthTrend = useMemo(
    () => (sets ? computeStrengthTrend(sets, strengthTrendRange) : []),
    [sets, strengthTrendRange],
  );
  const strengthTrendPoints = strengthTrend.map(w => w.volume);
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

            {isPremium ? (
              <Card variant="elevated">
                <Text variant="subtitle">Strength trend</Text>
                <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>
                  {STRENGTH_TREND_CAPTIONS[strengthTrendRange]}
                </Text>
                <View style={{ marginTop: theme.spacing.sm }}>
                  <SegmentedControl
                    options={STRENGTH_TREND_RANGE_OPTIONS}
                    value={strengthTrendRange}
                    onChange={setStrengthTrendRange}
                  />
                </View>
                <View style={{ marginTop: theme.spacing.md }}>
                  <TrendChart
                    points={strengthTrendPoints}
                    emptyLabel="Log a few workouts to see your trend"
                  />
                </View>
              </Card>
            ) : (
              <LockedFeatureCard
                title="Strength trend"
                description="See your training volume trend over time."
                onUpgrade={() => rootNavigation.navigate('Paywall', { trigger: 'analytics' })}
              />
            )}

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
                icon={isPremium ? undefined : 'lock'}
                showChevron
                onPress={() =>
                  isPremium
                    ? navigation.navigate('WeeklyReview')
                    : rootNavigation.navigate('Paywall', { trigger: 'analytics' })
                }
              />
              <ListRow
                title="Body Metrics"
                showChevron
                onPress={() => navigation.navigate('BodyMetrics')}
                style={{ borderTopWidth: 1, borderTopColor: theme.colors.border.subtle }}
              />
              <ListRow
                title="Progress Timeline"
                icon={isPremium ? undefined : 'lock'}
                showChevron
                onPress={() =>
                  isPremium
                    ? navigation.navigate('ProgressTimeline')
                    : rootNavigation.navigate('Paywall', { trigger: 'analytics' })
                }
                style={{ borderTopWidth: 1, borderTopColor: theme.colors.border.subtle }}
              />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
