import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useProfile } from '../../services/api/queries/profiles';
import { useAuth } from '../../hooks/useAuth';
import type { ProfileStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const { data: profile, isLoading } = useProfile(userId);
  const { signOut, loading: signingOut } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <View style={{ flex: 1, padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Text
            variant="subtitle"
            color="secondary"
            onPress={() => navigation.goBack()}
            style={{ fontSize: 22 }}
          >
            ←
          </Text>
          <Text variant="title">Profile</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={theme.colors.accent.primary} />
        ) : (
          <Card style={{ gap: theme.spacing.sm }}>
            <Text variant="subtitle">{profile?.display_name ?? 'Athlete'}</Text>
            <Text variant="body" color="secondary">
              {profile?.email}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.sm }}>
              <View>
                <Text variant="label" color="secondary">
                  EXPERIENCE
                </Text>
                <Text variant="body">{profile?.experience_level ?? '—'}</Text>
              </View>
              <View>
                <Text variant="label" color="secondary">
                  GOAL
                </Text>
                <Text variant="body">{profile?.goal ?? '—'}</Text>
              </View>
            </View>
          </Card>
        )}

        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label="Settings"
            variant="secondary"
            onPress={() => navigation.navigate('Settings')}
          />
          <Button
            label="Account"
            variant="secondary"
            onPress={() => navigation.navigate('Account')}
          />
        </View>

        <View style={{ flex: 1 }} />

        <Button
          label="Sign Out"
          variant="ghost"
          loading={signingOut}
          onPress={() => signOut()}
        />
      </View>
    </SafeAreaView>
  );
}
