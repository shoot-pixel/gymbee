import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import type { PushNotificationPayload } from '../services/push/pushNotifications';

/** Lets code outside the component tree (the push notification event
 * listeners in usePushNotifications, which fire from a native event, not a
 * screen) drive navigation — nothing else in the app has needed this yet,
 * see RootNavigator's `linking` prop for the one other deep-link path
 * (WHOOP/Spotify OAuth callbacks), which goes through a URL instead. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Maps a push notification's abstract `{screen, params}` (see send-push's
 * ResolvedNotification) onto the actual nested navigation call — every
 * target today lives inside CommunityTab or ProgramsTab, one level under
 * MainTabs, so this is the only place that needs to know that nesting. */
export function navigateToPushDestination(payload: PushNotificationPayload): void {
  if (!navigationRef.isReady()) return;
  const params = payload.params ?? {};

  switch (payload.screen) {
    case 'Conversation':
      navigationRef.navigate('MainTabs', {
        screen: 'CommunityTab',
        params: { screen: 'Conversation', params: { conversationId: params.conversationId as string } },
      });
      return;
    case 'FriendsList':
      navigationRef.navigate('MainTabs', {
        screen: 'CommunityTab',
        params: { screen: 'FriendsList', params: { userId: params.userId as string, title: 'Friends' } },
      });
      return;
    case 'FriendProfile':
      navigationRef.navigate('MainTabs', {
        screen: 'CommunityTab',
        params: { screen: 'FriendProfile', params: { userId: params.userId as string } },
      });
      return;
    case 'PostDetail':
      navigationRef.navigate('MainTabs', {
        screen: 'CommunityTab',
        params: { screen: 'PostDetail', params: { postId: params.postId as string } },
      });
      return;
    case 'ProgramDetail':
      if (!params.programId) {
        navigationRef.navigate('MainTabs', { screen: 'ProgramsTab', params: { screen: 'Calendar' } });
        return;
      }
      navigationRef.navigate('MainTabs', {
        screen: 'ProgramsTab',
        params: { screen: 'ProgramDetail', params: { programId: params.programId as string } },
      });
      return;
    default:
      // Unknown/future screen name — nothing to navigate to yet; the app
      // still opens normally, just without the deep link.
      return;
  }
}
