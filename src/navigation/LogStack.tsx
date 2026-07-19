import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { LogStackParamList } from './types';
import { LogWorkoutScreen } from '../screens/log/LogWorkoutScreen';
import { ExercisePickerScreen } from '../screens/log/ExercisePickerScreen';
import { ExerciseDetailScreen } from '../screens/exercises/ExerciseDetailScreen';

const Stack = createNativeStackNavigator<LogStackParamList>();

export function LogStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LogWorkout" component={LogWorkoutScreen} />
      <Stack.Screen name="ExercisePicker" component={ExercisePickerScreen} />
      <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />
    </Stack.Navigator>
  );
}
