import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, TextField, Button, Card, Icon, LoadingState, EmptyState } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useChatUiStore } from '../../store/chatUiStore';
import {
  useConversation,
  useMessages,
  useInvalidateMessages,
} from '../../services/api/queries/chat';
import { sendChatMessage } from '../../services/api/edgeFunctions';
import { supabase } from '../../services/api/supabaseClient';
import type { RootStackParamList } from '../../navigation/types';
import type { ChatRole } from '../../types/database';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ChatScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore(state => state.userId);
  const { data: conversation } = useConversation(userId);
  const conversationId = conversation?.id ?? null;
  const { data: messages, isLoading } = useMessages(conversationId);
  const invalidateMessages = useInvalidateMessages(conversationId);

  const streamingBuffer = useChatUiStore(state => state.streamingBuffer);
  const appendToken = useChatUiStore(state => state.appendToken);
  const resetStreamingBuffer = useChatUiStore(state => state.resetStreamingBuffer);

  const [input, setInput] = useState('');
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on('broadcast', { event: 'token' }, ({ payload }) => {
        appendToken(payload.delta as string);
      })
      .on('broadcast', { event: 'done' }, () => {
        resetStreamingBuffer();
        setPendingUserText(null);
        setSending(false);
        invalidateMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || !conversationId || sending) return;
    setInput('');
    setPendingUserText(text);
    setSending(true);
    setError(null);
    resetStreamingBuffer();
    try {
      await sendChatMessage(conversationId, text);
    } catch (err) {
      setSending(false);
      setPendingUserText(null);
      setError(err instanceof Error ? err.message : 'Could not send that. Try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: theme.spacing.lg,
        }}
      >
        <Text variant="title">Coach</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={{
            width: theme.sizes.iconButton,
            height: theme.sizes.iconButton,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.bg.surfaceElevated,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="x" size="sm" color={theme.colors.text.secondary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {isLoading ? (
          <LoadingState />
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages?.length === 0 && !pendingUserText ? (
              <EmptyState
                icon="messageCircle"
                title="Ask your coach"
                description="Training, recovery, or nutrition — ask anything."
              />
            ) : null}

            {messages?.map(m => (
              <ChatBubble key={m.id} role={m.role} content={m.content} />
            ))}

            {pendingUserText ? <ChatBubble role="user" content={pendingUserText} /> : null}
            {streamingBuffer ? <ChatBubble role="assistant" content={streamingBuffer} /> : null}
            {sending && !streamingBuffer ? (
              <ActivityIndicator color={theme.colors.accent.primary} />
            ) : null}
            {error ? (
              <Text variant="caption" style={{ color: theme.colors.semantic.danger }}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
        )}

        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing.sm,
            padding: theme.spacing.lg,
            alignItems: 'flex-end',
          }}
        >
          <View style={{ flex: 1 }}>
            <TextField
              value={input}
              onChangeText={setInput}
              placeholder="Ask your coach..."
              multiline
              editable={!sending}
            />
          </View>
          <Button label="Send" onPress={onSend} disabled={!input.trim() || sending} loading={sending} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ChatBubble({ role, content }: { role: ChatRole; content: string }) {
  const theme = useTheme();
  const isUser = role === 'user';
  return (
    <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <Card
        variant={isUser ? 'flat' : 'subtle'}
        style={{
          maxWidth: '85%',
          backgroundColor: isUser ? theme.colors.accent.primary : theme.colors.bg.surface,
          borderWidth: 0,
          borderRadius: theme.radii.lg,
          [isUser ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: theme.radii.xs,
        }}
      >
        <Text
          variant="body"
          style={{ color: isUser ? theme.colors.text.onAccent : theme.colors.text.primary }}
        >
          {content}
        </Text>
      </Card>
    </View>
  );
}
