import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Header, Button, ListRow, LoadingState, EmptyState } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useWorkoutTemplates } from '../../services/api/queries/workoutTemplates';
import { useAssignWeeklySchedule } from '../../services/api/queries/weeklySchedule';
import type { ProgramsStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ProgramsStackParamList>;
type Route = RouteProp<ProgramsStackParamList, 'AssignTrainingDay'>;

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** "Set up a specific day" — assigns an existing workout template to a
 * weekday, recurring indefinitely (no week 1/week 2 framing). Deliberately
 * doesn't support creating a brand-new template inline: that's the Workout
 * Library's job (TemplateEditorScreen), reachable from its own "+" — this
 * screen just picks from what already exists there, keeping it
 * self-contained rather than reaching into LibraryScreen's own stateful
 * pick/schedule flow for a different purpose. */
export function AssignTrainingDayScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const userId = useAuthStore(state => state.userId);
  const { data: templates, isLoading } = useWorkoutTemplates(userId);
  const assignWeeklySchedule = useAssignWeeklySchedule();

  const [dayOfWeek, setDayOfWeek] = useState<number | null>(params?.initialDayOfWeek ?? null);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const canAssign = dayOfWeek != null && templateId != null;

  const onAssign = async () => {
    if (!userId || dayOfWeek == null || templateId == null) return;
    try {
      await assignWeeklySchedule.mutateAsync({ userId, dayOfWeek, workoutTemplateId: templateId });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not assign training day', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header title="Add a Training Day" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" color="secondary">
            DAY OF WEEK
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {WEEKDAY_LABELS.map((label, index) => {
              const selected = dayOfWeek === index;
              return (
                <Pressable
                  key={index}
                  onPress={() => setDayOfWeek(index)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: theme.radii.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? theme.colors.accent.primary : theme.colors.bg.surface,
                    borderWidth: 1,
                    borderColor: selected ? theme.colors.accent.primary : theme.colors.border.subtle,
                  }}
                >
                  <Text variant="body" color={selected ? 'onAccent' : 'primary'} style={{ fontWeight: '700' }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" color="secondary">
            WORKOUT
          </Text>
          {isLoading ? (
            <LoadingState fill={false} />
          ) : !templates || templates.length === 0 ? (
            <EmptyState
              icon="dumbbell"
              title="No saved workouts yet"
              description="Create one in your Workout Library first, then come back here."
            />
          ) : (
            <View style={{ gap: theme.spacing.xs }}>
              {templates.map((template, index) => (
                <ListRow
                  key={template.id}
                  title={template.name}
                  subtitle={`${template.workout_template_exercises.length} exercises`}
                  trailing={templateId === template.id ? <Text style={{ color: theme.colors.accent.primary }}>✓</Text> : undefined}
                  onPress={() => setTemplateId(template.id)}
                  style={
                    index > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle } : undefined
                  }
                />
              ))}
            </View>
          )}
          <Text variant="caption" color="tertiary">
            Don't see it? Create it in your Workout Library, then come back here.
          </Text>
        </View>

        <Button label="Assign" onPress={onAssign} disabled={!canAssign} loading={assignWeeklySchedule.isPending} />
      </ScrollView>
    </SafeAreaView>
  );
}
