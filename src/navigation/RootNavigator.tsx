import React from 'react';
import { NavigationContainer, DarkTheme, Theme as NavTheme, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import { LoadingScreen } from '../screens/LoadingScreen';
import { AuthStack } from './AuthStack';
import { OnboardingStack } from './OnboardingStack';
import { AppShell } from './AppShell';
import { ProfileStack } from './ProfileStack';
import { ChatScreen } from '../screens/chat/ChatScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Only the WHOOP connect callback uses this today — soset://whoop-callback
// (with optional ?status=success|error&message=...) routes straight to the
// Integrations screen. See supabase/functions/whoop-oauth-callback for the
// page that sends the user back here, and Info.plist / AndroidManifest.xml
// for where the `soset` scheme itself is registered.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['soset://'],
  config: {
    screens: {
      Profile: {
        screens: {
          Integrations: 'whoop-callback',
        },
      },
    },
  },
};

export function RootNavigator() {
  const theme = useTheme();
  const { hydrated, isAuthenticated, onboardingCompleted } = useAuthStore();

  if (!hydrated) {
    return <LoadingScreen />;
  }

  const navTheme: NavTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: theme.colors.bg.base,
      card: theme.colors.bg.surface,
      border: theme.colors.border.default,
      primary: theme.colors.accent.primary,
      text: theme.colors.text.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : !onboardingCompleted ? (
          <Stack.Screen name="Onboarding" component={OnboardingStack} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={AppShell} />
            <Stack.Screen name="Profile" component={ProfileStack} />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              // 'fullScreenModal' rather than the default 'modal' (an iOS page
              // sheet) — page sheets are presented in a way that can throw off
              // KeyboardAvoidingView's height math, leaving the message input
              // covered by the keyboard. See ChatFab/ChatScreen for the rest
              // of the keyboard-handling fix.
              options={{ presentation: 'fullScreenModal', headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
