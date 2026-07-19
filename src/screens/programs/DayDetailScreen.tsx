import React from 'react';
import { ScrollView, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button } from '../../components/core';
import { useProgramDay } from '../../services/api/queries/programs';
import type { ProgramsStackParamList, TodayStackParamList, RootStackParamList } from '../../navigation/types';

// DayDetail is registered on both TodayStack and ProgramsStack with identical
// params — either param list satisfies the route shape we read here.
type Route = RouteProp<ProgramsStackParamList | TodayStackParamList, 'DayDetail'>;
type Nav = NativeStackNavigationProp<ProgramsStackParamList | TodayStackParamList>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

export function DayDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const rootNavigation = useNavigation<RootNav>();
  const { params } = useRoute<Route>();
  const { data: day, isLoading } = useProgramDay(params.programDayId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Text
            variant="subtitle"
            color="secondary"
            onPress={() => navigation.goBack()}
            style={{ fontSize: 22 }}
          >
            ←
          </Text>
          <Text variant="title">{day?.title ?? 'Day'}</Text>
        </View>

        {isLoading || !day ? (
          <ActivityIndicator color={theme.colors.accent.primary} />
        ) : (
          <>
            <Text variant="body" color="secondary">
              {day.program_weeks.programs.title} · Week {day.program_weeks.week_number}
            </Text>

            {day.program_exercises.map(pe => (
              <Card key={pe.id} style={{ gap: theme.spacing.xs }}>
                <Text variant="subtitle">{pe.exercises.name}</Text>
                <Text variant="body" color="secondary">
                  {pe.target_sets} sets × {pe.target_reps_min}
                  {pe.target_reps_max && pe.target_reps_max !== pe.target_reps_min
                    ? `-${pe.target_reps_max}`
                    : ''}{' '}
                  reps
                  {pe.target_rpe ? ` @ RPE ${pe.target_rpe}` : ''}
                </Text>
                {pe.rest_seconds ? (
                  <Text variant="caption" color="tertiary">
                    Rest {pe.rest_seconds}s
                  </Text>
                ) : null}
              </Card>
            ))}

            <Button
              label="Log This Workout"
              onPress={() =>
                rootNavigation.navigate('MainTabs', {
                  screen: 'LogTab',
                  params: { screen: 'LogWorkout', params: { programDayId: day.id } },
                })
              }
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
