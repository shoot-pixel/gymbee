import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, TextField, Button, Header } from '../../components/core';
import { useAuth } from '../../hooks/useAuth';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props) {
  const theme = useTheme();
  const { loading, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const result = await signUp(email.trim(), password);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (!result.hasSession) {
      // No confirmation step is expected — the project should have email
      // confirmation disabled (see supabase/config.toml's [auth.email]
      // enable_confirmations). Landing here means that setting hasn't been
      // applied to this Supabase project yet, so surface it rather than
      // leaving the user stuck on this screen with no signal why.
      setError('Account created, but sign-in isn’t active yet. Please try signing in — if that fails, email confirmation needs to be disabled for this project.');
      return;
    }
    // On success, supabase.auth.onAuthStateChange (wired in AuthProvider)
    // flips RootNavigator over to Onboarding — no explicit navigation here.
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
            <Text variant="title">Create your account</Text>
            <Text variant="body" color="secondary">
              SoSet will build your first program right after this.
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
              autoComplete="password-new"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
            />
            <TextField
              label="Confirm Password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
            />
            {error ? (
              <Text variant="caption" style={{ color: theme.colors.semantic.danger }}>
                {error}
              </Text>
            ) : null}
          </View>

          <Button
            label="Create Account"
            onPress={onSubmit}
            loading={loading}
            disabled={!email || !password || !confirmPassword}
          />

          <Text
            variant="caption"
            color="secondary"
            style={{ textAlign: 'center' }}
            onPress={() => navigation.navigate('SignIn')}
          >
            Already have an account? Sign in
          </Text>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
