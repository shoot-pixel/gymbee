import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, StatTile, TrendChart } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useLoggedSets, computePrEvents } from '../../services/api/queries/progress';
import type { ProgressStackParamList } from '../../navigation/types';

type Route = RouteProp<ProgressStackParamList, 'PRDetail'>;

export function PRDetailScreen() {
  const theme = useTheme();
  const { params } = useRoute<Route>();
  const userId = useAuthStore(state => state.userId);
  const { data: sets, isLoading } = useLoggedSets(userId);

  const exerciseEvents = useMemo(() => {
    if (!sets) return [];
    return computePrEvents(sets).filter(e => e.exerciseId === params.exerciseId);
  }, [sets, params.exerciseId]);

  const exerciseName = exerciseEvents[0]?.exerciseName ?? 'Exercise';
  const current = exerciseEvents[exerciseEvents.length - 1];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <Text variant="title">{exerciseName}</Text>

        {isLoading ? (
          <ActivityIndicator color={theme.colors.accent.primary} />
        ) : !current ? (
          <Card>
            <Text variant="body" color="secondary">
              No recorded sets with weight for this exercise yet.
            </Text>
          </Card>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <View style={{ flex: 1 }}>
                <StatTile label="Best Est. 1RM" value={`${Math.round(current.e1rm)} kg`} />
              </View>
              <View style={{ flex: 1 }}>
                <StatTile label="Best Set" value={`${current.loadKg}×${current.reps}`} />
              </View>
            </View>

            <Card>
              <Text variant="subtitle">Est. 1RM progression</Text>
              <View style={{ marginTop: theme.spacing.md }}>
                <TrendChart points={exerciseEvents.map(e => e.e1rm)} />
              </View>
            </Card>

            <Card style={{ gap: theme.spacing.sm }}>
              <Text variant="subtitle">PR history</Text>
              {[...exerciseEvents].reverse().map((event, index) => (
                <View
                  key={`${event.loggedAt}-${index}`}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: theme.spacing.xs,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: theme.colors.border.default,
                  }}
                >
                  <Text variant="body" color="secondary">
                    {format(new Date(event.loggedAt), 'MMM d, yyyy')}
                  </Text>
                  <Text variant="body">
                    {event.loadKg}kg × {event.reps} ({Math.round(event.e1rm)} kg e1RM)
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
