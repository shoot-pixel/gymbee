import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Header, ListRow, LoadingState } from '../../components/core';
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
      <Header title={program?.title ?? 'Program'} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.lg }}>
        {isLoading || !program ? (
          <LoadingState fill={false} />
        ) : (
          <>
            <Card variant="subtle">
              <Text variant="body" color="secondary">
                {program.weeks_count} weeks · {program.days_per_week}x/week · {program.goal ?? 'general'}
              </Text>
            </Card>

            {program.program_weeks.map(week => (
              <View key={week.id} style={{ gap: theme.spacing.xs }}>
                <Text variant="subtitle">
                  Week {week.week_number}
                  {week.focus ? ` — ${week.focus}` : ''}
                </Text>
                <Card variant="elevated" style={{ gap: 0 }}>
                  {week.program_days
                    .filter(day => !day.is_rest_day)
                    .map((day, index) => (
                      <ListRow
                        key={day.id}
                        title={day.title ?? 'Training Day'}
                        trailing={
                          <Text variant="body" color="secondary">
                            {day.program_exercises.length} exercises
                          </Text>
                        }
                        showChevron
                        onPress={() => navigation.navigate('DayDetail', { programDayId: day.id })}
                        style={
                          index > 0
                            ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle }
                            : undefined
                        }
                      />
                    ))}
                </Card>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
