import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProgramsStackParamList } from './types';
import { CalendarScreen } from '../screens/programs/CalendarScreen';
import { ProgramDetailScreen } from '../screens/programs/ProgramDetailScreen';
import { DayDetailScreen } from '../screens/programs/DayDetailScreen';
import { ExercisePickerScreen } from '../screens/log/ExercisePickerScreen';
import { AddExerciseScreen } from '../screens/log/AddExerciseScreen';
import { LibraryScreen } from '../screens/library/LibraryScreen';
import { TemplateEditorScreen } from '../screens/library/TemplateEditorScreen';
import { ScheduledWorkoutDetailScreen } from '../screens/library/ScheduledWorkoutDetailScreen';
import { GenerateProgramScreen } from '../screens/programs/GenerateProgramScreen';
import { AssignTrainingDayScreen } from '../screens/programs/AssignTrainingDayScreen';
import { AssignCardioDayScreen } from '../screens/programs/AssignCardioDayScreen';
import { TrainingDayDetailScreen } from '../screens/programs/TrainingDayDetailScreen';
import { WorkoutLogDetailScreen } from '../screens/programs/WorkoutLogDetailScreen';

const Stack = createNativeStackNavigator<ProgramsStackParamList>();

export function ProgramsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Calendar" component={CalendarScreen} />
      <Stack.Screen name="ProgramDetail" component={ProgramDetailScreen} />
      <Stack.Screen name="DayDetail" component={DayDetailScreen} />
      <Stack.Screen name="ExercisePicker" component={ExercisePickerScreen} />
      <Stack.Screen name="AddExercise" component={AddExerciseScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="Library" component={LibraryScreen} />
      <Stack.Screen name="TemplateEditor" component={TemplateEditorScreen} />
      <Stack.Screen name="ScheduledWorkoutDetail" component={ScheduledWorkoutDetailScreen} />
      <Stack.Screen name="GenerateProgram" component={GenerateProgramScreen} />
      <Stack.Screen name="AssignTrainingDay" component={AssignTrainingDayScreen} />
      <Stack.Screen name="AssignCardioDay" component={AssignCardioDayScreen} />
      <Stack.Screen name="TrainingDayDetail" component={TrainingDayDetailScreen} />
      <Stack.Screen name="WorkoutLogDetail" component={WorkoutLogDetailScreen} />
    </Stack.Navigator>
  );
}
