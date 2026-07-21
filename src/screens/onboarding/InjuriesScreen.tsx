import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Button, TextField, StepProgress } from '../../components/core';
import { useOnboardingStore } from '../../store/onboardingStore';
import type { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Injuries'>;

export function InjuriesScreen({ navigation }: Props) {
  const theme = useTheme();
  const injuriesNotes = useOnboardingStore(state => state.injuriesNotes);
  const setInjuriesNotes = useOnboardingStore(state => state.setInjuriesNotes);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.bg.base, padding: theme.spacing.xl, gap: theme.spacing.lg }}
    >
      <View style={{ gap: theme.spacing.md }}>
        <StepProgress step={5} total={5} />
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
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />

      <View style={{ flex: 1 }} />

      <Button label="Generate My Program" onPress={() => navigation.navigate('GeneratingProgram')} />
    </SafeAreaView>
  );
}
