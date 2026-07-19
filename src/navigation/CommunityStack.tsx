import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from './types';
import { LeaderboardScreen } from '../screens/community/LeaderboardScreen';
import { ActivityFeedScreen } from '../screens/community/ActivityFeedScreen';
import { FriendProfileScreen } from '../screens/community/FriendProfileScreen';

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export function CommunityStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Stack.Screen name="ActivityFeed" component={ActivityFeedScreen} />
      <Stack.Screen name="FriendProfile" component={FriendProfileScreen} />
    </Stack.Navigator>
  );
}
