import React from 'react';
import { View } from 'react-native';
import { MainTabs } from './MainTabs';
import { ChatFab } from './ChatFab';

/** Main tabs + the globally-reachable chat FAB layered on top. */
export function AppShell() {
  return (
    <View style={{ flex: 1 }}>
      <MainTabs />
      <ChatFab />
    </View>
  );
}
