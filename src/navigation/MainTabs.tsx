import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import type { MainTabParamList } from './types';
import { useTheme } from '../theme/ThemeProvider';
import { TodayStack } from './TodayStack';
import { ProgramsStack } from './ProgramsStack';
import { LogStack } from './LogStack';
import { ProgressStack } from './ProgressStack';
import { CommunityStack } from './CommunityStack';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_GLYPHS: Record<keyof MainTabParamList, string> = {
  TodayTab: '🏠',
  ProgramsTab: '📅',
  LogTab: '➕',
  ProgressTab: '📈',
  CommunityTab: '🏆',
};

export function MainTabs() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent.primary,
        tabBarInactiveTintColor: theme.colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.bg.surface,
          borderTopColor: theme.colors.border.default,
          height: 84,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' as const },
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 22, color }}>
            {TAB_GLYPHS[route.name as keyof MainTabParamList]}
          </Text>
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
