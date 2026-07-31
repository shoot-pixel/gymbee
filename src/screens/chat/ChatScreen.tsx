import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Text,
  TextField,
  Button,
  Card,
  Icon,
  IconButton,
  BottomSheet,
  ListRow,
  LoadingState,
  EmptyState,
  KeyboardAvoider,
} from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useChatUiStore } from '../../store/chatUiStore';
import { useProfile } from '../../services/api/queries/profiles';
import {
  useConversation,
  useMessages,
  useInvalidateMessages,
  useClearChat,
} from '../../services/api/queries/chat';
import { sendChatMessage, EdgeFunctionError } from '../../services/api/edgeFunctions';
import { supabase } from '../../services/api/supabaseClient';
import type { RootStackParamList } from '../../navigation/types';
import type { ChatRole } from '../../types/database';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Keep in sync with FREE_MESSAGES_PER_MONTH in
// supabase/functions/chat-coach/index.ts — this is only the client-side
// "X of 3 used" hint and a way to skip a wasted round trip once the count
// is obviously already at the cap; the edge function is what actually
// enforces it.
const FREE_MESSAGES_PER_MONTH = 3;

export function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore(state => state.userId);
  const { data: profile } = useProfile(userId);
  const isPremium = profile?.is_premium ?? false;
  const { data: conversation } = useConversation(userId);
  const conversationId = conversation?.id ?? null;
  const { data: messages, isLoading } = useMessages(conversationId);
  const invalidateMessages = useInvalidateMessages(conversationId);
  const clearChat = useClearChat(conversationId);
  const queryClient = useQueryClient();

  const messagesUsedThisMonth = React.useMemo(() => {
    if (isPremium || !messages) return 0;
    const monthStart = format(new Date(), 'yyyy-MM-01');
    return messages.filter(m => m.role === 'user' && m.created_at >= monthStart).length;
  }, [messages, isPremium]);
  const atFreeLimit = !isPremium && messagesUsedThisMonth >= FREE_MESSAGES_PER_MONTH;

  const streamingBuffer = useChatUiStore(state => state.streamingBuffer);
  const appendToken = useChatUiStore(state => state.appendToken);
  const resetStreamingBuffer = useChatUiStore(state => state.resetStreamingBuffer);

  const [input, setInput] = useState('');
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsSheetOpen, setOptionsSheetOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const onClearChat = () => {
    setOptionsSheetOpen(false);
    Alert.alert('Clear this chat?', "This can't be undone — your coach won't remember this conversation.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          resetStreamingBuffer();
          setPendingUserText(null);
          setError(null);
          try {
            await clearChat.mutateAsync();
          } catch (err) {
            Alert.alert('Could not clear chat', err instanceof Error ? err.message : 'Please try again.');
          }
        },
      },
    ]);
  };

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
        // Cheap no-op if the coach didn't touch the schedule this turn — but
        // if it did (removed/curated/scheduled a workout via a tool call),
        // this is what makes Today/Calendar/Library reflect it right away
        // instead of waiting out the normal staleTime.
        queryClient.invalidateQueries({ queryKey: ['scheduledWorkouts'] });
        queryClient.invalidateQueries({ queryKey: ['workoutTemplates'] });
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
    if (atFreeLimit) {
      navigation.navigate('Paywall', { trigger: 'ai_chat' });
      return;
    }
    setInput('');
    setPendingUserText(text);
    setSending(true);
    setError(null);
    resetStreamingBuffer();
    try {
      await sendChatMessage(conversationId, text, format(new Date(), 'yyyy-MM-dd'));
    } catch (err) {
      setSending(false);
      setPendingUserText(null);
      if (err instanceof EdgeFunctionError && err.code === 'free_limit_reached') {
        setInput(text); // hand the draft back rather than discarding it
        navigation.navigate('Paywall', { trigger: 'ai_chat' });
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not send that. Try again.');
    }
  };

  return (
    // Top inset is applied explicitly below rather than left to SafeAreaView's
    // automatic edge — this screen is presented as a fullScreenModal (covers
    // the true top of the display, status bar included), and the collapse
    // button needs a guaranteed floor of clearance on every device regardless
    // of what the native modal-presentation layer reports for insets.top.
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['left', 'right', 'bottom']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: Math.max(insets.top, theme.spacing.lg) + theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.lg,
        }}
      >
        <Text variant="title">Coach</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <IconButton
            name="moreVertical"
            variant="ghost"
            accessibilityLabel="Chat options"
            onPress={() => setOptionsSheetOpen(true)}
          />
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Collapse chat"
            style={{
              width: theme.sizes.iconButton,
              height: theme.sizes.iconButton,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.bg.surfaceElevated,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="chevronDown" size="sm" color={theme.colors.text.secondary} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoider>
        {isLoading ? (
          <LoadingState />
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
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

        {!isPremium ? (
          <Text
            variant="caption"
            color="secondary"
            style={{ textAlign: 'center', paddingHorizontal: theme.spacing.lg }}
          >
            {atFreeLimit
              ? "You've used all your free messages this month — upgrade for unlimited AI Coach"
              : `${messagesUsedThisMonth} of ${FREE_MESSAGES_PER_MONTH} free messages used this month`}
          </Text>
        ) : null}

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
              placeholder={atFreeLimit ? 'Upgrade to keep chatting…' : 'Ask your coach...'}
              multiline
              editable={!sending}
            />
          </View>
          <Button
            label={atFreeLimit ? 'Upgrade' : 'Send'}
            onPress={onSend}
            disabled={!input.trim() || sending}
            loading={sending}
            gradientColors={atFreeLimit ? theme.gradients.premium : undefined}
          />
        </View>
      </KeyboardAvoider>

      <BottomSheet visible={optionsSheetOpen} onClose={() => setOptionsSheetOpen(false)}>
        <ListRow title="Clear Chat" icon="trash" onPress={onClearChat} />
      </BottomSheet>
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
