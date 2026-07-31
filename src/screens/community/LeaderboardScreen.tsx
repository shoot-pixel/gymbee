import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Header, Text, Card, ListRow, EmptyState, LoadingState, PremiumBadge } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useLeaderboard } from '../../services/api/queries/community';
import { useLiveFriendWorkouts } from '../../services/api/queries/liveWorkouts';
import { useUnitPreference } from '../../hooks/useUnitPreference';
import { formatVolume, unitLabel } from '../../utils/units';
import type { CommunityStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;

export function LeaderboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore(state => state.userId);
  const unitPref = useUnitPreference();

  const { data: leaderboard, isLoading, refetch } = useLeaderboard(userId);
  const { data: liveWorkouts } = useLiveFriendWorkouts(userId);
  const liveFriendIds = useMemo(() => new Set((liveWorkouts ?? []).map(w => w.friend.id)), [liveWorkouts]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <Header title="Leaderboard" />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.xs }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent.primary} />}
      >
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
                title={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                    <Text variant="body">{entry.isSelf ? 'You' : (entry.display_name ?? 'Athlete')}</Text>
                    {liveFriendIds.has(entry.id) ? (
                      <View
                        accessibilityLabel="Live now"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: theme.colors.accent.primary,
                        }}
                      />
                    ) : null}
                    {entry.is_premium ? <PremiumBadge /> : null}
                  </View>
                }
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
