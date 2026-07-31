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
  TextField,
} from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useProfile } from '../../services/api/queries/profiles';
import { useActiveProgramTree, useHasEverGeneratedProgram } from '../../services/api/queries/programs';
import { useScheduledWorkouts } from '../../services/api/queries/scheduledWorkouts';
import { useWorkoutLogsInRange } from '../../services/api/queries/workoutLogs';
import { useWeeklySchedule, getWeeklyScheduleForDate } from '../../services/api/queries/weeklySchedule';
import { resolveDayPlan, getOneOffBaseline, type ResolvedDayPlan } from '../../utils/dayPlan';
import { navigateToStartCardio } from '../../navigation/startWorkoutFlow';
import { MUSCLE_GROUPS, type MuscleGroup } from '../../constants/muscleGroups';
import { formatEnumLabel } from '../../utils/exerciseMetadata';
import type { ProgramsStackParamList, RootStackParamList } from '../../navigation/types';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ASK_DAYS_OPTIONS = [3, 4, 5, 6];
const ASK_WEEKS_OPTIONS = [4, 6, 8];

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
  const { data: profile } = useProfile(userId);
  const { data: program, isLoading, refetch: refetchProgram } = useActiveProgramTree(userId);
  const { data: hasEverGeneratedProgram } = useHasEverGeneratedProgram(userId);
  const { data: weeklySchedule, isLoading: weeklyScheduleLoading, refetch: refetchWeeklySchedule } = useWeeklySchedule(userId);
  const navigation = useNavigation<NativeStackNavigationProp<ProgramsStackParamList>>();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  // Set when a rest-day row is tapped — offers a choice (assign a workout,
  // or mark the day cardio) instead of jumping straight to AssignTrainingDay.
  const [restDayChoiceFor, setRestDayChoiceFor] = useState<number | null>(null);
  // "Ask Coach to build you a custom program" — a short back-and-forth
  // (answered by tap, not typed) that asks the two questions a generated
  // program can't be right without — days/week and how many weeks — before
  // revealing the optional goal/emphasis fields and handing off to
  // GenerateProgramScreen. Previously these two were silently pulled from
  // the profile (or the model guessed the week count), which is how a
  // program could come back shaped nothing like what the athlete wanted.
  const [generateProgramSheetOpen, setGenerateProgramSheetOpen] = useState(false);
  const [askDaysPerWeek, setAskDaysPerWeek] = useState<number | null>(null);
  const [askWeeksCount, setAskWeeksCount] = useState<number | null>(null);
  const [focusNotes, setFocusNotes] = useState('');
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<MuscleGroup[]>([]);

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

  const toggleMuscleGroup = (group: MuscleGroup) => {
    setSelectedMuscleGroups(current =>
      current.includes(group) ? current.filter(g => g !== group) : [...current, group],
    );
  };

  const onSubmitGenerateProgram = () => {
    if (askDaysPerWeek == null || askWeeksCount == null) return;
    setGenerateProgramSheetOpen(false);
    navigation.navigate('GenerateProgram', {
      daysPerWeek: askDaysPerWeek,
      weeksCount: askWeeksCount,
      focusNotes: focusNotes.trim() || undefined,
      emphasisMuscleGroups: selectedMuscleGroups.length > 0 ? selectedMuscleGroups : undefined,
    });
    setAskDaysPerWeek(null);
    setAskWeeksCount(null);
    setFocusNotes('');
    setSelectedMuscleGroups([]);
  };

  // Coach's own message — left-aligned, chat-bubble styled — used for both
  // questions in the Ask Coach sheet below.
  const renderCoachBubble = (message: string) => (
    <View
      style={{
        alignSelf: 'flex-start',
        maxWidth: '90%',
        backgroundColor: theme.colors.bg.surface,
        borderWidth: 1,
        borderColor: theme.colors.border.default,
        borderRadius: theme.radii.lg,
        borderBottomLeftRadius: 4,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <Text variant="body">{message}</Text>
    </View>
  );

  // The athlete's tapped answer, replayed back as a sent bubble once chosen
  // — so the sheet reads as a short exchange rather than a form resetting
  // itself after every tap.
  const renderAnswerBubble = (label: string) => (
    <View
      style={{
        alignSelf: 'flex-end',
        backgroundColor: theme.colors.accent.primary,
        borderRadius: theme.radii.lg,
        borderBottomRightRadius: 4,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <Text variant="body" style={{ color: theme.colors.text.onAccent, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );

  const renderChipRow = (options: number[], selected: number | null, suffix: string, onSelect: (n: number) => void) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
      {options.map(n => {
        const isSelected = selected === n;
        return (
          <Pressable
            key={n}
            onPress={() => onSelect(n)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: 7,
              borderRadius: theme.radii.pill,
              backgroundColor: isSelected ? theme.colors.accent.subtle : theme.colors.bg.surface,
              borderWidth: 1,
              borderColor: isSelected ? theme.colors.accent.primary : theme.colors.border.default,
            }}
          >
            <Text
              variant="caption"
              style={{
                color: isSelected ? theme.colors.accent.primary : theme.colors.text.secondary,
                fontWeight: isSelected ? '600' : '400',
              }}
            >
              {n} {suffix}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  // The first AI program (however it's reached) is free; every one after
  // that is a Premium "rebuild your program" action — see
  // useHasEverGeneratedProgram's own comment for why a plain existence
  // check on `programs` is enough, no separate tracking column needed.
  const openGenerateProgramFlow = () => {
    if (hasEverGeneratedProgram && !profile?.is_premium) {
      rootNavigation.navigate('Paywall', { trigger: 'program_regen' });
      return;
    }
    setGenerateProgramSheetOpen(true);
  };

  const onChangeSegment = (value: Segment) => {
    setSegment(value);
    if (value === 'library') {
      navigation.navigate('Library', undefined);
    } else if (value === 'program') {
      if (program) {
        navigation.navigate('ProgramDetail', { programId: program.id });
      } else {
        openGenerateProgramFlow();
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
            // padding: 0 rather than Card's default inset — "today"'s green
            // wash is a per-row background color, and with the card's own
            // padding still in place that wash sat inside a 12px margin on
            // every side instead of reaching the card's actual edges, reading
            // as a rectangle cut off short of where the card itself ends.
            // Each row now carries its own horizontal padding instead (see
            // below), so normal rows still look inset the same as before —
            // only a highlighted row's background actually reaches edge to
            // edge.
            <Card variant="elevated" style={{ gap: 0, padding: 0 }}>
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
                            ? () =>
                              navigation.navigate('DayDetail', {
                                programDayId: resolved.day.id,
                                date: format(date, 'yyyy-MM-dd'),
                              })
                            : () => setRestDayChoiceFor(dayOfWeek);

                const trailing =
                  resolved.kind === 'completed' ? (
                    // A soft-tinted pill rather than a solid icon + bold label —
                    // "today" already washes the whole row green (see isToday
                    // below), so a completed day that's also today doesn't need
                    // a second, louder green signal stacked on top of it.
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing.xxs,
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: 3,
                        borderRadius: theme.radii.pill,
                        backgroundColor: 'rgba(0,227,142,0.10)',
                        borderWidth: 1,
                        borderColor: 'rgba(0,227,142,0.32)',
                      }}
                    >
                      <Icon name="check" size={12} color={theme.colors.accent.primary} strokeWidth={3} />
                      <Text
                        variant="caption"
                        style={{ color: theme.colors.accent.primary, fontWeight: '700', fontSize: 11, letterSpacing: 0.2 }}
                      >
                        Done
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
                      paddingHorizontal: theme.spacing.md,
                      ...(dayOfWeek > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle } : null),
                      ...(isToday
                        ? {
                            backgroundColor: theme.colors.accent.subtle,
                            // Matches the card's own corner radius exactly when
                            // "today" lands on the first/last row, so the wash's
                            // corners round together with the card instead of a
                            // square edge poking past the card's curve.
                            ...(dayOfWeek === 0
                              ? { borderTopLeftRadius: theme.radii.lg, borderTopRightRadius: theme.radii.lg }
                              : null),
                            ...(dayOfWeek === 6
                              ? { borderBottomLeftRadius: theme.radii.lg, borderBottomRightRadius: theme.radii.lg }
                              : null),
                          }
                        : null),
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
            title="Ask Coach to build you a custom program"
            icon="messageCircle"
            showChevron
            onPress={openGenerateProgramFlow}
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

      <BottomSheet
        visible={generateProgramSheetOpen}
        onClose={() => setGenerateProgramSheetOpen(false)}
        title="Build a Custom Program"
      >
        <View style={{ gap: theme.spacing.md }}>
          {renderCoachBubble('How many days a week do you want to train?')}
          {renderChipRow(ASK_DAYS_OPTIONS, askDaysPerWeek, 'days', setAskDaysPerWeek)}

          {askDaysPerWeek != null ? (
            <>
              {renderAnswerBubble(`${askDaysPerWeek} days`)}
              {renderCoachBubble('How many weeks should this block run?')}
              {renderChipRow(ASK_WEEKS_OPTIONS, askWeeksCount, 'weeks', setAskWeeksCount)}
            </>
          ) : null}

          {askDaysPerWeek != null && askWeeksCount != null ? (
            <>
              {renderAnswerBubble(`${askWeeksCount} weeks`)}
              <TextField
                label="Anything specific this program should accomplish? (optional)"
                value={focusNotes}
                onChangeText={setFocusNotes}
                placeholder="Get stronger for climbing season, build a bigger chest, train for a 5K…"
                multiline
              />
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="label" color="secondary">
                  MUSCLE GROUPS TO EMPHASIZE (OPTIONAL)
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
                  {MUSCLE_GROUPS.map(group => {
                    const selected = selectedMuscleGroups.includes(group);
                    return (
                      <Pressable
                        key={group}
                        onPress={() => toggleMuscleGroup(group)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: theme.spacing.xxs,
                          paddingHorizontal: theme.spacing.sm,
                          paddingVertical: 7,
                          borderRadius: theme.radii.pill,
                          backgroundColor: selected ? theme.colors.accent.subtle : theme.colors.bg.surface,
                          borderWidth: 1,
                          borderColor: selected ? theme.colors.accent.primary : theme.colors.border.default,
                        }}
                      >
                        {selected ? <Icon name="check" size={11} color={theme.colors.accent.primary} strokeWidth={3} /> : null}
                        <Text
                          variant="caption"
                          style={{
                            color: selected ? theme.colors.accent.primary : theme.colors.text.secondary,
                            fontWeight: selected ? '600' : '400',
                          }}
                        >
                          {formatEnumLabel(group)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Button label="Build My Program" onPress={onSubmitGenerateProgram} />
            </>
          ) : null}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
