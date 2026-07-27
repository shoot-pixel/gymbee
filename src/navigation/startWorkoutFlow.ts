import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { featureFlags } from '../config/featureFlags';
import type { RootStackParamList } from './types';

type Source = { programDayId?: string; scheduledWorkoutId?: string };

/**
 * Single entry point for "start this workout" across Today/DayDetail/
 * ScheduledWorkoutDetail — routes through the readiness/adaptation review
 * when AI coaching is enabled, otherwise goes straight to ActiveWorkoutOverview
 * (today's pre-coaching behavior, unchanged).
 */
export function navigateToStartWorkout(
  rootNavigation: NativeStackNavigationProp<RootStackParamList>,
  source: Source,
): void {
  if (!featureFlags.aiCoaching) {
    rootNavigation.navigate('MainTabs', {
      screen: 'LogTab',
      params: { screen: 'ActiveWorkoutOverview', params: source },
    });
    return;
  }

  rootNavigation.navigate('MainTabs', {
    screen: 'LogTab',
    params: { screen: 'PreWorkoutReview', params: source },
  });
}

/**
 * Entry point for "choose a workout variant" (time budget / equipment /
 * training emphasis) — a deliberate, explicit user choice, distinct from
 * (and not gated by) featureFlags.aiCoaching's readiness-adaptation path.
 */
export function navigateToChooseVariant(
  rootNavigation: NativeStackNavigationProp<RootStackParamList>,
  source: Source,
): void {
  rootNavigation.navigate('MainTabs', {
    screen: 'LogTab',
    params: { screen: 'ChooseVariant', params: source },
  });
}

/**
 * Cardio's equivalent of navigateToStartWorkout — always goes straight to
 * LogCardio, skipping PreWorkoutReview/ChooseVariant regardless of
 * featureFlags.aiCoaching. Those screens are strength-specific (readiness
 * adaptation, exercise variants); a cardio session has neither.
 */
export function navigateToStartCardio(
  rootNavigation: NativeStackNavigationProp<RootStackParamList>,
  source: { programDayId?: string; date?: string } = {},
): void {
  rootNavigation.navigate('MainTabs', {
    screen: 'LogTab',
    params: { screen: 'LogCardio', params: source },
  });
}
