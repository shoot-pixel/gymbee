import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, addDays, startOfWeek } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Text,
  Card,
  Header,
  Icon,
  IconButton,
  ListRow,
  BottomSheet,
  EmptyState,
  LoadingState,
  Button,
  SegmentedControl,
} from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useActiveProgramTree } from '../../services/api/queries/programs';
import { useScheduledWorkouts } from '../../services/api/queries/scheduledWorkouts';
import { useWorkoutLogsInRange } from '../../services/api/queries/workoutLogs';
import { useWeeklySchedule, getWeeklyScheduleForDate } from '../../services/api/queries/weeklySchedule';
import { resolveDayPlan, getOneOffBaseline, type ResolvedDayPlan } from '../../utils/dayPlan';
import { navigateToStartCardio } from '../../navigation/startWorkoutFlow';
import type { ProgramsStackParamList, RootStackParamList } from '../../navigation/types';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function planLineFor(resolved: ResolvedDayPlan): string {
  switch (resolved.kind) {
    case 'completed':
      return resolved.title ?? 'Workout';
    case 'scheduled':
      return resolved.scheduledWorkout.name;
    case 'weeklyRecurring':
      return resolved.entry.workout_templates
        ? `${resolved.entry.workout_templates.name} · ${resolved.entry.workout_templates.workout_template_exercises.length} exercises`
        : 'Workout';
    case 'weeklyCardio':
      return 'Cardio Day';
    case 'programTraining':
      return `${resolved.day.title ?? 'Training Day'} · ${resolved.day.program_exercises.length} exercises`;
    case 'programCardio':
      return 'Cardio Day';
    case 'programRest':
    case 'none':
      return 'Rest';
  }
}

type Segment = 'thisWeek' | 'library' | 'program';

export function CalendarScreen() {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const { data: program, isLoading, refetch: refetchProgram } = useActiveProgramTree(userId);
  const { data: weeklySchedule, isLoading: weeklyScheduleLoading, refetch: refetchWeeklySchedule } = useWeeklySchedule(userId);
  const navigation = useNavigation<NativeStackNavigationProp<ProgramsStackParamList>>();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  // Set when a rest-day row is tapped — offers a choice (assign a workout,
  // or mark the day cardio) instead of jumping straight to AssignTrainingDay.
  const [restDayChoiceFor, setRestDayChoiceFor] = useState<number | null>(null);

  const [segment, setSegment] = useState<Segment>('thisWeek');
  useFocusEffect(useCallback(() => setSegment('thisWeek'), []));

  const today = new Date();
  const { data: scheduledWorkouts, isLoading: scheduledLoading, refetch: refetchScheduled } = useScheduledWorkouts(userId, {
    from: format(today, 'yyyy-MM-dd'),
    to: format(addDays(today, 30), 'yyyy-MM-dd'),
  });

  // This week's Sun-Sat range — recomputed from `today` on every render (same
  // convention TodayScreen uses), so once Sunday arrives the next visit to
  // this screen naturally sees a fresh week with nothing completed yet.
  const thisWeekStart = startOfWeek(today, { weekStartsOn: 0 });
  const thisWeekDates = Array.from({ length: 7 }, (_, dayOfWeek) => addDays(thisWeekStart, dayOfWeek));
  const { data: thisWeekLogs, refetch: refetchThisWeekLogs } = useWorkoutLogsInRange(userId, {
    from: format(thisWeekStart, 'yyyy-MM-dd'),
    to: format(thisWeekDates[6], 'yyyy-MM-dd'),
  });

  const upcomingScheduled = useMemo(
    () => (scheduledWorkouts ?? []).filter(sw => sw.scheduled_date > format(thisWeekDates[6], 'yyyy-MM-dd')),
    [scheduledWorkouts, thisWeekDates],
  );
  // A day can now have a plan without a weekly_schedule entry at all (an
  // ad-hoc scheduled workout, or an active program's day) — so the "nothing
  // set up yet" nudge should only show when there's truly nothing to show
  // across the whole week, not just when the recurring schedule is empty.
  const hasScheduledThisWeek = (scheduledWorkouts ?? []).some(sw =>
    thisWeekDates.some(date => format(date, 'yyyy-MM-dd') === sw.scheduled_date),
  );
  const hasNothingSetUp = (!weeklySchedule || weeklySchedule.length === 0) && !program && !hasScheduledThisWeek;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchProgram(), refetchScheduled(), refetchWeeklySchedule(), refetchThisWeekLogs()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchProgram, refetchScheduled, refetchWeeklySchedule, refetchThisWeekLogs]);

  const onChangeSegment = (value: Segment) => {
    setSegment(value);
    if (value === 'library') {
      navigation.navigate('Library', undefined);
    } else if (value === 'program') {
      if (program) {
        navigation.navigate('ProgramDetail', { programId: program.id });
      } else {
        navigation.navigate('GenerateProgram');
      }
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <Header
        title="Training"
        showBack={false}
        right={<IconButton name="plus" onPress={() => setAddSheetOpen(true)} />}
      />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
        <SegmentedControl
          options={[
            { value: 'thisWeek', label: 'This Week' },
            { value: 'library', label: 'Library' },
            { value: 'program', label: 'Program' },
          ]}
          value={segment}
          onChange={onChangeSegment}
        />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent.primary} />}
      >
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="label" color="secondary">
              TRAINING DAYS
            </Text>
            {weeklySchedule && weeklySchedule.length > 0 ? (
              <IconButton
                name="plus"
                variant="ghost"
                accessibilityLabel="Add a training day"
                onPress={() => navigation.navigate('AssignTrainingDay')}
              />
            ) : null}
          </View>

          {weeklyScheduleLoading ? (
            <LoadingState fill={false} />
          ) : hasNothingSetUp ? (
            <View style={{ gap: theme.spacing.md }}>
              <EmptyState
                icon="calendarPlus"
                title="No training days set up yet"
                description="Assign a workout to a day of the week — it'll repeat every week."
              />
              <Button label="Add a Training Day" onPress={() => navigation.navigate('AssignTrainingDay')} />
            </View>
          ) : (
            <Card variant="elevated" style={{ gap: 0 }}>
              {WEEKDAY_NAMES.map((weekday, dayOfWeek) => {
                const date = thisWeekDates[dayOfWeek];
                const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                const resolved = resolveDayPlan({
                  date,
                  program,
                  weeklySchedule,
                  scheduledWorkouts,
                  workoutLogs: thisWeekLogs,
                });
                const oneOffBaseline = getOneOffBaseline(resolved, getWeeklyScheduleForDate(weeklySchedule, date));

                const onPress =
                  resolved.kind === 'completed'
                    ? () =>
                        navigation.navigate('WorkoutLogDetail', {
                          workoutLogIds: resolved.workoutLogIds,
                          title: resolved.title,
                          dateLabel: format(date, 'EEEE, MMM d'),
                        })
                    : resolved.kind === 'scheduled'
                      ? () =>
                          navigation.navigate('ScheduledWorkoutDetail', {
                            scheduledWorkoutId: resolved.scheduledWorkout.id,
                          })
                      : resolved.kind === 'weeklyRecurring'
                        ? () =>
                            navigation.navigate('TrainingDayDetail', {
                              weeklyScheduleId: resolved.entry.id,
                              workoutTemplateId: resolved.entry.workout_template_id as string,
                              dayOfWeek,
                            })
                        : resolved.kind === 'weeklyCardio' || resolved.kind === 'programCardio'
                          ? () =>
                              navigateToStartCardio(rootNavigation, {
                                ...(resolved.kind === 'programCardio' ? { programDayId: resolved.day.id } : null),
                                date: format(date, 'yyyy-MM-dd'),
                              })
                          : resolved.kind === 'programTraining'
                            ? () => navigation.navigate('DayDetail', { programDayId: resolved.day.id })
                            : () => setRestDayChoiceFor(dayOfWeek);

                const trailing =
                  resolved.kind === 'completed' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs }}>
                      <Icon name="circleCheck" size="sm" color={theme.colors.accent.primary} />
                      <Text variant="caption" style={{ color: theme.colors.accent.primary, fontWeight: '700' }}>
                        Completed
                      </Text>
                    </View>
                  ) : resolved.kind === 'weeklyCardio' || resolved.kind === 'programCardio' ? (
                    <Icon name="flame" size="sm" color={theme.colors.accent.orange} />
                  ) : resolved.kind === 'programRest' || resolved.kind === 'none' ? (
                    <Icon name="moon" size="sm" color={theme.colors.text.tertiary} />
                  ) : undefined;

                return (
                  <ListRow
                    key={dayOfWeek}
                    title={weekday}
                    subtitle={
                      <View style={{ gap: 2 }}>
                        <Text variant="caption" color="tertiary">
                          {format(date, 'MMM d')}
                        </Text>
                        <Text variant="caption" color="secondary">
                          {planLineFor(resolved)}
                        </Text>
                        {oneOffBaseline ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginTop: 2 }}>
                            <View
                              style={{
                                paddingHorizontal: theme.spacing.xs,
                                paddingVertical: 2,
                                borderRadius: theme.radii.pill,
                                backgroundColor: 'rgba(255,180,84,0.15)',
                              }}
                            >
                              <Text style={{ color: theme.colors.semantic.warning, fontSize: 9, fontWeight: '700', letterSpacing: 0.4 }}>
                                ONE-OFF
                              </Text>
                            </View>
                            <Text variant="caption" color="tertiary">
                              usually {oneOffBaseline}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    }
                    trailing={trailing}
                    showChevron={
                      resolved.kind === 'scheduled' ||
                      resolved.kind === 'weeklyRecurring' ||
                      resolved.kind === 'programTraining' ||
                      resolved.kind === 'weeklyCardio' ||
                      resolved.kind === 'programCardio'
                    }
                    onPress={onPress}
                    style={{
                      ...(dayOfWeek > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle } : null),
                      ...(isToday ? { backgroundColor: theme.colors.accent.subtle } : null),
                    }}
                  />
                );
              })}
            </Card>
          )}
        </View>

        {scheduledLoading ? null : upcomingScheduled.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" color="secondary">
              UPCOMING
            </Text>
            <Card variant="elevated" style={{ gap: 0 }}>
              {upcomingScheduled.map((sw, index) => (
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
          <ListRow
            title="Generate a periodized program with AI"
            icon="calendarPlus"
            showChevron
            onPress={() => navigation.navigate('GenerateProgram')}
          />
        ) : (
          <Pressable onPress={() => navigation.navigate('ProgramDetail', { programId: program.id })}>
            <Card variant="elevated">
              <Text variant="subtitle">{program.title}</Text>
              <Text variant="body" color="secondary">
                {program.weeks_count} weeks · {program.days_per_week}x/week · view all weeks
              </Text>
            </Card>
          </Pressable>
        )}
      </ScrollView>

      <BottomSheet
        visible={restDayChoiceFor != null}
        onClose={() => setRestDayChoiceFor(null)}
        title="This day is set to rest"
      >
        <View style={{ gap: theme.spacing.xs }}>
          <ListRow
            title="Assign a Workout"
            icon="dumbbell"
            onPress={() => {
              const dayOfWeek = restDayChoiceFor;
              setRestDayChoiceFor(null);
              if (dayOfWeek != null) navigation.navigate('AssignTrainingDay', { initialDayOfWeek: dayOfWeek });
            }}
          />
          <ListRow
            title="Log Cardio"
            icon="flame"
            onPress={() => {
              const dayOfWeek = restDayChoiceFor;
              setRestDayChoiceFor(null);
              if (dayOfWeek != null) navigation.navigate('AssignCardioDay', { initialDayOfWeek: dayOfWeek });
            }}
          />
        </View>
      </BottomSheet>

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
