import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Button, TextField, StepProgress } from '../../components/core';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAuthStore } from '../../store/authStore';
import { useUpdateProfile } from '../../services/api/queries/profiles';
import { useLogBodyMetric } from '../../services/api/queries/bodyMetrics';
import { lbToKg, feetInchesToCm } from '../../utils/units';
import type { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Injuries'>;

export function InjuriesScreen(_props: Props) {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const setSession = useAuthStore(state => state.setSession);
  const {
    sex,
    heightFeet,
    heightInches,
    weightLb,
    goal,
    experienceLevel,
    daysPerWeek,
    equipment,
    injuriesNotes,
    setInjuriesNotes,
    reset,
  } = useOnboardingStore();
  const updateProfile = useUpdateProfile(userId);
  const logBodyMetric = useLogBodyMetric(userId);
  const [error, setError] = useState<string | null>(null);

  // No program gets created here — onboarding just saves the athlete's
  // profile fields and finishes. Generating a program (with AI, or building
  // one manually) is now a choice made later from the Programs tab.
  const onFinish = async () => {
    if (!userId || !goal || !experienceLevel || !daysPerWeek || sex == null || heightFeet == null || heightInches == null || weightLb == null) {
      setError('Missing onboarding answers — please go back and complete every step.');
      return;
    }
    setError(null);
    try {
      await Promise.all([
        updateProfile.mutateAsync({
          goal,
          experience_level: experienceLevel,
          days_per_week: daysPerWeek,
          equipment_access: equipment,
          injuries_notes: injuriesNotes || null,
          sex,
          height_cm: Math.round(feetInchesToCm(heightFeet, heightInches) * 10) / 10,
          onboarding_completed: true,
        }),
        // Starting weight isn't a profiles column — it's the first entry in
        // body_metrics, the same table (and "latest entry wins" convention)
        // every later weight update and the cardio calorie estimate already
        // read from, so a later re-weigh is picked up automatically.
        logBodyMetric.mutateAsync({ weightKg: lbToKg(weightLb) }),
      ]);
      reset();
      setSession({ userId, onboardingCompleted: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile. Please try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? theme.spacing.xl : 0}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            padding: theme.spacing.xl,
            gap: theme.spacing.lg,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={{ gap: theme.spacing.md }}>
            <StepProgress step={6} total={6} />
            <View>
              <Text variant="title">Any injuries or limitations?</Text>
              <Text variant="body" color="secondary">
                Optional — your coach will work around these.
              </Text>
            </View>
          </View>

          <TextField
            value={injuriesNotes}
            onChangeText={setInjuriesNotes}
            placeholder="e.g. cranky left shoulder, avoid overhead pressing"
            multiline
            numberOfLines={4}
            blurOnSubmit
            returnKeyType="done"
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />

          {error ? (
            <Text variant="caption" style={{ color: theme.colors.semantic.danger }}>
              {error}
            </Text>
          ) : null}

          <View style={{ flex: 1, minHeight: theme.spacing.xl }} />

          <Button label="Finish" onPress={onFinish} loading={updateProfile.isPending || logBodyMetric.isPending} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
