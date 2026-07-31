import React, { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import { Header, Text, Icon, IconButton, TextField, LoadingState, Avatar, ReportBlockSheet, KeyboardAvoider } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import {
  useConversation,
  useMessages,
  useSendMessage,
  useToggleMessageLike,
  useConversationRealtime,
  useSignedDmPhotoUrls,
} from '../../services/api/queries/directMessages';
import type { CommunityStackParamList } from '../../navigation/types';

type Route = RouteProp<CommunityStackParamList, 'Conversation'>;
type Nav = NativeStackNavigationProp<CommunityStackParamList>;

type PendingPhoto = { uri: string; contentType: string };

export function ConversationScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const userId = useAuthStore(state => state.userId);
  const scrollRef = useRef<ScrollView>(null);

  const { data: conversation } = useConversation(params.conversationId, userId);
  const { data: messages, isLoading } = useMessages(params.conversationId, userId);
  const sendMessage = useSendMessage();
  const toggleLike = useToggleMessageLike();
  useConversationRealtime(params.conversationId);

  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<PendingPhoto | null>(null);
  const [moderationOpen, setModerationOpen] = useState(false);

  const photoPaths = useMemo(() => (messages ?? []).map(m => m.photo_path).filter((p): p is string => p != null), [messages]);
  const { data: signedUrls } = useSignedDmPhotoUrls(photoPaths);

  const onPickPhoto = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.didCancel) return;
    if (result.errorCode) {
      Alert.alert('Could not open photo library', result.errorMessage ?? 'Please try again.');
      return;
    }
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    setPhoto({ uri: asset.uri, contentType: asset.type ?? 'image/jpeg' });
  };

  const onSend = async () => {
    if (!userId || (!body.trim() && !photo)) return;
    const outgoingBody = body.trim() || null;
    const outgoingPhoto = photo;
    setBody('');
    setPhoto(null);
    try {
      await sendMessage.mutateAsync({
        conversationId: params.conversationId,
        senderId: userId,
        body: outgoingBody,
        photo: outgoingPhoto,
      });
    } catch (err) {
      Alert.alert('Could not send message', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const isPendingForMe = conversation?.status === 'pending' && conversation.recipient_id === userId;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header
        title={conversation?.otherParticipant?.display_name ?? 'Messages'}
        right={
          conversation ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Avatar
                uri={conversation.otherParticipant?.avatar_url}
                size={32}
                onPress={() =>
                  conversation.otherParticipant &&
                  navigation.navigate('FriendProfile', { userId: conversation.otherParticipant.id })
                }
              />
              <IconButton
                name="moreVertical"
                variant="ghost"
                accessibilityLabel="Conversation options"
                onPress={() => setModerationOpen(true)}
              />
            </View>
          ) : undefined
        }
      />
      <KeyboardAvoider>
        {isLoading ? (
          <LoadingState />
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {(messages ?? []).map(message => {
              const isMine = message.sender_id === userId;
              return (
                <View key={message.id} style={{ alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                  <View
                    style={{
                      maxWidth: '80%',
                      backgroundColor: isMine ? theme.colors.accent.primary : theme.colors.bg.surface,
                      borderRadius: theme.radii.md,
                      padding: theme.spacing.sm,
                      gap: theme.spacing.xs,
                    }}
                  >
                    {message.photo_path && signedUrls?.[message.photo_path] ? (
                      <Image
                        source={{ uri: signedUrls[message.photo_path] }}
                        style={{ width: 200, height: 200, borderRadius: theme.radii.sm }}
                        resizeMode="cover"
                      />
                    ) : null}
                    {message.body ? (
                      <Text variant="body" style={{ color: isMine ? theme.colors.text.onAccent : theme.colors.text.primary }}>
                        {message.body}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() =>
                      userId &&
                      toggleLike.mutate({
                        messageId: message.id,
                        conversationId: params.conversationId,
                        userId,
                        currentlyLiked: message.likedByMe,
                      })
                    }
                    accessibilityLabel={message.likedByMe ? 'Unlike message' : 'Like message'}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: 2, paddingHorizontal: 4 }}
                  >
                    <Icon
                      name="heart"
                      size={12}
                      color={message.likedByMe ? theme.colors.semantic.danger : theme.colors.text.tertiary}
                    />
                    {message.likeCount > 0 ? (
                      <Text variant="caption" color="tertiary">
                        {message.likeCount}
                      </Text>
                    ) : null}
                    <Text variant="caption" color="tertiary" style={{ marginLeft: 4 }}>
                      {format(new Date(message.created_at), 'h:mm a')}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        )}

        {isPendingForMe ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.sm,
            }}
          >
            <Text variant="caption" color="secondary">
              {conversation?.otherParticipant?.display_name ?? 'This athlete'} isn't in your messages yet — replying will
              move them there.
            </Text>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            padding: theme.spacing.lg,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border.subtle,
          }}
        >
          <IconButton name="camera" variant="ghost" accessibilityLabel="Attach a photo" onPress={onPickPhoto} />
          <View style={{ flex: 1 }}>
            <TextField value={body} onChangeText={setBody} placeholder={photo ? 'Add a caption (optional)' : 'Message'} />
          </View>
          <IconButton
            name="chevronRight"
            variant="filled"
            accessibilityLabel="Send"
            onPress={onSend}
            disabled={!body.trim() && !photo}
          />
        </View>
      </KeyboardAvoider>

      {conversation ? (
        <ReportBlockSheet
          visible={moderationOpen}
          onClose={() => setModerationOpen(false)}
          currentUserId={userId}
          targetType="conversation"
          targetId={params.conversationId}
          reportedUserId={conversation.otherParticipant?.id ?? ''}
          reportedUserName={conversation.otherParticipant?.display_name ?? undefined}
          onBlocked={() => navigation.goBack()}
        />
      ) : null}
    </SafeAreaView>
  );
}
