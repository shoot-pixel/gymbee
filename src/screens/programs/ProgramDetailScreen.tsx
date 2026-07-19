import React from 'react';
import { ScrollView, View, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card } from '../../components/core';
import { useProgramTree } from '../../services/api/queries/programs';
import type { ProgramsStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ProgramsStackParamList>;
type Route = RouteProp<ProgramsStackParamList, 'ProgramDetail'>;

export function ProgramDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { data: program, isLoading } = useProgramTree(params.programId);

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
          <Text variant="title">{program?.title ?? 'Program'}</Text>
        </View>

        {isLoading || !program ? (
          <ActivityIndicator color={theme.colors.accent.primary} />
        ) : (
          <>
            <Card>
              <Text variant="body" color="secondary">
                {program.weeks_count} weeks · {program.days_per_week}x/week · {program.goal ?? 'general'}
              </Text>
            </Card>

            {program.program_weeks.map(week => (
              <View key={week.id} style={{ gap: theme.spacing.sm }}>
                <Text variant="subtitle">
                  Week {week.week_number}
                  {week.focus ? ` — ${week.focus}` : ''}
                </Text>
                {week.program_days
                  .filter(day => !day.is_rest_day)
                  .map(day => (
                    <Pressable
                      key={day.id}
                      onPress={() => navigation.navigate('DayDetail', { programDayId: day.id })}
                    >
                      <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text variant="body">{day.title ?? 'Training Day'}</Text>
                        <Text variant="body" color="secondary">
                          {day.program_exercises.length} exercises
                        </Text>
                      </Card>
                    </Pressable>
                  ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
