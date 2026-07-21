import React from 'react';
import { Pressable } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { Badge, Icon } from '../components/core';
import { useChatUiStore } from '../store/chatUiStore';
import type { RootStackParamList } from './types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Persistent floating action button that opens the AI chat coach as a modal. */
export function ChatFab() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const hasUnread = useChatUiStore(state => state.hasUnread);

  return (
    <Pressable
      onPress={() => navigation.navigate('Chat', undefined)}
      style={[
        {
          position: 'absolute',
          right: theme.spacing.lg,
          bottom: 96,
          width: 56,
          height: 56,
          borderRadius: theme.radii.pill,
        },
        theme.shadows.lg,
      ]}
    >
      <LinearGradient
        colors={[...theme.gradients.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 56,
          height: 56,
          borderRadius: theme.radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="messageCircle" size="lg" color={theme.colors.text.onAccent} strokeWidth={2.25} />
      </LinearGradient>
      <Badge visible={hasUnread} />
    </Pressable>
  );
}
