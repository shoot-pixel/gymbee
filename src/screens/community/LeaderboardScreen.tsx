import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Header, Text, Card, ListRow, EmptyState, LoadingState } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useLeaderboard } from '../../services/api/queries/community';
import { useUnitPreference } from '../../hooks/useUnitPreference';
import { formatVolume, unitLabel } from '../../utils/units';
import type { CommunityStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;

export function LeaderboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore(state => state.userId);
  const unitPref = useUnitPreference();

  const { data: leaderboard, isLoading } = useLeaderboard(userId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <Header title="Leaderboard" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.xs }}>
        {isLoading ? (
          <LoadingState fill={false} />
        ) : leaderboard?.length === 1 ? (
          <EmptyState
            icon="users"
            title="No friends yet"
            description="Search for athletes from the Community tab to add friends and see how you stack up."
          />
        ) : (
          leaderboard?.map((entry, index) => (
            <Card
              key={entry.id}
              variant={entry.isSelf ? 'flat' : 'subtle'}
              style={{
                padding: theme.spacing.sm,
                borderColor: entry.isSelf ? theme.colors.accent.primary : theme.colors.border.subtle,
              }}
            >
              <ListRow
                title={entry.isSelf ? 'You' : (entry.display_name ?? 'Athlete')}
                subtitle={`${entry.workoutsThisMonth} workout${entry.workoutsThisMonth === 1 ? '' : 's'} this month`}
                leading={
                  <Text variant="subtitle" color="secondary" style={{ width: 24 }}>
                    {index + 1}
                  </Text>
                }
                trailing={
                  <Text variant="body">
                    {formatVolume(entry.volumeThisMonth, unitPref)} {unitLabel(unitPref)}
                  </Text>
                }
                onPress={entry.isSelf ? undefined : () => navigation.navigate('FriendProfile', { userId: entry.id })}
                style={{ paddingVertical: 0 }}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
