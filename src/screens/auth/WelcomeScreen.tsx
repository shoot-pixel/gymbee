import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Button } from '../../components/core';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const theme = useTheme();
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: theme.colors.bg.base,
        padding: theme.spacing.xl,
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: theme.spacing.sm }}>
        <Text variant="numeralLg" style={{ fontSize: 40 }}>
          🐝 GymBee
        </Text>
        <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
          AI-coached strength training, built around you.
        </Text>
      </View>
      <View style={{ gap: theme.spacing.md }}>
        <Button label="Sign In" onPress={() => navigation.navigate('SignIn')} />
        <Button
          label="Create Account"
          variant="secondary"
          onPress={() => navigation.navigate('SignUp')}
        />
      </View>
    </SafeAreaView>
  );
}
