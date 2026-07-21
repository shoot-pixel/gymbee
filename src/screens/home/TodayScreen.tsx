import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { addDays, endOfWeek, format, isFuture, isSameDay, isToday as isDateToday, startOfWeek } from 'date-fns';
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
import { useScheduledWorkouts } from '../../services/api/queries/scheduledWorkouts';
import { useLoggedSets, computePrEvents } from '../../services/api/queries/progress';
import {
  useTrainingPatterns,
  useSyncTrainingPatterns,
  useDismissTrainingPattern,
} from '../../services/api/queries/coachingMemory';
import { useReadinessContext } from '../../services/api/queries/coaching';
import { coachingEngine } from '../../services/coaching';
import type { TodayPlanContext, TrainingPatternType } from '../../services/coaching';
import { computeStreak } from '../../utils/streak';
import { estimateWorkoutMinutes } from '../../utils/workoutTiming';
import { navigateToStartWorkout } from '../../navigation/startWorkoutFlow';
import { WeekTimeline } from './WeekTimeline';
import { AiSummaryCard } from './AiSummaryCard';
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

const RANGE_PAST_DAYS = 91; // ~13 weeks, matches WeekTimeline's paging window
const RANGE_FUTURE_DAYS = 21;

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
  const { data: loggedSets, refetch: refetchLoggedSets } = useLoggedSets(userId);
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
  const scheduledByDate = useMemo(() => {
    const map = new Map<string, NonNullable<typeof scheduledWorkouts>[number]>();
    for (const sw of scheduledWorkouts ?? []) map.set(sw.scheduled_date, sw);
    return map;
  }, [scheduledWorkouts]);
  const prEvents = useMemo(() => (loggedSets ? computePrEvents(loggedSets) : []), [loggedSets]);
  const prDates = useMemo(
    () => new Set(prEvents.map(e => dateKey(new Date(e.loggedAt)))),
    [prEvents],
  );
  const streak = useMemo(() => computeStreak(program, completedDates, today), [program, completedDates, today]);

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
  const isSelectedCompleted = completedDates.has(dateKey(selectedDate));
  const isSelectedToday = isDateToday(selectedDate);
  const isSelectedFuture = isFuture(selectedDate) && !isSelectedToday;

  const firstName = profile?.display_name?.trim().split(/\s+/)[0];

  const yesterday = addDays(today, -1);
  const resolvedYesterday = getProgramDayForDate(program, yesterday);
  const missedYesterday =
    resolvedYesterday != null && !resolvedYesterday.day.is_rest_day && !completedDates.has(dateKey(yesterday));

  const recentPr = [...prEvents].reverse().find(e => {
    const days = Math.floor((today.getTime() - new Date(e.loggedAt).getTime()) / 86_400_000);
    return days >= 0 && days <= 6;
  });

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
  const todayPlan = useMemo<TodayPlanContext>(() => {
    if (isTodayCompleted) return { kind: 'completed', dayTitle: resolvedToday?.day.title ?? scheduledToday?.name ?? null };
    if (resolvedToday?.day.is_rest_day) return { kind: 'rest_day' };
    if (resolvedToday) {
      return {
        kind: 'training_day',
        dayTitle: resolvedToday.day.title,
        exerciseCount: resolvedToday.day.program_exercises.length,
        isDeload: isDeloadWeek,
      };
    }
    if (scheduledToday) return { kind: 'scheduled', name: scheduledToday.name };
    return { kind: 'none' };
  }, [isTodayCompleted, resolvedToday, scheduledToday, isDeloadWeek]);

  const todayFocusSummary = useMemo(
    () =>
      coachingEngine.generateTodayFocusSummary({
        readiness,
        plan: todayPlan,
        recentPr: recentPr ? { exerciseName: recentPr.exerciseName, loadKg: recentPr.loadKg, reps: recentPr.reps } : null,
        missedYesterday,
        isMilestoneWeek,
        currentWeekNumber: currentWeekNumber ?? null,
        weeksCount,
        streak,
      }),
    [readiness, todayPlan, recentPr, missedYesterday, isMilestoneWeek, currentWeekNumber, weeksCount, streak],
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchProgram(),
        refetchWorkoutLogs(),
        refetchScheduledWorkouts(),
        refetchLoggedSets(),
        refetchFriendsPosts(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchProgram, refetchWorkoutLogs, refetchScheduledWorkouts, refetchLoggedSets, refetchFriendsPosts]);

  const goToLogWorkout = (programDayId?: string, scheduledWorkoutId?: string) => {
    navigateToStartWorkout(rootNavigation, { programDayId, scheduledWorkoutId });
  };

  const goToScheduledDetail = (scheduledWorkoutId: string) => {
    rootNavigation.navigate('MainTabs', {
      screen: 'ProgramsTab',
      params: { screen: 'ScheduledWorkoutDetail', params: { scheduledWorkoutId } },
    });
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
        ) : !program ? (
          <Card variant="elevated" style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xl }}>
            <ProgressRing progress={0} centerValue="0/0" label="sets today" />
            <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
              No active program yet. Complete onboarding to get an AI-generated plan.
            </Text>
            <Button label="Start Onboarding" onPress={() => {}} />
          </Card>
        ) : (
          <>
            <WeekTimeline
              program={program}
              completedDates={completedDates}
              scheduledDates={new Set(scheduledByDate.keys())}
              prDates={prDates}
              streak={streak}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            {isSelectedCompleted ? (
              <Card variant="elevated" style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xl }}>
                <Icon name="circleCheck" size="lg" color={theme.colors.accent.primary} />
                <Text variant="subtitle">
                  {isSelectedToday ? "Today's workout is done" : `${format(selectedDate, 'EEEE')}'s workout is done`}
                </Text>
                <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
                  {resolvedSelected?.day.title ?? scheduledSelected?.name ?? 'Nice work.'}
                </Text>
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
                    onPress={() => todayNavigation.navigate('DayDetail', { programDayId: resolvedSelected.day.id })}
                  />
                )}
              </Card>
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

            <FriendsActivitySection
              posts={friendsActivityPreview}
              photoUrls={friendsActivityPhotoUrls ?? {}}
              isLoading={friendsPostsLoading}
              isError={friendsPostsError}
              onRetry={onFriendsActivityRetry}
              onCardPress={onFriendActivityCardPress}
              onViewAllPress={onFriendsActivityViewAll}
            />

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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
