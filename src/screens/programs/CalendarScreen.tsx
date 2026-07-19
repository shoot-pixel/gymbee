import React from 'react';
import { ScrollView, View, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useActiveProgramTree, getTodayProgramDay } from '../../services/api/queries/programs';
import type { ProgramsStackParamList } from '../../navigation/types';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarScreen() {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const { data: program, isLoading } = useActiveProgramTree(userId);
  const navigation = useNavigation<NativeStackNavigationProp<ProgramsStackParamList>>();
  const todaysDay = getTodayProgramDay(program);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <Text variant="title">Programs</Text>

        {isLoading ? (
          <ActivityIndicator color={theme.colors.accent.primary} />
        ) : !program ? (
          <Card>
            <Text variant="subtitle">No program yet</Text>
            <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.xs }}>
              Once generated, your weeks and days will show up here.
            </Text>
          </Card>
        ) : (
          <>
            <Pressable onPress={() => navigation.navigate('ProgramDetail', { programId: program.id })}>
              <Card>
                <Text variant="subtitle">{program.title}</Text>
                <Text variant="body" color="secondary">
                  {program.weeks_count} weeks · {program.days_per_week}x/week
                </Text>
              </Card>
            </Pressable>

            {program.program_weeks.map(week => (
              <View key={week.id} style={{ gap: theme.spacing.sm }}>
                <Text variant="label" color="secondary">
                  WEEK {week.week_number}
                  {week.focus ? ` · ${week.focus.toUpperCase()}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {week.program_days.map(day => {
                    const isToday = todaysDay?.day.id === day.id;
                    return (
                      <Pressable
                        key={day.id}
                        disabled={day.is_rest_day}
                        onPress={() => navigation.navigate('DayDetail', { programDayId: day.id })}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: theme.radii.pill,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: day.is_rest_day
                            ? theme.colors.bg.surface
                            : theme.colors.bg.surfaceElevated,
                          borderWidth: isToday ? 2 : 1,
                          borderColor: isToday ? theme.colors.accent.primary : theme.colors.border.default,
                        }}
                      >
                        <Text
                          variant="caption"
                          color={day.is_rest_day ? 'tertiary' : 'primary'}
                        >
                          {DAY_LABELS[day.day_of_week ?? 0]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
