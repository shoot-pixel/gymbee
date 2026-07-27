import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useTheme } from '../../theme/ThemeProvider';
import {
  Header,
  Text,
  Card,
  ListRow,
  Avatar,
  EmptyState,
  LoadingState,
  SegmentedControl,
  Button,
} from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import {
  useConversations,
  useIncomingDmRequests,
  useOutgoingDmRequests,
  useRespondToConversation,
} from '../../services/api/queries/directMessages';
import type { CommunityStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;
type Tab = 'messages' | 'requests';

export function MessagesScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore(state => state.userId);
  const [tab, setTab] = useState<Tab>('messages');

  const { data: conversations, isLoading: conversationsLoading, refetch: refetchConversations } = useConversations(userId);
  const { data: incoming, isLoading: incomingLoading, refetch: refetchIncoming } = useIncomingDmRequests(userId);
  const { data: outgoing, refetch: refetchOutgoing } = useOutgoingDmRequests(userId);
  const respond = useRespondToConversation();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchConversations(), refetchIncoming(), refetchOutgoing()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchConversations, refetchIncoming, refetchOutgoing]);

  const requestCount = (incoming?.length ?? 0) + (outgoing?.length ?? 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <Header title="Messages" />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
        <SegmentedControl<Tab>
          options={[
            { value: 'messages', label: 'Messages' },
            { value: 'requests', label: requestCount > 0 ? `Requests (${requestCount})` : 'Requests' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent.primary} />}
      >
        {tab === 'messages' ? (
          conversationsLoading ? (
            <LoadingState fill={false} />
          ) : !conversations || conversations.length === 0 ? (
            <EmptyState
              icon="messageCircle"
              title="No messages yet"
              description="Start a conversation from someone's profile."
            />
          ) : (
            <Card variant="elevated" style={{ gap: 0 }}>
              {conversations.map((c, index) => (
                <ListRow
                  key={c.id}
                  title={c.otherParticipant?.display_name ?? 'Athlete'}
                  subtitle={format(new Date(c.last_message_at), 'MMM d, h:mm a')}
                  leading={<Avatar uri={c.otherParticipant?.avatar_url} size={40} />}
                  showChevron
                  onPress={() => navigation.navigate('Conversation', { conversationId: c.id })}
                  style={index > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle } : undefined}
                />
              ))}
            </Card>
          )
        ) : incomingLoading ? (
          <LoadingState fill={false} />
        ) : requestCount === 0 ? (
          <EmptyState
            icon="messageCircle"
            title="No requests"
            description="Message requests from people you haven't accepted yet will show up here."
          />
        ) : (
          <>
            {incoming && incoming.length > 0 ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="label" color="secondary">
                  REQUESTS
                </Text>
                <Card variant="elevated" style={{ gap: 0 }}>
                  {incoming.map((c, index) => (
                    <ListRow
                      key={c.id}
                      title={c.otherParticipant?.display_name ?? 'Athlete'}
                      leading={<Avatar uri={c.otherParticipant?.avatar_url} size={40} />}
                      onPress={() => navigation.navigate('Conversation', { conversationId: c.id })}
                      trailing={
                        <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
                          <Button
                            label="Accept"
                            size="sm"
                            onPress={() => userId && respond.mutate({ id: c.id, userId, status: 'accepted' })}
                            loading={respond.isPending}
                          />
                          <Button
                            label="Decline"
                            size="sm"
                            variant="secondary"
                            onPress={() => userId && respond.mutate({ id: c.id, userId, status: 'declined' })}
                            loading={respond.isPending}
                          />
                        </View>
                      }
                      style={index > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle } : undefined}
                    />
                  ))}
                </Card>
              </View>
            ) : null}

            {outgoing && outgoing.length > 0 ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="label" color="secondary">
                  SENT
                </Text>
                <Card variant="elevated" style={{ gap: 0 }}>
                  {outgoing.map((c, index) => (
                    <ListRow
                      key={c.id}
                      title={c.otherParticipant?.display_name ?? 'Athlete'}
                      subtitle="Pending"
                      leading={<Avatar uri={c.otherParticipant?.avatar_url} size={40} />}
                      style={index > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle } : undefined}
                    />
                  ))}
                </Card>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
