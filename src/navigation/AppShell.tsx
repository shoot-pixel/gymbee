import React, { useState } from 'react';
import { View } from 'react-native';
import { MainTabs } from './MainTabs';
import { ChatFab } from './ChatFab';
import { PostFab } from './PostFab';
import type { MainTabParamList } from './types';

/** Screens within the Community tab's own stack that already have a
 * full-screen input or action of their own (a DM's send button, in
 * particular) — a floating FAB on top of those just gets in the way, so
 * neither FAB shows there. */
const COMMUNITY_SCREENS_WITHOUT_FAB = new Set(['Conversation']);

/**
 * Main tabs + one globally-reachable FAB layered on top — the AI coach chat
 * everywhere, except the Social tab's own feed, where posting a photo is the
 * more useful one-tap action, and except a couple of Social-tab screens
 * (e.g. a DM conversation) that already have their own bottom action and
 * don't need any FAB layered over them.
 */
export function AppShell() {
  const [activeTab, setActiveTab] = useState<keyof MainTabParamList>('TodayTab');
  const [focusedScreen, setFocusedScreen] = useState<string | undefined>(undefined);

  const handleActiveTabChange = (tabName: keyof MainTabParamList, focusedScreenName?: string) => {
    setActiveTab(tabName);
    setFocusedScreen(focusedScreenName);
  };

  const showPostFab = activeTab === 'CommunityTab' && (focusedScreen === undefined || focusedScreen === 'Posts');
  const hideFab = activeTab === 'CommunityTab' && focusedScreen != null && COMMUNITY_SCREENS_WITHOUT_FAB.has(focusedScreen);

  return (
    <View style={{ flex: 1 }}>
      <MainTabs onActiveTabChange={handleActiveTabChange} />
      {hideFab ? null : showPostFab ? <PostFab /> : <ChatFab />}
    </View>
  );
}
