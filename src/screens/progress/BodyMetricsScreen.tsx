import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, StatTile, Button, TextField, TrendChart, Header, LoadingState } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useBodyMetrics, useLogBodyMetric } from '../../services/api/queries/bodyMetrics';
import { useUnitPreference } from '../../hooks/useUnitPreference';
import { formatWeight, parseWeightInput, unitLabel, kgToLb, roundForDisplay } from '../../utils/units';

export function BodyMetricsScreen() {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const { data: metrics, isLoading } = useBodyMetrics(userId);
  const logMetric = useLogBodyMetric(userId);
  const unitPref = useUnitPreference();
  const [weight, setWeight] = useState('');
  const [error, setError] = useState<string | null>(null);

  const latest = metrics && metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const first = metrics && metrics.length > 0 ? metrics[0] : null;
  const hasTrend = latest != null && first != null && latest.id !== first.id;
  const trendKg = hasTrend ? latest.weight_kg - first.weight_kg : 0;
  const trendDisplay = unitPref === 'kg' ? trendKg : kgToLb(trendKg);

  const onLog = async () => {
    const value = parseWeightInput(weight, unitPref);
    if (!value || value <= 0) {
      setError('Enter a valid weight.');
      return;
    }
    setError(null);
    try {
      await logMetric.mutateAsync({ weightKg: value });
      setWeight('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that entry.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <Header title="Body Metrics" />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {isLoading ? (
          <LoadingState fill={false} />
        ) : (
          <>
            <StatTile
              label="Current Weight"
              value={latest ? `${formatWeight(latest.weight_kg, unitPref)} ${unitLabel(unitPref)}` : '—'}
              trend={
                hasTrend
                  ? {
                      direction: trendKg > 0 ? 'up' : trendKg < 0 ? 'down' : 'flat',
                      label: `${roundForDisplay(Math.abs(trendDisplay), unitPref)} ${unitLabel(unitPref)} since first log`,
                    }
                  : undefined
              }
            />

            <Card variant="elevated">
              <Text variant="subtitle">Weight trend</Text>
              <View style={{ marginTop: theme.spacing.md }}>
                <TrendChart
                  points={(metrics ?? []).map(m => m.weight_kg)}
                  emptyLabel="Log a couple of entries to see your trend"
                />
              </View>
            </Card>

            <Card variant="elevated" style={{ gap: theme.spacing.sm }}>
              <Text variant="subtitle">Log today's weight</Text>
              <TextField
                label={`Weight (${unitLabel(unitPref)})`}
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
                placeholder="72.5"
                error={error ?? undefined}
              />
              <Button label="Log Weight" onPress={onLog} loading={logMetric.isPending} />
            </Card>

            {metrics && metrics.length > 0 ? (
              <Card variant="elevated" style={{ gap: theme.spacing.sm }}>
                <Text variant="subtitle">History</Text>
                {[...metrics].reverse().map((m, index) => (
                  <View
                    key={m.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingVertical: theme.spacing.xs,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: theme.colors.border.subtle,
                    }}
                  >
                    <Text variant="body" color="secondary">
                      {format(new Date(m.logged_at), 'MMM d, yyyy')}
                    </Text>
                    <Text variant="body">
                      {formatWeight(m.weight_kg, unitPref)} {unitLabel(unitPref)}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
