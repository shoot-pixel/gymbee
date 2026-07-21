import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { UploadPhotoPostScreen } from '../UploadPhotoPostScreen';

const mockGoBack = jest.fn();
let mockRouteParams: { mode: 'progress' | 'before_after' } = { mode: 'progress' };

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ goBack: mockGoBack, canGoBack: () => true }),
    useRoute: () => ({ params: mockRouteParams }),
  };
});

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

const mockCreateMutateAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../services/api/queries/posts', () => ({
  useCreatePhotoPost: jest.fn(() => ({ mutateAsync: mockCreateMutateAsync, isPending: false })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateMutateAsync.mockResolvedValue(undefined);
  (launchImageLibrary as jest.Mock).mockResolvedValue({
    didCancel: false,
    assets: [{ uri: 'file://photo.jpg', type: 'image/jpeg' }],
  });
});

describe('UploadPhotoPostScreen', () => {
  it('shows a single photo picker in progress mode', async () => {
    mockRouteParams = { mode: 'progress' };
    const { getByText, queryByText } = await render(<UploadPhotoPostScreen />);
    await waitFor(() => expect(getByText('Post Progress Photo')).toBeTruthy());

    expect(getByText('Add Photo')).toBeTruthy();
    expect(queryByText('Before')).toBeNull();
    expect(queryByText('After')).toBeNull();
  });

  it('shows two photo pickers in before/after mode', async () => {
    mockRouteParams = { mode: 'before_after' };
    const { getByText } = await render(<UploadPhotoPostScreen />);
    await waitFor(() => expect(getByText('Post Before & After')).toBeTruthy());

    expect(getByText('Before')).toBeTruthy();
    expect(getByText('After')).toBeTruthy();
  });

  it('defaults visibility to Friends and posts with the selected visibility, mode, and caption', async () => {
    mockRouteParams = { mode: 'progress' };
    const { getByText, getByLabelText, getByPlaceholderText } = await render(<UploadPhotoPostScreen />);
    await waitFor(() => expect(getByText('Your friends can see this.')).toBeTruthy());

    await fireEvent.press(getByText('Add Photo'));
    await waitFor(() => expect(launchImageLibrary).toHaveBeenCalled());

    await fireEvent.changeText(getByPlaceholderText('Add a caption (optional)'), 'Feeling strong');
    await fireEvent.press(getByLabelText('🔒 Private'));
    await waitFor(() => expect(getByText('Only you can see this.')).toBeTruthy());

    await fireEvent.press(getByText('Post'));

    await waitFor(() =>
      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        mode: 'progress',
        visibility: 'private',
        caption: 'Feeling strong',
        photo: { uri: 'file://photo.jpg', contentType: 'image/jpeg' },
      }),
    );
  });

  it('disables Post until the required photo(s) are picked', async () => {
    mockRouteParams = { mode: 'before_after' };
    const { getByText } = await render(<UploadPhotoPostScreen />);
    await waitFor(() => expect(getByText('Post Before & After')).toBeTruthy());

    await fireEvent.press(getByText('Post'));
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });
});
