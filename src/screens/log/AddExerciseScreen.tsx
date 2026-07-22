import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, TextField, Button, Header, SegmentedControl } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useCreateExercise } from '../../services/api/queries/exercises';
import type { ExerciseDefaultMetric } from '../../types/database';
import type { LogStackParamList, ProgramsStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<LogStackParamList | ProgramsStackParamList>;

const METRIC_OPTIONS: { value: ExerciseDefaultMetric; label: string }[] = [
  { value: 'weight_kg', label: 'Weight' },
  { value: 'reps', label: 'Reps only' },
  { value: 'time', label: 'Time' },
];

export function AddExerciseScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore(state => state.userId);
  const createExercise = useCreateExercise(userId);

  const [name, setName] = useState('');
  const [metric, setMetric] = useState<ExerciseDefaultMetric>('weight_kg');
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await createExercise.mutateAsync({ name: trimmed, defaultMetric: metric });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that exercise. Try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header title="Add Exercise" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, padding: theme.spacing.lg, gap: theme.spacing.lg }}>
          <TextField
            label="Title"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sled Push"
            returnKeyType="done"
          />

          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" color="secondary">
              UNIT OF MEASURE
            </Text>
            <SegmentedControl options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
          </View>

          {error ? (
            <Text variant="caption" style={{ color: theme.colors.semantic.danger }}>
              {error}
            </Text>
          ) : null}

          <View style={{ flex: 1 }} />

          <Button
            label="Add Exercise"
            onPress={onSave}
            disabled={!name.trim()}
            loading={createExercise.isPending}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
