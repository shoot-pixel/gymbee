import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { LogStackParamList } from './types';
import { LogLandingScreen } from '../screens/log/LogLandingScreen';
import { PreWorkoutReviewScreen } from '../screens/log/PreWorkoutReviewScreen';
import { ChooseVariantScreen } from '../screens/log/ChooseVariantScreen';
import { ActiveWorkoutOverviewScreen } from '../screens/log/ActiveWorkoutOverviewScreen';
import { ActiveExerciseScreen } from '../screens/log/ActiveExerciseScreen';
import { ExercisePickerScreen } from '../screens/log/ExercisePickerScreen';
import { AddExerciseScreen } from '../screens/log/AddExerciseScreen';
import { ExerciseDetailScreen } from '../screens/exercises/ExerciseDetailScreen';
import { WorkoutSummaryScreen } from '../screens/log/WorkoutSummaryScreen';
import { LibraryScreen } from '../screens/library/LibraryScreen';
import { TemplateEditorScreen } from '../screens/library/TemplateEditorScreen';

const Stack = createNativeStackNavigator<LogStackParamList>();

export function LogStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LogLanding" component={LogLandingScreen} />
      <Stack.Screen name="PreWorkoutReview" component={PreWorkoutReviewScreen} />
      <Stack.Screen name="ChooseVariant" component={ChooseVariantScreen} />
      <Stack.Screen name="ActiveWorkoutOverview" component={ActiveWorkoutOverviewScreen} />
      <Stack.Screen name="ActiveExercise" component={ActiveExerciseScreen} />
      <Stack.Screen name="ExercisePicker" component={ExercisePickerScreen} />
      <Stack.Screen name="AddExercise" component={AddExerciseScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />
      <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen} />
      <Stack.Screen name="Library" component={LibraryScreen} />
      <Stack.Screen name="TemplateEditor" component={TemplateEditorScreen} />
    </Stack.Navigator>
  );
}
