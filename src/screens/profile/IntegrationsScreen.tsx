import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Header, Button, Icon, LoadingState } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import {
  useIntegrationConnections,
  useStartWhoopConnect,
  useDisconnectIntegration,
} from '../../services/api/queries/integrations';
import type { ProfileStackParamList } from '../../navigation/types';
import type { IntegrationProvider } from '../../types/database';

type Route = RouteProp<ProfileStackParamList, 'Integrations'>;
type Nav = NativeStackNavigationProp<ProfileStackParamList>;

type IntegrationDef = {
  provider: IntegrationProvider;
  name: string;
  source: string;
  description: string;
};

const INTEGRATIONS: IntegrationDef[] = [
  {
    provider: 'whoop',
    name: 'Whoop',
    source: 'Recovery, sleep & readiness',
    description:
      'Connect your Whoop account to bring recovery, sleep, and readiness data into SoSet — your coach uses it to adjust each day’s session.',
  },
];

function StatusPill({ connected }: { connected: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xxs,
        borderRadius: theme.radii.pill,
        backgroundColor: connected ? theme.colors.accent.subtle : theme.colors.bg.surfaceElevated,
      }}
    >
      <Text
        variant="caption"
        style={{ color: connected ? theme.colors.accent.primary : theme.colors.text.tertiary, fontWeight: '600' }}
      >
        {connected ? 'Connected' : 'Not connected'}
      </Text>
    </View>
  );
}

function IntegrationCard({
  def,
  userId,
  initiallyExpanded,
}: {
  def: IntegrationDef;
  userId: string | null;
  initiallyExpanded: boolean;
}) {
  const theme = useTheme();
  const { data: connections, isLoading, refetch } = useIntegrationConnections(userId);
  const startConnect = useStartWhoopConnect();
  const disconnect = useDisconnectIntegration();
  const connection = connections?.find(c => c.provider === def.provider) ?? null;
  const isConnected = connection?.access_token != null;

  const [expanded, setExpanded] = useState(initiallyExpanded);

  // Refetch whenever this screen regains focus — covers the user switching
  // back from the system browser after approving (or denying) Whoop access,
  // so "Connected" appears without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const onConnect = async () => {
    if (!userId) return;
    try {
      const { url } = await startConnect.mutateAsync();
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error('No browser available to open this link.');
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert(
        'Could not start connection',
        err instanceof Error ? err.message : 'Please try again.',
      );
    }
  };

  const onDisconnect = () => {
    if (!userId) return;
    Alert.alert(
      `Disconnect ${def.name}?`,
      'SoSet will stop reading your Whoop data. You can reconnect any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => disconnect.mutate({ userId, provider: def.provider }),
        },
      ],
    );
  };

  return (
    <Card variant="elevated" style={{ gap: theme.spacing.sm }}>
      <Pressable
        onPress={() => setExpanded(e => !e)}
        accessibilityRole="button"
        accessibilityLabel={`${def.name}, ${isConnected ? 'connected' : 'not connected'}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
      >
        <View
          style={{
            width: theme.sizes.iconButton,
            height: theme.sizes.iconButton,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.bg.surfaceElevated,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="activity" size="sm" color={theme.colors.text.secondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="body" style={{ fontWeight: '700' }}>
            {def.name}
          </Text>
          <Text variant="caption" color="secondary">
            {def.source}
          </Text>
        </View>
        <StatusPill connected={isConnected} />
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size="sm" color={theme.colors.text.tertiary} />
      </Pressable>

      {expanded ? (
        isLoading ? (
          <LoadingState fill={false} />
        ) : (
          <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.xs }}>
            <Text variant="caption" color="secondary">
              {def.description}
            </Text>
            {isConnected ? (
              <Button
                label="Disconnect"
                variant="ghost"
                onPress={onDisconnect}
                loading={disconnect.isPending}
              />
            ) : (
              <Button
                label={`Connect ${def.name}`}
                onPress={onConnect}
                loading={startConnect.isPending}
              />
            )}
          </View>
        )
      ) : null}
    </Card>
  );
}

export function IntegrationsScreen() {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const queryClient = useQueryClient();

  // Only ever set when this screen was reached via the soset://whoop-callback
  // deep link (see RootNavigator's `linking` config) — a normal tap into
  // Integrations from Settings never has these. Consumed once: cleared
  // immediately via setParams so backgrounding/refocusing the app doesn't
  // re-show the same alert.
  //
  // Invalidates directly here rather than relying on IntegrationCard's
  // useFocusEffect refetch: if this screen was already focused when the user
  // left for the Whoop browser flow (they never navigated away in-app), the
  // deep link updates route params without a blur->focus transition, so
  // useFocusEffect never re-fires and the pill is stuck showing stale data
  // until the app is restarted.
  useEffect(() => {
    if (!params?.status) return;
    if (params.status === 'success') {
      Alert.alert('Whoop connected', 'Your Whoop account is now connected to SoSet.');
    } else {
      Alert.alert('Connection failed', params.message ?? 'Could not connect Whoop. Please try again.');
    }
    queryClient.invalidateQueries({ queryKey: ['integrationConnections', userId] });
    navigation.setParams({ status: undefined, message: undefined });
  }, [params?.status, params?.message, navigation, queryClient, userId]);

  // Belt-and-suspenders fallback: if the OS hands the app back to the
  // foreground without React Navigation ever processing the soset:// URL
  // (e.g. the user manually switched back via the app switcher instead of
  // tapping the "Open in SoSet" system prompt), neither effect above runs at
  // all. Refetching on every foreground transition catches that case too.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        queryClient.invalidateQueries({ queryKey: ['integrationConnections', userId] });
      }
    });
    return () => subscription.remove();
  }, [queryClient, userId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header title="Integrations" />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.lg }}
      >
        <Text variant="body" color="secondary">
          Connect third-party fitness platforms to bring their data into SoSet.
        </Text>
        {INTEGRATIONS.map(def => (
          <IntegrationCard key={def.provider} def={def} userId={userId} initiallyExpanded={params?.status != null} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
