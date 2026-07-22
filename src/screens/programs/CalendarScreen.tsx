import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, addDays } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Header, IconButton, ListRow, BottomSheet, EmptyState, LoadingState } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useActiveProgramTree, getTodayProgramDay } from '../../services/api/queries/programs';
import { useScheduledWorkouts } from '../../services/api/queries/scheduledWorkouts';
import type { ProgramsStackParamList } from '../../navigation/types';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarScreen() {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const { data: program, isLoading, refetch: refetchProgram } = useActiveProgramTree(userId);
  const navigation = useNavigation<NativeStackNavigationProp<ProgramsStackParamList>>();
  const todaysDay = getTodayProgramDay(program);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const today = new Date();
  const { data: scheduledWorkouts, isLoading: scheduledLoading, refetch: refetchScheduled } = useScheduledWorkouts(userId, {
    from: format(today, 'yyyy-MM-dd'),
    to: format(addDays(today, 30), 'yyyy-MM-dd'),
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchProgram(), refetchScheduled()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchProgram, refetchScheduled]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <Header
        title="Programs"
        showBack={false}
        right={<IconButton name="plus" onPress={() => setAddSheetOpen(true)} />}
      />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent.primary} />}
      >
        {scheduledLoading ? null : scheduledWorkouts && scheduledWorkouts.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" color="secondary">
              SCHEDULED
            </Text>
            <Card variant="elevated" style={{ gap: 0 }}>
              {scheduledWorkouts.map((sw, index) => (
                <ListRow
                  key={sw.id}
                  title={sw.name}
                  subtitle={format(new Date(sw.scheduled_date), 'EEEE, MMM d')}
                  showChevron
                  onPress={() => navigation.navigate('ScheduledWorkoutDetail', { scheduledWorkoutId: sw.id })}
                  style={
                    index > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle } : undefined
                  }
                />
              ))}
            </Card>
          </View>
        ) : null}

        {isLoading ? (
          <LoadingState fill={false} />
        ) : !program ? (
          <EmptyState
            icon="calendar"
            title="No program yet"
            description="Once generated, your weeks and days will show up here."
          />
        ) : (
          <>
            <Pressable onPress={() => navigation.navigate('ProgramDetail', { programId: program.id })}>
              <Card variant="elevated">
                <Text variant="subtitle">{program.title}</Text>
                <Text variant="body" color="secondary">
                  {program.weeks_count} weeks · {program.days_per_week}x/week
                </Text>
              </Card>
            </Pressable>

            {program.program_weeks.map(week => (
              <View key={week.id} style={{ gap: theme.spacing.sm }}>
                <Text variant="label" color="secondary">
                  WEEK {week.week_number}
                  {week.focus ? ` · ${week.focus.toUpperCase()}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {week.program_days.map(day => {
                    const isToday = todaysDay?.day.id === day.id;
                    return (
                      <Pressable
                        key={day.id}
                        disabled={day.is_rest_day}
                        onPress={() => navigation.navigate('DayDetail', { programDayId: day.id })}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: theme.radii.pill,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: day.is_rest_day
                            ? theme.colors.bg.surface
                            : theme.colors.bg.surfaceElevated,
                          borderWidth: isToday ? 2 : 1,
                          borderColor: isToday ? theme.colors.accent.primary : theme.colors.border.subtle,
                        }}
                      >
                        <Text
                          variant="caption"
                          color={day.is_rest_day ? 'tertiary' : 'primary'}
                        >
                          {DAY_LABELS[day.day_of_week ?? 0]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <BottomSheet visible={addSheetOpen} onClose={() => setAddSheetOpen(false)} title="Add a Workout">
        <View style={{ gap: theme.spacing.xs }}>
          <ListRow
            title="Create New Workout"
            icon="plus"
            onPress={() => {
              setAddSheetOpen(false);
              navigation.navigate('TemplateEditor', { scheduleAfterSave: true });
            }}
          />
          <ListRow
            title="Add From Library"
            icon="dumbbell"
            onPress={() => {
              setAddSheetOpen(false);
              navigation.navigate('Library', { pickMode: true });
            }}
          />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
