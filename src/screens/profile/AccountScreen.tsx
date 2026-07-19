import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, TextField, Button, Card } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useProfile, useUpdateProfile } from '../../services/api/queries/profiles';
import { useAuth } from '../../hooks/useAuth';
import { deleteAccount } from '../../services/api/edgeFunctions';
import { supabase } from '../../services/api/supabaseClient';
import type { ProfileStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Account'>;

export function AccountScreen({ navigation }: Props) {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const { data: profile, isLoading } = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);
  const { signOut, updatePassword, loading: authLoading } = useAuth();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const nameValue = displayName ?? profile?.display_name ?? '';
  const nameChanged = displayName !== null && displayName !== (profile?.display_name ?? '');

  const onSaveName = () => {
    if (displayName === null) return;
    updateProfile.mutate({ display_name: displayName });
  };

  const onSavePassword = async () => {
    setPasswordError(null);
    setPasswordSaved(false);
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }
    const result = await updatePassword(newPassword);
    if (result.error) {
      setPasswordError(result.error);
      return;
    }
    setNewPassword('');
    setPasswordSaved(true);
  };

  const onDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account, programs, and workout history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              // The deleted user's JWT is now orphaned server-side; clear it
              // locally so AuthProvider/RootNavigator fall back to the Auth
              // stack instead of surfacing stale-session errors.
              await supabase.auth.signOut();
            } catch (err) {
              setDeleting(false);
              Alert.alert(
                'Could not delete account',
                err instanceof Error ? err.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.lg,
        }}
      >
        <Text
          variant="subtitle"
          color="secondary"
          onPress={() => navigation.goBack()}
          style={{ fontSize: 22 }}
        >
          ←
        </Text>
        <Text variant="title">Account</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.colors.accent.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: theme.spacing.lg,
            paddingTop: 0,
            gap: theme.spacing.xl,
          }}
        >
          <View style={{ gap: theme.spacing.md }}>
            <TextField
              label="Display Name"
              value={nameValue}
              onChangeText={setDisplayName}
              placeholder="Your name"
            />
            <Text variant="label" color="secondary">
              EMAIL
            </Text>
            <Text variant="body" color="secondary">
              {profile?.email}
            </Text>
            <Button
              label="Save Name"
              variant="secondary"
              onPress={onSaveName}
              disabled={!nameChanged}
              loading={updateProfile.isPending}
            />
          </View>

          <View style={{ gap: theme.spacing.md }}>
            <Text variant="label" color="secondary">
              CHANGE PASSWORD
            </Text>
            <TextField
              label="New Password"
              secureTextEntry
              autoComplete="password-new"
              value={newPassword}
              onChangeText={text => {
                setNewPassword(text);
                setPasswordSaved(false);
              }}
              placeholder="At least 6 characters"
            />
            {passwordError ? (
              <Text variant="caption" style={{ color: theme.colors.semantic.danger }}>
                {passwordError}
              </Text>
            ) : passwordSaved ? (
              <Text variant="caption" style={{ color: theme.colors.semantic.success }}>
                Password updated.
              </Text>
            ) : null}
            <Button
              label="Update Password"
              variant="secondary"
              onPress={onSavePassword}
              disabled={!newPassword}
              loading={authLoading}
            />
          </View>

          <Button label="Sign Out" variant="ghost" onPress={() => signOut()} />

          <Card style={{ gap: theme.spacing.sm, borderColor: theme.colors.semantic.danger }}>
            <Text variant="subtitle" style={{ color: theme.colors.semantic.danger }}>
              Danger Zone
            </Text>
            <Text variant="caption" color="secondary">
              Permanently delete your account and all of your data.
            </Text>
            <Button
              label="Delete Account"
              variant="ghost"
              onPress={onDeleteAccount}
              loading={deleting}
              style={{ borderColor: theme.colors.semantic.danger }}
            />
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
