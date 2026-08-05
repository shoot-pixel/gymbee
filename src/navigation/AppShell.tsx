import React, { useState } from 'react';
import { View } from 'react-native';
import { MainTabs } from './MainTabs';
import { ChatDragHandle } from './ChatDragHandle';
import { PostFab } from './PostFab';
import type { MainTabParamList } from './types';

/**
 * Main tabs + one globally-reachable AI-coach affordance layered on top —
 * everywhere except the Social tab, which never gets it (it would sit on
 * top of the tab's own feeds, comment bars, and message composers). The
 * Social tab's own feed instead gets the "+" post FAB in its place; every
 * other Social-tab screen gets neither.
 */
export function AppShell() {
  const [activeTab, setActiveTab] = useState<keyof MainTabParamList>('TodayTab');
  const [focusedScreen, setFocusedScreen] = useState<string | undefined>(undefined);

  const handleActiveTabChange = (tabName: keyof MainTabParamList, focusedScreenName?: string) => {
    setActiveTab(tabName);
    setFocusedScreen(focusedScreenName);
  };

  const isCommunityTab = activeTab === 'CommunityTab';
  const showPostFab = isCommunityTab && (focusedScreen === undefined || focusedScreen === 'Posts');
  const hideFab = isCommunityTab && !showPostFab;

  return (
    <View style={{ flex: 1 }}>
      <MainTabs onActiveTabChange={handleActiveTabChange} />
      {hideFab ? null : showPostFab ? <PostFab /> : <ChatDragHandle />}
    </View>
  );
}
