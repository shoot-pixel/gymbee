import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, ProgressRing, EmptyState, LoadingState } from '../../components/core';
import { useIntegrationConnections } from '../../services/api/queries/integrations';
import { useWhoopMetrics, useSyncWhoopMetrics } from '../../services/api/queries/whoop';
import type { RootStackParamList } from '../../navigation/types';

type RootNav = NativeStackNavigationProp<RootStackParamList>;

/** Recovery/sleep/strain rings for the Stats tab — sits above the PR
 * content and manages its own connected/loading/error states independently
 * so it never waits on the unrelated PR data query. */
export function WhoopMetricsSection({ userId }: { userId: string | null }) {
  const theme = useTheme();
  const rootNavigation = useNavigation<RootNav>();
  const { data: connections, isLoading: connectionsLoading } = useIntegrationConnections(userId);
  const isConnected = connections?.find(c => c.provider === 'whoop')?.access_token != null;

  const { data: metrics, isLoading: metricsLoading } = useWhoopMetrics(isConnected ? userId : null);
  const syncMetrics = useSyncWhoopMetrics();

  // Fire-and-forget background sync whenever this screen regains focus —
  // useWhoopMetrics's cached row already rendered, so a slow or failed sync
  // here should never block or blank the section.
  useFocusEffect(
    useCallback(() => {
      if (isConnected && userId) {
        syncMetrics.mutate(userId);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, userId]),
  );

  if (connectionsLoading) {
    return null;
  }

  if (!isConnected) {
    return (
      <Card variant="elevated">
        <EmptyState
          icon="activity"
          title="Connect Whoop"
          description="See your recovery, sleep & strain here, and let your coach factor them into today's plan."
          actionLabel="Connect Whoop"
          onAction={() => rootNavigation.navigate('Profile', { screen: 'Integrations' })}
        />
      </Card>
    );
  }

  if (metricsLoading && !metrics) {
    return (
      <Card variant="elevated">
        <LoadingState fill={false} label="Syncing Whoop data..." />
      </Card>
    );
  }

  if (!metrics || metrics.score_state !== 'SCORED') {
    return (
      <Card variant="elevated">
        <Text variant="subtitle">Whoop</Text>
        <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.xs }}>
          No Whoop data yet today — check back after your next sleep.
        </Text>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <Text variant="subtitle">Whoop</Text>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          marginTop: theme.spacing.md,
        }}
      >
        <ProgressRing
          progress={metrics.recovery_score != null ? metrics.recovery_score / 100 : 0}
          size={88}
          strokeWidth={8}
          centerValue={metrics.recovery_score != null ? `${metrics.recovery_score}%` : '—'}
          label="Recovery"
        />
        <ProgressRing
          progress={metrics.sleep_performance_pct != null ? metrics.sleep_performance_pct / 100 : 0}
          size={88}
          strokeWidth={8}
          colors={theme.gradients.sleep}
          centerValue={metrics.sleep_performance_pct != null ? `${metrics.sleep_performance_pct}%` : '—'}
          label="Sleep"
        />
        <ProgressRing
          progress={metrics.strain != null ? metrics.strain / 21 : 0}
          size={88}
          strokeWidth={8}
          colors={theme.gradients.strain}
          centerValue={metrics.strain != null ? metrics.strain.toFixed(1) : '—'}
          label="Strain"
        />
      </View>
    </Card>
  );
}
