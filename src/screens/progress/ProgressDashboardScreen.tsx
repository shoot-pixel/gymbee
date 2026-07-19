import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, StatTile, Card, TrendChart } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import {
  useLoggedSets,
  computePrEvents,
  computeWeeklyVolume,
  totalVolumeThisMonth,
  prsThisMonth,
} from '../../services/api/queries/progress';
import type { ProgressStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ProgressStackParamList>;

export function ProgressDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore(state => state.userId);
  const { data: sets, isLoading } = useLoggedSets(userId);

  const events = useMemo(() => (sets ? computePrEvents(sets) : []), [sets]);
  const weeklyVolume = useMemo(() => (sets ? computeWeeklyVolume(sets) : []), [sets]);
  const volumeThisMonth = sets ? totalVolumeThisMonth(sets) : 0;
  const prCountThisMonth = prsThisMonth(events);
  const recentPrs = [...events].reverse().slice(0, 5);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <Text variant="title">Progress</Text>

        {isLoading ? (
          <ActivityIndicator color={theme.colors.accent.primary} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <View style={{ flex: 1 }}>
                <StatTile
                  label="Volume This Month"
                  value={`${Math.round(volumeThisMonth).toLocaleString()} kg`}
                />
              </View>
              <View style={{ flex: 1 }}>
                <StatTile label="PRs This Month" value={prCountThisMonth} />
              </View>
            </View>

            <Card>
              <Text variant="subtitle">Strength trend</Text>
              <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>
                Weekly training volume, last {weeklyVolume.length || 8} weeks
              </Text>
              <View style={{ marginTop: theme.spacing.md }}>
                <TrendChart
                  points={weeklyVolume.map(w => w.volume)}
                  emptyLabel="Log a few workouts to see your trend"
                />
              </View>
            </Card>

            <Card style={{ gap: theme.spacing.sm }}>
              <Text variant="subtitle">Recent PRs</Text>
              {recentPrs.length === 0 ? (
                <Text variant="body" color="secondary">
                  No PRs yet — log some heavy sets to see them here.
                </Text>
              ) : (
                recentPrs.map((event, index) => (
                  <Pressable
                    key={`${event.exerciseId}-${event.loggedAt}`}
                    onPress={() => navigation.navigate('PRDetail', { exerciseId: event.exerciseId })}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: theme.spacing.xs,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: theme.colors.border.default,
                    }}
                  >
                    <View>
                      <Text variant="body">{event.exerciseName}</Text>
                      <Text variant="caption" color="secondary">
                        {format(new Date(event.loggedAt), 'MMM d')}
                      </Text>
                    </View>
                    <Text variant="body" color="secondary">
                      {event.loadKg}kg × {event.reps}
                    </Text>
                  </Pressable>
                ))
              )}
            </Card>

            <Pressable onPress={() => navigation.navigate('BodyMetrics')}>
              <Card
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Text variant="subtitle">Body Metrics</Text>
                <Text variant="body" color="secondary">
                  →
                </Text>
              </Card>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
