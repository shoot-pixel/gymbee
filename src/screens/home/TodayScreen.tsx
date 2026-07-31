import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { addDays, endOfWeek, format, isFuture, isSameDay, isSameWeek, isToday as isDateToday, startOfWeek } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button, ProgressRing, ListRow, LoadingState, Icon, Avatar, IconButton, type IconName } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import {
  useActiveProgramTree,
  getProgramDayForDate,
  type ProgramExerciseWithExercise,
} from '../../services/api/queries/programs';
import { useProfile } from '../../services/api/queries/profiles';
import { useWorkoutLogsInRange } from '../../services/api/queries/workoutLogs';
import {
  useScheduledWorkouts,
  useStartTemplateToday,
  TODAY_RANGE_PAST_DAYS,
  TODAY_RANGE_FUTURE_DAYS,
} from '../../services/api/queries/scheduledWorkouts';
import {
  useWeeklySchedule,
  getWeeklyScheduleForDate,
  type WeeklyScheduleEntry,
} from '../../services/api/queries/weeklySchedule';

/** This screen doesn't know about Cardio Day yet (see dayPlan.ts for the
 * screen that does) — a cardio weekly_schedule entry has no
 * workout_template_id/workout_templates to show here, so it's treated the
 * same as no entry at all rather than crashing on the now-nullable join.
 * Narrows workout_template_id/workout_templates to non-null, which the DB's
 * weekly_schedule_template_required_for_training check constraint
 * guarantees for any day_type='training' row. */
type TrainingWeeklyEntry = WeeklyScheduleEntry & {
  workout_template_id: string;
  workout_templates: NonNullable<WeeklyScheduleEntry['workout_templates']>;
};
function asTrainingEntry(entry: WeeklyScheduleEntry | null): TrainingWeeklyEntry | null {
  if (!entry || entry.day_type === 'cardio' || !entry.workout_templates) return null;
  return entry as TrainingWeeklyEntry;
}
import { useWorkoutTemplate } from '../../services/api/queries/workoutTemplates';
import { useLoggedSets, computePrEvents } from '../../services/api/queries/progress';
import {
  useTrainingPatterns,
  useSyncTrainingPatterns,
  useDismissTrainingPattern,
} from '../../services/api/queries/coachingMemory';
import { useReadinessContext } from '../../services/api/queries/coaching';
import { useIntegrationConnections } from '../../services/api/queries/integrations';
import { useSyncWhoopMetrics } from '../../services/api/queries/whoop';
import { coachingEngine } from '../../services/coaching';
import type { TodayPlanContext, TrainingPatternType } from '../../services/coaching';
import { computeStreak } from '../../utils/streak';
import { estimateWorkoutMinutes } from '../../utils/workoutTiming';
import { navigateToStartWorkout } from '../../navigation/startWorkoutFlow';
import { buildWidgetPayload } from '../../services/widget/buildWidgetPayload';
import { syncWidget } from '../../services/widget/nativeWidgetBridge';
import { WeekTimeline } from './WeekTimeline';
import { AiSummaryCard } from './AiSummaryCard';
import { CompletedWorkoutCard } from './CompletedWorkoutCard';
import { CompletedCardioCard } from './CompletedCardioCard';
import { FriendsActivitySection } from './FriendsActivitySection';
import { useFriendsPosts, useSignedPhotoUrls, postPhotoPaths, type FriendPost } from '../../services/api/queries/posts';
import { trackEvent } from '../../services/analytics/analytics';
import type { RootStackParamList, TodayStackParamList } from '../../navigation/types';

const FRIENDS_ACTIVITY_PREVIEW_LIMIT = 3;

const PATTERN_ICON: Record<TrainingPatternType, IconName> = {
  inconsistent_weekday: 'calendar',
  declining_consistency: 'trendingDown',
  recurring_pain: 'circleAlert',
  rpe_creep: 'trendingUp',
  low_sleep_pattern: 'moon',
};

const MAX_INSIGHTS_SHOWN = 2;

const RANGE_PAST_DAYS = TODAY_RANGE_PAST_DAYS;
const RANGE_FUTURE_DAYS = TODAY_RANGE_FUTURE_DAYS;

function dateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function greeting(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

function estimateMinutes(exercises: ProgramExerciseWithExercise[]): number | null {
  return estimateWorkoutMinutes(
    exercises.map(pe => ({ targetSets: pe.target_sets, restSeconds: pe.rest_seconds })),
  );
}

export function TodayScreen() {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const { data: program, isLoading, refetch: refetchProgram } = useActiveProgramTree(userId);
  const { data: profile } = useProfile(userId);
  // Profile lives on the root stack, not the Today tab stack — navigate()
  // bubbles up to find it since 'Profile' isn't a route in this navigator.
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const todayNavigation = useNavigation<NativeStackNavigationProp<TodayStackParamList>>();

  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const today = useMemo(() => new Date(), []);
  const rangeFrom = useMemo(() => format(addDays(today, -RANGE_PAST_DAYS), 'yyyy-MM-dd'), [today]);
  const rangeTo = useMemo(() => format(addDays(today, RANGE_FUTURE_DAYS), 'yyyy-MM-dd'), [today]);

  const {
    data: workoutLogs,
    refetch: refetchWorkoutLogs,
  } = useWorkoutLogsInRange(userId, { from: rangeFrom, to: rangeTo });
  const { data: scheduledWorkouts, refetch: refetchScheduledWorkouts } = useScheduledWorkouts(userId, {
    from: rangeFrom,
    to: rangeTo,
  });
  const { data: weeklySchedule, refetch: refetchWeeklySchedule } = useWeeklySchedule(userId);
  const { data: loggedSets, refetch: refetchLoggedSets } = useLoggedSets(userId);
  const { data: integrationConnections } = useIntegrationConnections(userId);
  const isWhoopConnected = integrationConnections?.some(c => c.provider === 'whoop' && c.access_token != null) ?? false;
  const syncWhoopMetrics = useSyncWhoopMetrics();
  const readinessContext = useReadinessContext(userId);
  const readiness = useMemo(
    () => (readinessContext.isLoading ? null : coachingEngine.evaluateReadiness(readinessContext.inputs)),
    [readinessContext.isLoading, readinessContext.inputs],
  );

  const { activePatterns, params: patternParams } = useTrainingPatterns(userId);
  const syncPatterns = useSyncTrainingPatterns();
  const dismissPattern = useDismissTrainingPattern();
  const detectedPatterns = useMemo(
    () => (patternParams ? coachingEngine.detectTrainingPatterns(patternParams) : []),
    [patternParams],
  );
  const lastSyncSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || !patternParams) return;
    const signature = JSON.stringify([
      detectedPatterns.map(p => `${p.key}:${p.confidence.toFixed(3)}`),
      patternParams.dismissedKeys,
    ]);
    if (signature === lastSyncSignatureRef.current) return;
    lastSyncSignatureRef.current = signature;
    syncPatterns.mutate({ userId, detected: detectedPatterns, activeRows: activePatterns });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, patternParams]);

  const {
    data: friendsPosts,
    isLoading: friendsPostsLoading,
    isError: friendsPostsError,
    refetch: refetchFriendsPosts,
  } = useFriendsPosts(userId);
  const friendsActivityPreview = useMemo(
    () => (friendsPosts ?? []).slice(0, FRIENDS_ACTIVITY_PREVIEW_LIMIT),
    [friendsPosts],
  );
  const { data: friendsActivityPhotoUrls } = useSignedPhotoUrls(friendsActivityPreview.flatMap(postPhotoPaths));
  const hasTrackedFriendsActivityView = useRef(false);
  useEffect(() => {
    if (friendsPostsLoading || friendsPostsError || hasTrackedFriendsActivityView.current) return;
    hasTrackedFriendsActivityView.current = true;
    trackEvent('friends_posts_viewed', { count: friendsActivityPreview.length });
  }, [friendsPostsLoading, friendsPostsError, friendsActivityPreview.length]);

  const onFriendActivityCardPress = (post: FriendPost) => {
    trackEvent('friends_posts_card_tapped', { entry_type: post.post_type });
    rootNavigation.navigate('MainTabs', {
      screen: 'CommunityTab',
      params: { screen: 'PostDetail', params: { postId: post.id } },
    });
  };

  const onFriendsActivityViewAll = () => {
    trackEvent('friends_posts_view_all_tapped');
    rootNavigation.navigate('MainTabs', { screen: 'CommunityTab', params: { screen: 'Posts' } });
  };

  const onFriendsActivityRetry = () => {
    trackEvent('friends_posts_retry_tapped');
    refetchFriendsPosts();
  };

  const completedDates = useMemo(
    () => new Set((workoutLogs ?? []).map(log => dateKey(new Date(log.completedAt)))),
    [workoutLogs],
  );
  const cardioDates = useMemo(
    () => new Set((workoutLogs ?? []).filter(log => log.cardio != null).map(log => dateKey(new Date(log.completedAt)))),
    [workoutLogs],
  );
  const scheduledByDate = useMemo(() => {
    const map = new Map<string, NonNullable<typeof scheduledWorkouts>[number]>();
    for (const sw of scheduledWorkouts ?? []) map.set(sw.scheduled_date, sw);
    return map;
  }, [scheduledWorkouts]);
  const weeklyScheduleDaysOfWeek = useMemo(
    () => new Set((weeklySchedule ?? []).map(entry => entry.day_of_week)),
    [weeklySchedule],
  );
  const prEvents = useMemo(() => (loggedSets ? computePrEvents(loggedSets) : []), [loggedSets]);
  const prDates = useMemo(
    () => new Set(prEvents.map(e => dateKey(new Date(e.loggedAt)))),
    [prEvents],
  );
  const streak = useMemo(
    () => computeStreak(program, completedDates, today, weeklySchedule),
    [program, completedDates, today, weeklySchedule],
  );

  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
  const sessionsThisWeek = useMemo(
    () =>
      [...completedDates].filter(key => {
        const d = new Date(key);
        return d >= weekStart && d <= weekEnd;
      }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completedDates],
  );
  const weeklyTarget = program?.days_per_week ?? 0;
  const weeklyProgress = weeklyTarget > 0 ? Math.min(1, sessionsThisWeek / weeklyTarget) : 0;

  const resolvedSelected = getProgramDayForDate(program, selectedDate);
  const scheduledSelected = scheduledByDate.get(dateKey(selectedDate));
  const weeklyScheduleSelected = asTrainingEntry(getWeeklyScheduleForDate(weeklySchedule, selectedDate));
  const { data: selectedWeeklyTemplate } = useWorkoutTemplate(weeklyScheduleSelected?.workout_template_id);
  const startTemplateToday = useStartTemplateToday();
  const isSelectedCompleted = completedDates.has(dateKey(selectedDate));
  const isSelectedToday = isDateToday(selectedDate);
  const isSelectedFuture = isFuture(selectedDate) && !isSelectedToday;
  const isSelectedPr = prDates.has(dateKey(selectedDate));
  const selectedWorkoutLogIds = useMemo(
    () => (workoutLogs ?? []).filter(log => dateKey(new Date(log.completedAt)) === dateKey(selectedDate)).map(log => log.id),
    [workoutLogs, selectedDate],
  );

  // Real summary for the completed-day card below — sourced from the same
  // workoutLogs/loggedSets queries already fetched on this screen, filtered
  // to the selected date. No separate per-workout query exists yet, so
  // duration comes from summing every workout_log completed that day and
  // set stats come from every logged set with a matching logged_at date.
  const selectedDaySummary = useMemo(() => {
    if (!isSelectedCompleted) return null;
    const dayKey = dateKey(selectedDate);
    const logsForDay = (workoutLogs ?? []).filter(log => dateKey(new Date(log.completedAt)) === dayKey);
    const setsForDay = (loggedSets ?? []).filter(s => dateKey(new Date(s.loggedAt)) === dayKey);

    const durationMinutes = logsForDay.reduce((sum, log) => {
      const minutes = (new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 60_000;
      return sum + Math.max(0, minutes);
    }, 0);
    const totalReps = setsForDay.reduce((sum, s) => sum + s.reps, 0);
    const totalVolumeKg = setsForDay.reduce((sum, s) => sum + (s.loadKg ?? 0) * s.reps, 0);
    const exerciseCount = new Set(setsForDay.map(s => s.exerciseId)).size;

    return {
      durationMinutes: Math.round(durationMinutes),
      totalSets: setsForDay.length,
      totalReps,
      totalVolumeKg,
      exerciseCount,
    };
  }, [isSelectedCompleted, selectedDate, workoutLogs, loggedSets]);

  // A day's completed-card shows cardio stats only when every log completed
  // that day came from LogCardioScreen — a mixed cardio+strength day falls
  // back to CompletedWorkoutCard rather than trying to merge both kinds of
  // summary into one card.
  const selectedCardioSummary = useMemo(() => {
    if (!isSelectedCompleted) return null;
    const dayKey = dateKey(selectedDate);
    const logsForDay = (workoutLogs ?? []).filter(log => dateKey(new Date(log.completedAt)) === dayKey);
    const cardioEntries = logsForDay.map(log => log.cardio).filter((c): c is NonNullable<typeof c> => c != null);
    if (cardioEntries.length === 0 || cardioEntries.length !== logsForDay.length) return null;

    const hasDistance = cardioEntries.some(c => c.distanceKm != null);
    return {
      activityName: cardioEntries.length === 1 ? cardioEntries[0].activityName : 'Cardio',
      durationMinutes: cardioEntries.reduce((sum, c) => sum + c.durationMinutes, 0),
      distanceKm: hasDistance ? cardioEntries.reduce((sum, c) => sum + (c.distanceKm ?? 0), 0) : null,
      effort: cardioEntries.length === 1 ? cardioEntries[0].effort : null,
      estimatedCalories: cardioEntries.reduce((sum, c) => sum + c.estimatedCalories, 0),
    };
  }, [isSelectedCompleted, selectedDate, workoutLogs]);

  const firstName = profile?.display_name?.trim().split(/\s+/)[0];

  const yesterday = addDays(today, -1);
  const resolvedYesterday = getProgramDayForDate(program, yesterday);
  const weeklyScheduleYesterday = asTrainingEntry(getWeeklyScheduleForDate(weeklySchedule, yesterday));
  const missedYesterday =
    ((resolvedYesterday != null && !resolvedYesterday.day.is_rest_day) || weeklyScheduleYesterday != null) &&
    !completedDates.has(dateKey(yesterday));
  const completedYesterday = completedDates.has(dateKey(yesterday));

  const recentPr = [...prEvents]
    .reverse()
    .map(e => ({
      ...e,
      daysAgo: Math.floor((today.getTime() - new Date(e.loggedAt).getTime()) / 86_400_000),
      sameCalendarWeek: isSameWeek(new Date(e.loggedAt), today, { weekStartsOn: 0 }),
    }))
    .find(e => e.daysAgo >= 0 && e.daysAgo <= 6);

  const resolvedToday = getProgramDayForDate(program, today);
  const isDeloadWeek = resolvedToday?.week.deload ?? false;

  const weeksCount = program?.weeks_count ?? 0;
  const midWeek = Math.ceil(weeksCount / 2);
  const currentWeekNumber = resolvedToday?.week.week_number;
  const isMilestoneWeek =
    weeksCount > 1 &&
    currentWeekNumber != null &&
    (currentWeekNumber === 1 || currentWeekNumber === midWeek || currentWeekNumber === weeksCount);

  const isTodayCompleted = completedDates.has(dateKey(today));
  const scheduledToday = scheduledByDate.get(dateKey(today));
  const weeklyScheduleToday = asTrainingEntry(getWeeklyScheduleForDate(weeklySchedule, today));
  const todayPlan = useMemo<TodayPlanContext>(() => {
    if (isTodayCompleted) {
      return {
        kind: 'completed',
        dayTitle: scheduledToday?.name ?? weeklyScheduleToday?.workout_templates.name ?? resolvedToday?.day.title ?? null,
      };
    }
    if (scheduledToday) return { kind: 'scheduled', name: scheduledToday.name };
    if (weeklyScheduleToday) {
      return {
        kind: 'training_day',
        dayTitle: weeklyScheduleToday.workout_templates.name,
        exerciseCount: weeklyScheduleToday.workout_templates.workout_template_exercises.length,
        isDeload: false,
      };
    }
    if (resolvedToday?.day.is_rest_day) return { kind: 'rest_day' };
    if (resolvedToday) {
      return {
        kind: 'training_day',
        dayTitle: resolvedToday.day.title,
        exerciseCount: resolvedToday.day.program_exercises.length,
        isDeload: isDeloadWeek,
      };
    }
    return { kind: 'none' };
  }, [isTodayCompleted, resolvedToday, scheduledToday, weeklyScheduleToday, isDeloadWeek]);

  const todayFocusSummary = useMemo(
    () =>
      coachingEngine.generateTodayFocusSummary({
        readiness,
        plan: todayPlan,
        recentPr: recentPr
          ? {
              exerciseName: recentPr.exerciseName,
              loadKg: recentPr.loadKg,
              reps: recentPr.reps,
              daysAgo: recentPr.daysAgo,
              sameCalendarWeek: recentPr.sameCalendarWeek,
            }
          : null,
        missedYesterday,
        completedYesterday,
        isMilestoneWeek,
        currentWeekNumber: currentWeekNumber ?? null,
        weeksCount,
        streak,
      }),
    [
      readiness,
      todayPlan,
      recentPr,
      missedYesterday,
      completedYesterday,
      isMilestoneWeek,
      currentWeekNumber,
      weeksCount,
      streak,
    ],
  );

  // Keeps the Home Screen/Lock Screen widget in sync with whatever this
  // screen itself just showed — same headline/summary/band AiSummaryCard
  // renders, same day-plan data CalendarScreen's "what's next" reads from.
  // Fires on every refetch that lands here (pull-to-refresh, refocus, a
  // Whoop sync completing), which is the "whenever the app is refreshed
  // with latest metrics" half of the widget's refresh contract — the other
  // half (the daily 6 AM rollover) lives entirely on the widget extension's
  // own timeline policy and needs nothing from this screen.
  // The widget itself is a SetSocial Premium perk — a free athlete simply
  // never gets synced, so any widget they've added via iOS's own UI just
  // sits on whatever it last showed (or its native-side empty state)
  // instead of updating with real data.
  useEffect(() => {
    if (isLoading || !profile?.is_premium) return;
    syncWidget(
      buildWidgetPayload({
        today,
        todayFocusSummary,
        isRestDay: todayPlan.kind === 'rest_day',
        program,
        weeklySchedule,
        scheduledWorkouts,
        workoutLogs,
        sessionsThisWeek,
        weeklyTarget,
      }),
    );
  }, [
    isLoading,
    profile?.is_premium,
    today,
    todayFocusSummary,
    todayPlan,
    program,
    weeklySchedule,
    scheduledWorkouts,
    workoutLogs,
    sessionsThisWeek,
    weeklyTarget,
  ]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Fire-and-forget, like WhoopMetricsSection's own focus-triggered sync —
    // a slow or failed Whoop round-trip shouldn't hold up the rest of the
    // pull-to-refresh. Its onSuccess invalidates the whoopMetrics query,
    // which readinessContext (and today's AI focus summary) reads from.
    if (isWhoopConnected && userId) {
      syncWhoopMetrics.mutate(userId);
    }
    try {
      await Promise.all([
        refetchProgram(),
        refetchWorkoutLogs(),
        refetchScheduledWorkouts(),
        refetchWeeklySchedule(),
        refetchLoggedSets(),
        refetchFriendsPosts(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    refetchProgram,
    refetchWorkoutLogs,
    refetchScheduledWorkouts,
    refetchWeeklySchedule,
    refetchLoggedSets,
    refetchFriendsPosts,
    isWhoopConnected,
    userId,
    syncWhoopMetrics,
  ]);

  const goToLogWorkout = (programDayId?: string, scheduledWorkoutId?: string) => {
    navigateToStartWorkout(rootNavigation, { programDayId, scheduledWorkoutId });
  };

  const goToScheduledDetail = (scheduledWorkoutId: string) => {
    rootNavigation.navigate('MainTabs', {
      screen: 'ProgramsTab',
      params: { screen: 'ScheduledWorkoutDetail', params: { scheduledWorkoutId } },
    });
  };

  const goToTrainingDayDetail = (weeklyScheduleId: string, workoutTemplateId: string, dayOfWeek: number) => {
    todayNavigation.navigate('TrainingDayDetail', { weeklyScheduleId, workoutTemplateId, dayOfWeek });
  };

  const onStartWeeklyTemplate = async () => {
    if (!userId || !selectedWeeklyTemplate) return;
    try {
      const scheduled = await startTemplateToday.mutateAsync({ userId, template: selectedWeeklyTemplate });
      goToLogWorkout(undefined, scheduled.id);
    } catch (err) {
      Alert.alert('Could not start workout', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <ScrollView
        testID="today-scroll-view"
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent.primary} />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="label" color="secondary">
              {format(today, 'EEEE, MMM d').toUpperCase()}
            </Text>
            <Text variant="title" numberOfLines={1}>
              {greeting(today.getHours())}{firstName ? `, ${firstName}` : ''}
            </Text>
          </View>
          <Avatar
            uri={profile?.avatar_url}
            size={40}
            onPress={() => rootNavigation.navigate('Profile', { screen: 'Profile' })}
          />
        </View>

        <AiSummaryCard
          headline={todayFocusSummary.headline}
          summary={todayFocusSummary.summary}
          band={todayFocusSummary.band}
          isRestDay={todayPlan.kind === 'rest_day'}
        />

        {isLoading ? (
          <LoadingState fill={false} />
        ) : (
          <WeekTimeline
            program={program}
            completedDates={completedDates}
            cardioDates={cardioDates}
            scheduledDates={new Set(scheduledByDate.keys())}
            weeklyScheduleDaysOfWeek={weeklyScheduleDaysOfWeek}
            prDates={prDates}
            streak={streak}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}

        {activePatterns.length > 0 ? (
          <Card variant="elevated" style={{ gap: theme.spacing.sm }}>
            <Text variant="subtitle">Coach Insight</Text>
            {activePatterns.slice(0, MAX_INSIGHTS_SHOWN).map((pattern, index) => (
              <View
                key={pattern.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: theme.spacing.sm,
                  paddingTop: index > 0 ? theme.spacing.sm : 0,
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderTopColor: theme.colors.border.subtle,
                }}
              >
                <Icon name={PATTERN_ICON[pattern.pattern_type]} size="sm" color={theme.colors.accent.primary} />
                <View style={{ flex: 1 }}>
                  <Text variant="body" style={{ fontWeight: '700' }}>
                    {pattern.title}
                  </Text>
                  <Text variant="caption" color="secondary">
                    {pattern.detail}
                  </Text>
                </View>
                <IconButton
                  name="x"
                  variant="ghost"
                  size={28}
                  accessibilityLabel="Dismiss insight"
                  onPress={() => userId && dismissPattern.mutate({ id: pattern.id, userId })}
                />
              </View>
            ))}
          </Card>
        ) : null}

        {!isLoading && program ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <ProgressRing progress={weeklyProgress} size={56} strokeWidth={6} centerValue={`${sessionsThisWeek}/${weeklyTarget}`} />
            <View style={{ flex: 1 }}>
              <Text variant="subtitle">
                {sessionsThisWeek >= weeklyTarget && weeklyTarget > 0 ? 'Week complete' : 'On track this week'}
              </Text>
              <Text variant="caption" color="tertiary">
                {Math.max(weeklyTarget - sessionsThisWeek, 0)} session{weeklyTarget - sessionsThisWeek === 1 ? '' : 's'} left
                {streak > 0 ? ` · ${streak} day streak` : ''}
              </Text>
            </View>
          </View>
        ) : null}

        {isLoading ? null : (
          <>
            {isSelectedCompleted && selectedCardioSummary ? (
              <CompletedCardioCard
                selectedDate={selectedDate}
                isSelectedToday={isSelectedToday}
                summary={selectedCardioSummary}
              />
            ) : isSelectedCompleted ? (
              <CompletedWorkoutCard
                selectedDate={selectedDate}
                isSelectedToday={isSelectedToday}
                workoutLogIds={selectedWorkoutLogIds}
                fallbackTitle={
                  scheduledSelected?.name ?? weeklyScheduleSelected?.workout_templates.name ?? resolvedSelected?.day.title ?? null
                }
                isPr={isSelectedPr}
                summary={selectedDaySummary}
              />
            ) : scheduledSelected ? (
              <Card variant="elevated" style={{ gap: theme.spacing.sm }}>
                <View>
                  <Text variant="label" color="secondary">
                    SCHEDULED
                  </Text>
                  <Text variant="title">{scheduledSelected.name}</Text>
                </View>
                {isSelectedToday ? (
                  <Button label="Start Workout" onPress={() => goToLogWorkout(undefined, scheduledSelected.id)} />
                ) : (
                  <Button
                    label="View Day"
                    variant="secondary"
                    onPress={() => goToScheduledDetail(scheduledSelected.id)}
                  />
                )}
              </Card>
            ) : weeklyScheduleSelected ? (
              <Card variant="elevated" style={{ gap: theme.spacing.sm }}>
                <View>
                  <Text variant="label" color="secondary">
                    {format(selectedDate, 'EEEE').toUpperCase()} · EVERY WEEK
                  </Text>
                  <Text variant="title">{weeklyScheduleSelected.workout_templates.name}</Text>
                  <Text variant="caption" color="secondary">
                    {weeklyScheduleSelected.workout_templates.workout_template_exercises.length} exercises
                  </Text>
                </View>

                {selectedWeeklyTemplate ? (
                  <View>
                    {selectedWeeklyTemplate.workout_template_exercises.slice(0, 3).map((te, index) => (
                      <ListRow
                        key={te.id}
                        title={te.exercises.name}
                        trailing={
                          <Text variant="body" color="secondary">
                            {te.target_sets} × {te.target_reps_min}
                            {te.target_reps_max && te.target_reps_max !== te.target_reps_min
                              ? `-${te.target_reps_max}`
                              : ''}
                          </Text>
                        }
                        style={index > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle } : undefined}
                      />
                    ))}
                    {selectedWeeklyTemplate.workout_template_exercises.length > 3 ? (
                      <Text variant="caption" color="tertiary" style={{ paddingTop: theme.spacing.xs }}>
                        + {selectedWeeklyTemplate.workout_template_exercises.length - 3} more
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {isSelectedToday ? (
                  <Button label="Start Workout" onPress={onStartWeeklyTemplate} loading={startTemplateToday.isPending} />
                ) : (
                  <Button
                    label="View Day"
                    variant="secondary"
                    onPress={() =>
                      goToTrainingDayDetail(
                        weeklyScheduleSelected.id,
                        weeklyScheduleSelected.workout_template_id,
                        weeklyScheduleSelected.day_of_week,
                      )
                    }
                  />
                )}
              </Card>
            ) : resolvedSelected?.day.is_rest_day ? (
              <Card variant="elevated" style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xl }}>
                <Icon name="moon" size="lg" color={theme.colors.text.secondary} />
                <Text variant="subtitle">Rest day</Text>
                <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
                  Recovery is part of the program. Back at it next session.
                </Text>
              </Card>
            ) : resolvedSelected ? (
              <Card variant="elevated" style={{ gap: theme.spacing.sm }}>
                <View>
                  <Text variant="label" color="secondary">
                    WEEK {resolvedSelected.week.week_number}
                    {resolvedSelected.week.deload ? ' · DELOAD' : ''}
                  </Text>
                  <Text variant="title">{resolvedSelected.day.title ?? 'Training Day'}</Text>
                  <Text variant="caption" color="secondary">
                    {resolvedSelected.day.program_exercises.length} exercises
                    {estimateMinutes(resolvedSelected.day.program_exercises)
                      ? ` · ~${estimateMinutes(resolvedSelected.day.program_exercises)} min`
                      : ''}
                  </Text>
                </View>

                <View>
                  {resolvedSelected.day.program_exercises.slice(0, 3).map((pe, index) => (
                    <ListRow
                      key={pe.id}
                      title={pe.exercises.name}
                      trailing={
                        <Text variant="body" color="secondary">
                          {pe.target_sets} × {pe.target_reps_min}
                          {pe.target_reps_max && pe.target_reps_max !== pe.target_reps_min
                            ? `-${pe.target_reps_max}`
                            : ''}
                        </Text>
                      }
                      style={index > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle } : undefined}
                    />
                  ))}
                  {resolvedSelected.day.program_exercises.length > 3 ? (
                    <Text variant="caption" color="tertiary" style={{ paddingTop: theme.spacing.xs }}>
                      + {resolvedSelected.day.program_exercises.length - 3} more
                    </Text>
                  ) : null}
                </View>

                {isSelectedToday ? (
                  <Button label="Start Workout" onPress={() => goToLogWorkout(resolvedSelected.day.id)} />
                ) : (
                  <Button
                    label="View Day"
                    variant="secondary"
                    onPress={() =>
                      todayNavigation.navigate('DayDetail', {
                        programDayId: resolvedSelected.day.id,
                        date: dateKey(selectedDate),
                      })
                    }
                  />
                )}
              </Card>
            ) : (
              <Card variant="elevated" style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xl }}>
                <Text variant="subtitle">
                  {isSelectedFuture ? 'Nothing scheduled' : 'Nothing logged'}
                </Text>
                <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
                  {isSameDay(selectedDate, today)
                    ? "No training day on today's calendar."
                    : format(selectedDate, 'EEEE, MMM d')}
                </Text>
              </Card>
            )}

            {!program ? (
              <Card
                variant="elevated"
                style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xl }}
              >
                <ProgressRing progress={0} centerValue="0/0" label="sets today" />
                <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
                  Set up a training day, or generate a program with AI, from the Training tab.
                </Text>
                <Button
                  label="Go to Training"
                  onPress={() =>
                    rootNavigation.navigate('MainTabs', { screen: 'ProgramsTab', params: { screen: 'Calendar' } })
                  }
                />
              </Card>
            ) : null}

            <FriendsActivitySection
              posts={friendsActivityPreview}
              photoUrls={friendsActivityPhotoUrls ?? {}}
              isLoading={friendsPostsLoading}
              isError={friendsPostsError}
              onRetry={onFriendsActivityRetry}
              onCardPress={onFriendActivityCardPress}
              onViewAllPress={onFriendsActivityViewAll}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
