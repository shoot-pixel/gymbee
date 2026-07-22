import React from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Header, LoadingState } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useProfile, useUpdateProfile } from '../../services/api/queries/profiles';
import type { ProfileStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Privacy'>;

function PrivacyToggleRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Text variant="body">{title}</Text>
        <Text variant="caption" color="secondary">
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.border.default, true: theme.colors.accent.primary }}
        thumbColor={theme.colors.text.onAccent}
        accessibilityLabel={title}
      />
    </View>
  );
}

export function PrivacyScreen(_props: Props) {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const { data: profile, isLoading } = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);

  const hideStats = profile?.hide_stats_from_friends ?? false;
  const hidePhotos = profile?.hide_photos_from_friends ?? false;
  const isFullyPrivate = hideStats && hidePhotos;

  const setFullyPrivate = (value: boolean) => {
    updateProfile.mutate({ hide_stats_from_friends: value, hide_photos_from_friends: value });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header title="Privacy" />

      {isLoading ? (
        <LoadingState />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.xl }}
        >
          <Card variant="elevated" style={{ gap: 0 }}>
            <PrivacyToggleRow
              title="Fully private"
              description="Turns both settings below on at once — friends won't see your stats or photos."
              value={isFullyPrivate}
              onChange={setFullyPrivate}
            />
          </Card>

          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" color="secondary">
              INDIVIDUAL SETTINGS
            </Text>
            <Card variant="elevated" style={{ gap: 0 }}>
              <PrivacyToggleRow
                title="Hide stats from friends"
                description="Friends won't see your monthly volume or workout count on your profile or the leaderboard."
                value={hideStats}
                onChange={value => updateProfile.mutate({ hide_stats_from_friends: value })}
              />
              <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border.subtle }}>
                <PrivacyToggleRow
                  title="Hide photos from friends"
                  description="Posts you've marked “Friends” become visible only to you — private posts are unaffected."
                  value={hidePhotos}
                  onChange={value => updateProfile.mutate({ hide_photos_from_friends: value })}
                />
              </View>
            </Card>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
