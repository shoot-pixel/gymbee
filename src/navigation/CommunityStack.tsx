import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from './types';
import { LeaderboardScreen } from '../screens/community/LeaderboardScreen';
import { CommunityPostsScreen } from '../screens/community/CommunityPostsScreen';
import { MyPostsScreen } from '../screens/community/MyPostsScreen';
import { FriendProfileScreen } from '../screens/community/FriendProfileScreen';
import { PostDetailScreen } from '../screens/community/PostDetailScreen';
import { UploadPhotoPostScreen } from '../screens/community/UploadPhotoPostScreen';
import { FriendsListScreen } from '../screens/community/FriendsListScreen';

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export function CommunityStack() {
  return (
    <Stack.Navigator initialRouteName="Posts" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Posts" component={CommunityPostsScreen} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Stack.Screen name="MyPosts" component={MyPostsScreen} />
      <Stack.Screen name="FriendProfile" component={FriendProfileScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="UploadPhotoPost" component={UploadPhotoPostScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="FriendsList" component={FriendsListScreen} />
    </Stack.Navigator>
  );
}
