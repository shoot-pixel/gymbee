import React from 'react';
import { act, render } from '@testing-library/react-native';
import { AppShell } from '../AppShell';

// MainTabs itself (every tab stack, auth store, profile/notification
// queries) isn't the point of this test — only that AppShell picks the
// right FAB for whichever tab MainTabs reports as active. Mocked down to
// just exposing the onActiveTabChange callback it would normally call.
let capturedOnActiveTabChange: ((tab: string, focusedScreenName?: string) => void) | undefined;

jest.mock('../MainTabs', () => ({
  MainTabs: ({ onActiveTabChange }: { onActiveTabChange: (tab: string, focusedScreenName?: string) => void }) => {
    capturedOnActiveTabChange = onActiveTabChange;
    return null;
  },
}));

jest.mock('../ChatFab', () => ({
  ChatFab: () => {
    const { Text } = jest.requireActual('react-native');
    return <Text>ChatFab</Text>;
  },
}));
jest.mock('../PostFab', () => ({
  PostFab: () => {
    const { Text } = jest.requireActual('react-native');
    return <Text>PostFab</Text>;
  },
}));

describe('AppShell', () => {
  it('shows the chat FAB by default and on every tab except Social', async () => {
    const { queryByText } = await render(<AppShell />);
    expect(queryByText('ChatFab')).toBeTruthy();
    expect(queryByText('PostFab')).toBeNull();

    await act(async () => capturedOnActiveTabChange?.('ProgramsTab'));
    expect(queryByText('ChatFab')).toBeTruthy();
    expect(queryByText('PostFab')).toBeNull();
  });

  it('swaps to the post FAB on the Social tab feed, and back on leaving it', async () => {
    const { queryByText } = await render(<AppShell />);

    await act(async () => capturedOnActiveTabChange?.('CommunityTab', 'Posts'));
    expect(queryByText('PostFab')).toBeTruthy();
    expect(queryByText('ChatFab')).toBeNull();

    await act(async () => capturedOnActiveTabChange?.('TodayTab'));
    expect(queryByText('ChatFab')).toBeTruthy();
    expect(queryByText('PostFab')).toBeNull();
  });

  it('hides both FABs while in a DM conversation, since it already has its own send button', async () => {
    const { queryByText } = await render(<AppShell />);

    await act(async () => capturedOnActiveTabChange?.('CommunityTab', 'Conversation'));
    expect(queryByText('PostFab')).toBeNull();
    expect(queryByText('ChatFab')).toBeNull();

    await act(async () => capturedOnActiveTabChange?.('CommunityTab', 'Posts'));
    expect(queryByText('PostFab')).toBeTruthy();
    expect(queryByText('ChatFab')).toBeNull();
  });

  it('falls back to the chat FAB on other Social-tab screens (e.g. a friend profile)', async () => {
    const { queryByText } = await render(<AppShell />);

    await act(async () => capturedOnActiveTabChange?.('CommunityTab', 'FriendProfile'));
    expect(queryByText('ChatFab')).toBeTruthy();
    expect(queryByText('PostFab')).toBeNull();
  });
});
