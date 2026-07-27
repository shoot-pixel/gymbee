import React, { useEffect, useState } from 'react';
import { NavigationContainer, DarkTheme, Theme as NavTheme, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import { useAppBootstrap } from '../hooks/useAppBootstrap';
import { LoadingScreen, MIN_DISPLAY_DURATION_MS } from '../screens/LoadingScreen';
import { AuthStack } from './AuthStack';
import { OnboardingStack } from './OnboardingStack';
import { AppShell } from './AppShell';
import { ProfileStack } from './ProfileStack';
import { ChatScreen } from '../screens/chat/ChatScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Only the WHOOP and Spotify connect callbacks use this today —
// soset://whoop-callback and soset://spotify-callback (each with optional
// ?status=success|error&message=...) route straight to the Integrations
// screen. See supabase/functions/whoop-oauth-callback and
// supabase/functions/spotify-oauth-callback for the pages that send the
// user back here, and Info.plist / AndroidManifest.xml for where the
// `soset` scheme itself is registered.
//
// `alias` is how React Navigation maps a second path to the same screen —
// a bare array isn't a valid config value here, only a string or an object
// with `path`/`alias`/`screens`.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['soset://'],
  config: {
    screens: {
      Profile: {
        screens: {
          Integrations: { path: 'whoop-callback', alias: ['spotify-callback'] },
        },
      },
    },
  },
};

export function RootNavigator() {
  const theme = useTheme();
  const { hydrated, isAuthenticated, onboardingCompleted, userId } = useAuthStore();
  // Once a user is authenticated and onboarded, keep the splash up a little
  // longer to warm the query cache for Today's screen — everywhere else
  // (Auth/Onboarding) this is a no-op and reports ready immediately.
  const needsBootstrap = hydrated && isAuthenticated && onboardingCompleted;
  const { ready: bootstrapped } = useAppBootstrap({ enabled: needsBootstrap, userId });

  // Splash always stays up for MIN_DISPLAY_DURATION_MS, regardless of how
  // fast hydration/bootstrap resolve, so its animation is always seen
  // through rather than flashing past on a fast launch.
  const [minDurationElapsed, setMinDurationElapsed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMinDurationElapsed(true), MIN_DISPLAY_DURATION_MS);
    return () => clearTimeout(id);
  }, []);

  if (!hydrated || (needsBootstrap && !bootstrapped) || !minDurationElapsed) {
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
