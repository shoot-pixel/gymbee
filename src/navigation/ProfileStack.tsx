import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './types';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { SettingsScreen } from '../screens/profile/SettingsScreen';
import { AccountScreen } from '../screens/profile/AccountScreen';
import { PrivacyScreen } from '../screens/profile/PrivacyScreen';
import { BlockedUsersScreen } from '../screens/profile/BlockedUsersScreen';
import { IntegrationsScreen } from '../screens/profile/IntegrationsScreen';
import { PostDetailScreen } from '../screens/community/PostDetailScreen';
import { FriendsListScreen } from '../screens/community/FriendsListScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="Integrations" component={IntegrationsScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="FriendsList" component={FriendsListScreen} />
    </Stack.Navigator>
  );
}
