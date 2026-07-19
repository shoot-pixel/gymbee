import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme, Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import { AuthStack } from './AuthStack';
import { OnboardingStack } from './OnboardingStack';
import { AppShell } from './AppShell';
import { ProfileStack } from './ProfileStack';
import { ChatScreen } from '../screens/chat/ChatScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const theme = useTheme();
  const { hydrated, isAuthenticated, onboardingCompleted } = useAuthStore();

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.bg.base,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={theme.colors.accent.primary} />
      </View>
    );
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
    <NavigationContainer theme={navTheme}>
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
              options={{ presentation: 'modal', headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
