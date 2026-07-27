import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button, Header, ListRow, LoadingState, Avatar } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useProfile } from '../../services/api/queries/profiles';
import { useAuth } from '../../hooks/useAuth';
import type { ProfileStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

/** Account/settings hub — the social side of a profile (avatar upload, bio,
 * followers/following, posts) lives in the Community tab's FriendProfile
 * screen (self and friends both render there) rather than here. */
export function ProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const { data: profile, isLoading } = useProfile(userId);
  const { signOut, loading: signingOut } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header title="Profile" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.lg }}>
        {isLoading ? (
          <LoadingState fill={false} />
        ) : (
          <Card variant="elevated" style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Avatar uri={profile?.avatar_url} size={56} />
              <View style={{ flex: 1 }}>
                <Text variant="subtitle">{profile?.display_name ?? 'Athlete'}</Text>
                <Text variant="body" color="secondary">
                  {profile?.email}
                </Text>
              </View>
            </View>
          </Card>
        )}

        <Card variant="elevated" style={{ gap: 0 }}>
          <ListRow
            title="Settings"
            icon="settings"
            showChevron
            onPress={() => navigation.navigate('Settings')}
          />
          <ListRow
            title="Account"
            icon="user"
            showChevron
            onPress={() => navigation.navigate('Account')}
            style={{ borderTopWidth: 1, borderTopColor: theme.colors.border.subtle }}
          />
        </Card>

        <Button
          label="Sign Out"
          variant="ghost"
          icon="logOut"
          loading={signingOut}
          onPress={() => signOut()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
