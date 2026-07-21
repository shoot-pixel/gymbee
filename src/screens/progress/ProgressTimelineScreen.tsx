import React, { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Header, ListRow, LoadingState, EmptyState, type IconName } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useLoggedSets, computePrEvents } from '../../services/api/queries/progress';
import { useBodyMetrics } from '../../services/api/queries/bodyMetrics';
import { useAllWorkoutLogs } from '../../services/api/queries/workoutLogs';
import { buildProgressTimeline, type TimelineEntry } from '../../utils/progressTimeline';
import { useUnitPreference } from '../../hooks/useUnitPreference';
import { formatWeight, unitLabel } from '../../utils/units';
import type { ProgressStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ProgressStackParamList>;

type ListItem =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'entry'; key: string; entry: TimelineEntry };

function buildListItems(entries: TimelineEntry[]): ListItem[] {
  const items: ListItem[] = [];
  let lastMonth: string | null = null;
  entries.forEach((entry, index) => {
    const month = format(new Date(entry.date), 'MMMM yyyy');
    if (month !== lastMonth) {
      items.push({ kind: 'header', key: `header-${month}`, label: month });
      lastMonth = month;
    }
    items.push({ kind: 'entry', key: `${entry.type}-${entry.date}-${index}`, entry });
  });
  return items;
}

function describeEntry(
  entry: TimelineEntry,
  unitPref: ReturnType<typeof useUnitPreference>,
): { icon: IconName; title: string; trailing?: string } {
  switch (entry.type) {
    case 'pr':
      return {
        icon: 'trophy',
        title: entry.exerciseName,
        trailing: `${formatWeight(entry.loadKg, unitPref)}${unitLabel(unitPref)} × ${entry.reps}`,
      };
    case 'body_metric':
      return {
        icon: 'scale',
        title: 'Body weight logged',
        trailing: `${formatWeight(entry.weightKg, unitPref)}${unitLabel(unitPref)}`,
      };
    case 'workout_completed':
      return {
        icon: 'dumbbell',
        title: entry.title,
        trailing: entry.rating != null ? `${entry.rating}/5` : undefined,
      };
    case 'milestone':
      return { icon: 'medal', title: `Milestone: ${entry.count} workouts completed` };
  }
}

export function ProgressTimelineScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore(state => state.userId);
  const unitPref = useUnitPreference();

  const { data: loggedSets, isLoading: setsLoading } = useLoggedSets(userId);
  const { data: bodyMetrics, isLoading: metricsLoading } = useBodyMetrics(userId);
  const { data: workoutLogs, isLoading: logsLoading } = useAllWorkoutLogs(userId);
  const isLoading = setsLoading || metricsLoading || logsLoading;

  const entries = useMemo(() => {
    if (!loggedSets || !bodyMetrics || !workoutLogs) return [];
    return buildProgressTimeline(computePrEvents(loggedSets), bodyMetrics, workoutLogs);
  }, [loggedSets, bodyMetrics, workoutLogs]);

  const listItems = useMemo(() => buildListItems(entries), [entries]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <Header title="Progress Timeline" />
      {isLoading ? (
        <LoadingState />
      ) : listItems.length === 0 ? (
        <EmptyState
          icon="activity"
          title="Nothing to show yet"
          description="PRs, body-weight logs, and completed workouts will show up here over time."
        />
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={item => item.key}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg }}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <Text
                  variant="label"
                  color="secondary"
                  style={{ paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs }}
                >
                  {item.label.toUpperCase()}
                </Text>
              );
            }
            const entry = item.entry;
            const { icon, title, trailing } = describeEntry(entry, unitPref);
            return (
              <View style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border.subtle }}>
                <ListRow
                  icon={icon}
                  title={title}
                  subtitle={format(new Date(entry.date), 'MMM d')}
                  trailing={trailing ? <Text variant="body" color="secondary">{trailing}</Text> : undefined}
                  showChevron={entry.type === 'pr'}
                  onPress={
                    entry.type === 'pr' ? () => navigation.navigate('PRDetail', { exerciseId: entry.exerciseId }) : undefined
                  }
                />
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
