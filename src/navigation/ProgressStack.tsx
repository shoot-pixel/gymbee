import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProgressStackParamList } from './types';
import { ProgressDashboardScreen } from '../screens/progress/ProgressDashboardScreen';
import { PRDetailScreen } from '../screens/progress/PRDetailScreen';
import { BodyMetricsScreen } from '../screens/progress/BodyMetricsScreen';
import { WeeklyReviewScreen } from '../screens/progress/WeeklyReviewScreen';
import { ProgressTimelineScreen } from '../screens/progress/ProgressTimelineScreen';

const Stack = createNativeStackNavigator<ProgressStackParamList>();

export function ProgressStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProgressDashboard" component={ProgressDashboardScreen} />
      <Stack.Screen name="PRDetail" component={PRDetailScreen} />
      <Stack.Screen name="BodyMetrics" component={BodyMetricsScreen} />
      <Stack.Screen name="WeeklyReview" component={WeeklyReviewScreen} />
      <Stack.Screen name="ProgressTimeline" component={ProgressTimelineScreen} />
    </Stack.Navigator>
  );
}
