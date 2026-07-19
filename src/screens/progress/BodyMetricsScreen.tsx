import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, StatTile, Button, TextField, TrendChart } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useBodyMetrics, useLogBodyMetric } from '../../services/api/queries/bodyMetrics';

export function BodyMetricsScreen() {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const { data: metrics, isLoading } = useBodyMetrics(userId);
  const logMetric = useLogBodyMetric(userId);
  const [weight, setWeight] = useState('');
  const [error, setError] = useState<string | null>(null);

  const latest = metrics && metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const first = metrics && metrics.length > 0 ? metrics[0] : null;
  const hasTrend = latest != null && first != null && latest.id !== first.id;
  const trend = hasTrend ? latest.weight_kg - first.weight_kg : 0;

  const onLog = async () => {
    const value = parseFloat(weight);
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
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <Text variant="title">Body Metrics</Text>

        {isLoading ? (
          <ActivityIndicator color={theme.colors.accent.primary} />
        ) : (
          <>
            <StatTile
              label="Current Weight"
              value={latest ? `${latest.weight_kg} kg` : '—'}
              trend={
                hasTrend
                  ? {
                      direction: trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat',
                      label: `${Math.abs(trend).toFixed(1)} kg since first log`,
                    }
                  : undefined
              }
            />

            <Card>
              <Text variant="subtitle">Weight trend</Text>
              <View style={{ marginTop: theme.spacing.md }}>
                <TrendChart
                  points={(metrics ?? []).map(m => m.weight_kg)}
                  emptyLabel="Log a couple of entries to see your trend"
                />
              </View>
            </Card>

            <Card style={{ gap: theme.spacing.sm }}>
              <Text variant="subtitle">Log today's weight</Text>
              <TextField
                label="Weight (kg)"
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
                placeholder="72.5"
                error={error ?? undefined}
              />
              <Button label="Log Weight" onPress={onLog} loading={logMetric.isPending} />
            </Card>

            {metrics && metrics.length > 0 ? (
              <Card style={{ gap: theme.spacing.sm }}>
                <Text variant="subtitle">History</Text>
                {[...metrics].reverse().map((m, index) => (
                  <View
                    key={m.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingVertical: theme.spacing.xs,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: theme.colors.border.default,
                    }}
                  >
                    <Text variant="body" color="secondary">
                      {format(new Date(m.logged_at), 'MMM d, yyyy')}
                    </Text>
                    <Text variant="body">{m.weight_kg} kg</Text>
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
