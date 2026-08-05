import React, { useEffect, useMemo } from 'react';
import { Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { endOfWeek, startOfWeek } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Card, Text, LockedFeatureCard, ListRow, ProBadge } from '../../components/core';
import { useProfile } from '../../services/api/queries/profiles';
import { useWeeklyReviewData } from '../../services/api/queries/weeklyReview';
import { coachingEngine } from '../../services/coaching';
import { useUnitPreference } from '../../hooks/useUnitPreference';
import type { RootStackParamList } from '../../navigation/types';

type RootNav = NativeStackNavigationProp<RootStackParamList>;

type WeeklyReviewTeaserCardProps = {
  userId: string | null;
  /** Renders as a ListRow inside MoreForYouCard instead of the standalone
   * card/upsell, for Home's "collapse everything into one card" layout. */
  asRow?: boolean;
  /** Fired whenever this decides to show or hide itself — see
   * GymProximityPill's identical prop for why. Non-Pro's upsell state
   * always counts as "visible" (it always has something to show). */
  onVisibilityChange?: (visible: boolean) => void;
};

/** Teaser for the same Weekly Review WeeklyReviewScreen already computes on
 * every visit — duplicates that exact aggregation for the current week
 * (no lightweight "is a new review ready" signal exists anywhere to check
 * first) rather than inventing new plumbing for this one card. Week
 * boundary matches WeeklyReviewScreen's own Mon-Sun definition exactly, so
 * tapping through lands on the same numbers this card just showed. */
export function WeeklyReviewTeaserCard({ userId, asRow, onVisibilityChange }: WeeklyReviewTeaserCardProps) {
  const theme = useTheme();
  const rootNavigation = useNavigation<RootNav>();
  const { data: profile, isLoading: profileLoading } = useProfile(userId);
  const unitPref = useUnitPreference();
  const isPro = profile?.is_premium ?? false;

  const { weekStart, weekEnd } = useMemo(() => {
    const now = new Date();
    return { weekStart: startOfWeek(now, { weekStartsOn: 1 }), weekEnd: endOfWeek(now, { weekStartsOn: 1 }) };
  }, []);

  // Only Pro accounts ever see the result, so free accounts skip the
  // aggregation entirely rather than computing a review nobody gets shown.
  const { isLoading, params } = useWeeklyReviewData(isPro ? userId : null, weekStart, weekEnd, unitPref);
  const review = useMemo(() => (params ? coachingEngine.generateWeeklyReview(params) : null), [params]);

  const goToWeeklyReview = () =>
    rootNavigation.navigate('MainTabs', { screen: 'ProgressTab', params: { screen: 'WeeklyReview' } });
  const goToPaywall = () => rootNavigation.navigate('Paywall', { trigger: 'analytics' });

  const hasReview = !isLoading && !!review && review.workoutsCompleted > 0;
  const visible = !profileLoading && (!isPro || hasReview);

  useEffect(() => {
    onVisibilityChange?.(visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (profileLoading) return null;

  if (!isPro) {
    if (asRow) {
      return (
        <ListRow
          title="Weekly Review"
          subtitle="Part of SetSocial Pro"
          trailing={<ProBadge />}
          onPress={goToPaywall}
        />
      );
    }
    return (
      <LockedFeatureCard
        title="Weekly Review"
        description="A weekly summary of your training, readiness, and consistency — part of SetSocial Pro."
        onUpgrade={goToPaywall}
      />
    );
  }

  if (!hasReview || !review) return null;

  const subtitle = `${review.workoutsCompleted} session${review.workoutsCompleted === 1 ? '' : 's'}${
    review.consistencyPercent != null ? ` · ${Math.round(review.consistencyPercent)}% consistency` : ''
  }${
    review.mostImprovedExercise
      ? ` · ${review.mostImprovedExercise.exerciseName} up ~${Math.round(review.mostImprovedExercise.changePercent)}%`
      : ''
  }`;

  if (asRow) {
    return <ListRow title="This week's review is ready" subtitle={subtitle} showChevron onPress={goToWeeklyReview} />;
  }

  return (
    <Pressable onPress={goToWeeklyReview} accessibilityRole="button">
      <Card variant="elevated" style={{ gap: theme.spacing.xs }}>
        <Text variant="label" color="secondary">
          THIS WEEK&apos;S REVIEW IS READY
        </Text>
        <Text variant="body" color="secondary">
          {subtitle}
        </Text>
      </Card>
    </Pressable>
  );
}
