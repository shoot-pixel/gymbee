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
