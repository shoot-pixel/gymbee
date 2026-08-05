import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MainTabParamList } from './types';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, Badge, type IconName } from '../components/core';
import { useAuthStore } from '../store/authStore';
import { useProfile } from '../services/api/queries/profiles';
import { useNotificationBadges } from '../services/api/queries/notifications';
import { TodayStack } from './TodayStack';
import { ProgramsStack } from './ProgramsStack';
import { LogStack } from './LogStack';
import { ProgressStack } from './ProgressStack';
import { CommunityStack } from './CommunityStack';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, IconName> = {
  TodayTab: 'home',
  ProgramsTab: 'calendar',
  LogTab: 'plusCircle',
  ProgressTab: 'trendingUp',
  CommunityTab: 'messageCircle',
};

/** Content height of the tab bar excluding the bottom safe-area inset —
 * the actual on-screen height is this plus `insets.bottom`. Exported so
 * ChatDragHandle/PostFab can sit a consistent distance above (or flush
 * against) the bar on every device instead of using a magic-number offset
 * that only happened to clear it on some screen sizes. */
export const TAB_BAR_CONTENT_HEIGHT = 56;

type MainTabsProps = {
  /** Fires with the newly-focused tab's route name, and the name of whatever
   * screen is focused within that tab's own nested stack (e.g. 'Posts',
   * 'Conversation'), on every navigation change — lets AppShell decide which
   * FAB to show (chat coach everywhere except the Social tab's own feed,
   * which gets its own "new post" FAB, and nowhere on top of a full-screen
   * flow like a DM conversation) without this navigator needing to know
   * anything about FABs itself. */
  onActiveTabChange?: (tabName: keyof MainTabParamList, focusedScreenName?: string) => void;
};

export function MainTabs({ onActiveTabChange }: MainTabsProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore(state => state.userId);
  const { data: profile } = useProfile(userId);
  const { hasAny: hasSocialNotification } = useNotificationBadges(userId, {
    messagesSeenAt: profile?.messages_seen_at,
    activitySeenAt: profile?.activity_seen_at,
  });

  return (
    <Tab.Navigator
      screenListeners={{
        state: e => {
          const state = e.data.state as
            | { routes: { name: string; state?: unknown; params?: unknown }[]; index: number }
            | undefined;
          const activeTabRoute = state?.routes[state.index];
          if (!activeTabRoute) return;
          const focusedScreenName = getFocusedRouteNameFromRoute(
            activeTabRoute as Parameters<typeof getFocusedRouteNameFromRoute>[0],
          );
          onActiveTabChange?.(activeTabRoute.name as keyof MainTabParamList, focusedScreenName);
        },
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent.primary,
        tabBarInactiveTintColor: theme.colors.text.primary,
        tabBarStyle: {
          backgroundColor: theme.colors.bg.surface,
          borderTopColor: theme.colors.border.subtle,
          borderTopWidth: 1,
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
          paddingHorizontal: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const, marginTop: 2 },
        tabBarIcon: ({ color, focused }) => (
          <View>
            <Icon
              name={TAB_ICONS[route.name as keyof MainTabParamList]}
              size="md"
              color={color}
              strokeWidth={focused ? 2.25 : 1.75}
            />
            {route.name === 'CommunityTab' ? <Badge visible={hasSocialNotification} /> : null}
          </View>
        ),
      })}
    >
      <Tab.Screen name="TodayTab" component={TodayStack} options={{ tabBarLabel: 'Today' }} />
      <Tab.Screen
        name="ProgramsTab"
        component={ProgramsStack}
        options={{ tabBarLabel: 'Training' }}
      />
      <Tab.Screen name="LogTab" component={LogStack} options={{ tabBarLabel: 'Log' }} />
      <Tab.Screen
        name="ProgressTab"
        component={ProgressStack}
        options={{ tabBarLabel: 'Stats' }}
      />
      <Tab.Screen
        name="CommunityTab"
        component={CommunityStack}
        options={{ tabBarLabel: 'Social' }}
      />
    </Tab.Navigator>
  );
}
