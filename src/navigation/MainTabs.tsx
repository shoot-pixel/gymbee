import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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

export function MainTabs() {
  const theme = useTheme();

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
          height: 84,
          paddingTop: 10,
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
        options={{ tabBarLabel: 'Progress' }}
      />
      <Tab.Screen
        name="CommunityTab"
        component={CommunityStack}
        options={{ tabBarLabel: 'Community' }}
      />
    </Tab.Navigator>
  );
}
