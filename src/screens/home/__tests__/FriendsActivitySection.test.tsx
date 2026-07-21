import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { FriendsActivitySection } from '../FriendsActivitySection';
import type { FriendPost } from '../../../services/api/queries/posts';

const PROGRESS_POST: FriendPost = {
  id: 'post-1',
  user_id: 'friend-1',
  post_type: 'progress_photo',
  visibility: 'friends',
  caption: null,
  photo_path: 'friend-1/friends/a.jpg',
  before_photo_path: null,
  after_photo_path: null,
  created_at: '2026-01-01T00:00:00.000Z',
  displayName: 'Friend One',
  avatarUrl: null,
};

const BEFORE_AFTER_POST: FriendPost = {
  id: 'post-2',
  user_id: 'friend-2',
  post_type: 'before_after_photo',
  visibility: 'friends',
  caption: null,
  photo_path: null,
  before_photo_path: 'friend-2/friends/before.jpg',
  after_photo_path: 'friend-2/friends/after.jpg',
  created_at: '2026-01-02T00:00:00.000Z',
  displayName: 'Friend Two',
  avatarUrl: null,
};

const noop = () => {};

describe('FriendsActivitySection', () => {
  it('renders the skeleton while loading', async () => {
    const { getByLabelText, queryByText } = await render(
      <FriendsActivitySection
        posts={[]}
        photoUrls={{}}
        isLoading
        isError={false}
        onRetry={noop}
        onCardPress={noop}
        onViewAllPress={noop}
      />,
    );

    expect(getByLabelText('Loading friends activity')).toBeTruthy();
    expect(queryByText('View All')).toBeNull();
  });

  it('renders cards from the given posts and calls onCardPress/onViewAllPress', async () => {
    const onCardPress = jest.fn();
    const onViewAllPress = jest.fn();

    const { getByText } = await render(
      <FriendsActivitySection
        posts={[PROGRESS_POST, BEFORE_AFTER_POST]}
        photoUrls={{}}
        isLoading={false}
        isError={false}
        onRetry={noop}
        onCardPress={onCardPress}
        onViewAllPress={onViewAllPress}
      />,
    );

    await waitFor(() => expect(getByText('Friend One posted a progress photo')).toBeTruthy());
    expect(getByText('Friend Two posted a before & after')).toBeTruthy();

    await fireEvent.press(getByText('Friend One posted a progress photo'));
    expect(onCardPress).toHaveBeenCalledWith(PROGRESS_POST);

    await fireEvent.press(getByText('View All'));
    expect(onViewAllPress).toHaveBeenCalled();
  });

  it('renders an error state and calls onRetry on tap', async () => {
    const onRetry = jest.fn();

    const { getByText } = await render(
      <FriendsActivitySection
        posts={[]}
        photoUrls={{}}
        isLoading={false}
        isError
        onRetry={onRetry}
        onCardPress={noop}
        onViewAllPress={noop}
      />,
    );

    await waitFor(() => expect(getByText("Couldn't load Friends Activity.")).toBeTruthy());
    await fireEvent.press(getByText('Retry'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders an empty state when there are no posts', async () => {
    const { getByText, queryByText } = await render(
      <FriendsActivitySection
        posts={[]}
        photoUrls={{}}
        isLoading={false}
        isError={false}
        onRetry={noop}
        onCardPress={noop}
        onViewAllPress={noop}
      />,
    );

    await waitFor(() => expect(getByText('No friend activity yet')).toBeTruthy());
    expect(queryByText('View All')).toBeNull();
  });
});
