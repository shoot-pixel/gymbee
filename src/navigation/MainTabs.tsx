import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MainTabParamList } from './types';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from '../components/core';
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
  CommunityTab: 'trophy',
};

/** Content height of the tab bar excluding the bottom safe-area inset —
 * the actual on-screen height is this plus `insets.bottom`. Exported so
 * ChatFab can sit a consistent distance above the bar on every device
 * instead of using a magic-number offset that only happened to clear it
 * on some screen sizes. */
export const TAB_BAR_CONTENT_HEIGHT = 56;

export function MainTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
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
          <Icon
            name={TAB_ICONS[route.name as keyof MainTabParamList]}
            size="md"
            color={color}
            strokeWidth={focused ? 2.25 : 1.75}
          />
        ),
      })}
    >
      <Tab.Screen name="TodayTab" component={TodayStack} options={{ tabBarLabel: 'Today' }} />
      <Tab.Screen
        name="ProgramsTab"
        component={ProgramsStack}
        options={{ tabBarLabel: 'Programs' }}
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
        options={{ tabBarLabel: 'Community' }}
      />
    </Tab.Navigator>
  );
}
