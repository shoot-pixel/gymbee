import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Header, IconButton, ListRow, LoadingState, BottomSheet } from '../../components/core';
import { useProgramTree, useDeleteProgram, useSetDayType } from '../../services/api/queries/programs';
import type { ProgramsStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ProgramsStackParamList>;
type Route = RouteProp<ProgramsStackParamList, 'ProgramDetail'>;

export function ProgramDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { data: program, isLoading } = useProgramTree(params.programId);
  const deleteProgram = useDeleteProgram();
  const setDayType = useSetDayType();
  const [menuOpen, setMenuOpen] = useState(false);

  // Un-marks the day as rest and jumps straight into DayDetail so the
  // athlete can add exercises to it right away — same destination "Training
  // Day" rows in this list already navigate to, just reached from a
  // different starting point (a day that changed its mind about being rest).
  const onAddWorkout = (dayId: string) => {
    setDayType.mutate(
      { id: dayId, dayType: 'training' },
      { onSuccess: () => navigation.navigate('DayDetail', { programDayId: dayId }) },
    );
  };

  const onDelete = () => {
    if (!program) return;
    setMenuOpen(false);
    Alert.alert(
      'Delete program?',
      "This can't be undone. Your logged workout history isn't affected.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProgram.mutateAsync(program.id);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Could not delete program', err instanceof Error ? err.message : 'Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header
        title={program?.title ?? 'Program'}
        right={
          program ? (
            <IconButton
              name="moreVertical"
              variant="ghost"
              accessibilityLabel="Program options"
              onPress={() => setMenuOpen(true)}
            />
          ) : undefined
        }
      />
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
                  {week.program_days.map((day, index) =>
                    day.is_rest_day ? (
                      <ListRow
                        key={day.id}
                        title={day.title ?? 'Rest Day'}
                        subtitle="Rest — tap to add a workout"
                        icon="moon"
                        showChevron
                        onPress={() => onAddWorkout(day.id)}
                        style={
                          index > 0
                            ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle }
                            : undefined
                        }
                      />
                    ) : (
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
                    ),
                  )}
                </Card>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <ListRow title="Delete Program" icon="trash" onPress={onDelete} />
      </BottomSheet>
    </SafeAreaView>
  );
}
