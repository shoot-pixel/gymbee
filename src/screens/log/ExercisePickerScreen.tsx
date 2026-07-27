import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { TextField, ListRow, LoadingState, EmptyState, Header, IconButton } from '../../components/core';
import { useExercises } from '../../services/api/queries/exercises';
import { useActiveWorkoutStore } from '../../store/activeWorkoutStore';
import { formatEnumLabel } from '../../utils/exerciseMetadata';
import { useWorkoutTemplate, useAddTemplateExercise } from '../../services/api/queries/workoutTemplates';
import { useProgramDay, useAddProgramExercise } from '../../services/api/queries/programs';
import { useUnitPreference } from '../../hooks/useUnitPreference';
import type { LogStackParamList, ProgramsStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<LogStackParamList>;
// ExercisePicker is registered on both LogStack and ProgramsStack (reached
// from TemplateEditor/DayDetail on either) with identical params.
type Route = RouteProp<LogStackParamList | ProgramsStackParamList, 'ExercisePicker'>;

export function ExercisePickerScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const selectMode = params?.selectMode ?? false;
  const templateId = params?.templateId;
  const programDayId = params?.programDayId;
  const addExercise = useActiveWorkoutStore(state => state.addExercise);
  const unitPref = useUnitPreference();
  const { data: template } = useWorkoutTemplate(templateId);
  const addTemplateExercise = useAddTemplateExercise();
  const { data: programDay } = useProgramDay(programDayId);
  const addProgramExercise = useAddProgramExercise();
  const [search, setSearch] = useState('');
  const { data: exercises, isLoading } = useExercises(search);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header
        title="Exercise Library"
        right={
          <IconButton
            name="plus"
            variant="ghost"
            accessibilityLabel="Add your own exercise"
            onPress={() => navigation.navigate('AddExercise', { selectMode, templateId, programDayId })}
          />
        }
      />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg, gap: theme.spacing.md, flex: 1 }}>
        <TextField
          placeholder="Search exercises…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />

        {isLoading ? (
          <LoadingState />
        ) : (
          <FlatList
            data={exercises ?? []}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: theme.colors.border.subtle }} />
            )}
            renderItem={({ item }) => (
              <ListRow
                title={item.name}
                subtitle={`${formatEnumLabel(item.category)} · ${formatEnumLabel(item.equipment)} · ${formatEnumLabel(item.primary_muscle)}`}
                showChevron={!selectMode && !templateId && !programDayId}
                onPress={() => {
                  if (templateId) {
                    const nextIndex = template?.workout_template_exercises.length ?? 0;
                    addTemplateExercise.mutate({
                      workout_template_id: templateId,
                      exercise_id: item.id,
                      order_index: nextIndex,
                      target_sets: 3,
                    });
                    navigation.goBack();
                  } else if (programDayId) {
                    const nextIndex = programDay?.program_exercises.length ?? 0;
                    addProgramExercise.mutate({
                      program_day_id: programDayId,
                      exercise_id: item.id,
                      order_index: nextIndex,
                      target_sets: 3,
                    });
                    navigation.goBack();
                  } else if (selectMode) {
                    addExercise({
                      exerciseId: item.id,
                      exerciseName: item.name,
                      metric: item.default_metric ?? (unitPref === 'lb' ? 'weight_lb' : 'weight_kg'),
                    });
                    navigation.goBack();
                  } else {
                    navigation.navigate('ExerciseDetail', { exerciseId: item.id });
                  }
                }}
              />
            )}
            ListEmptyComponent={
              <EmptyState icon="search" title="No matches" description={`No exercises match "${search}".`} />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
