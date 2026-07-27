import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AiSummaryCard } from '../AiSummaryCard';
import { useCoachSummaryStore } from '../../../store/coachSummaryStore';

afterEach(() => {
  useCoachSummaryStore.setState({ dismissed: false });
});

describe('AiSummaryCard', () => {
  it('renders the headline and summary', async () => {
    const { getByText } = await render(
      <AiSummaryCard headline="Ready to train" summary="You're primed for a strong session." band="high" isRestDay={false} />,
    );

    expect(getByText('Coach Summary')).toBeTruthy();
    expect(getByText('Ready to train')).toBeTruthy();
    expect(getByText("You're primed for a strong session.")).toBeTruthy();
  });

  it('hides itself once dismissed, without clearing the store for other consumers to un-hide it', async () => {
    const { getByLabelText, queryByText } = await render(
      <AiSummaryCard headline="Ready to train" summary="You're primed for a strong session." band="high" isRestDay={false} />,
    );

    await fireEvent.press(getByLabelText('Dismiss coach summary'));

    expect(queryByText('Coach Summary')).toBeNull();
    expect(useCoachSummaryStore.getState().dismissed).toBe(true);
  });

  it('stays dismissed across remounts within the same app session — only a fresh store (full relaunch) un-hides it', async () => {
    useCoachSummaryStore.setState({ dismissed: true });

    const { queryByText } = await render(
      <AiSummaryCard headline="Ready to train" summary="You're primed for a strong session." band="high" isRestDay={false} />,
    );

    expect(queryByText('Coach Summary')).toBeNull();
  });

  it('renders nothing when there is no summary yet, regardless of dismissal state', async () => {
    const { queryByText } = await render(
      <AiSummaryCard headline="" summary="" band={null} isRestDay={false} />,
    );

    expect(queryByText('Coach Summary')).toBeNull();
  });
});
