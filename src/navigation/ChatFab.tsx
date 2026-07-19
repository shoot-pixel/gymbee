import React from 'react';
import { Pressable, Text as RNText } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { Badge } from '../components/core';
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
      style={{
        position: 'absolute',
        right: theme.spacing.lg,
        bottom: 96,
        width: 56,
        height: 56,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.colors.accent.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <RNText style={{ fontSize: 24 }}>💬</RNText>
      <Badge visible={hasUnread} />
    </Pressable>
  );
}
