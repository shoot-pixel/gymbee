import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProgramsStackParamList } from './types';
import { CalendarScreen } from '../screens/programs/CalendarScreen';
import { ProgramDetailScreen } from '../screens/programs/ProgramDetailScreen';
import { DayDetailScreen } from '../screens/programs/DayDetailScreen';

const Stack = createNativeStackNavigator<ProgramsStackParamList>();

export function ProgramsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Calendar" component={CalendarScreen} />
      <Stack.Screen name="ProgramDetail" component={ProgramDetailScreen} />
      <Stack.Screen name="DayDetail" component={DayDetailScreen} />
    </Stack.Navigator>
  );
}
