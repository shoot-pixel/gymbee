import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, TextField, Button, Header } from '../../components/core';
import { useAuth } from '../../hooks/useAuth';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const theme = useTheme();
  const { loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    const result = await signIn(email.trim(), password);
    if (result.error) setError(result.error);
    // On success, supabase.auth.onAuthStateChange (wired in Milestone 2's
    // authStore integration) flips RootNavigator over to Onboarding/MainTabs.
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
        <Header title="" />
        <View style={{ flex: 1, padding: theme.spacing.xl, paddingTop: 0, justifyContent: 'center', gap: theme.spacing.lg }}>
          <View>
            <Text variant="title">Welcome back</Text>
            <Text variant="body" color="secondary">
              Sign in to keep training.
            </Text>
          </View>

          <View style={{ gap: theme.spacing.md }}>
            <TextField
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
            />
            {error ? (
              <Text variant="caption" style={{ color: theme.colors.semantic.danger }}>
                {error}
              </Text>
            ) : null}
          </View>

          <Button
            label="Sign In"
            onPress={onSubmit}
            loading={loading}
            disabled={!email || !password}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" color="secondary" onPress={() => navigation.navigate('ForgotPassword')}>
              Forgot password?
            </Text>
            <Text variant="caption" color="secondary" onPress={() => navigation.navigate('SignUp')}>
              Create an account
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
