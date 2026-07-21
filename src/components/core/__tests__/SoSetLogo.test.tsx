import React from 'react';
import { render } from '@testing-library/react-native';
import { SoSetLogo, SoSetIcon } from '../SoSetLogo';

describe('SoSetLogo', () => {
  it('renders the real combined mark+wordmark asset for the horizontal (light-on-dark) variant, not code-rendered text', async () => {
    const { getByLabelText, queryByText } = await render(<SoSetLogo variant="horizontal" />);
    expect(getByLabelText('SoSet')).toBeTruthy();
    expect(queryByText('So')).toBeNull();
    expect(queryByText('Set')).toBeNull();
  });

  it('renders the wordmark text for the stacked variant', async () => {
    const { getByText } = await render(<SoSetLogo variant="stacked" />);
    expect(getByText('So')).toBeTruthy();
    expect(getByText('Set')).toBeTruthy();
  });

  it('renders text (not the horizontal image asset) for dark-on-light, since no light-surface asset exists', async () => {
    const { getByText } = await render(<SoSetLogo variant="horizontal" theme="dark-on-light" />);
    expect(getByText('So')).toBeTruthy();
    expect(getByText('Set')).toBeTruthy();
  });

  it('renders only the mark, no wordmark text, for the icon variant', async () => {
    const { queryByText } = await render(<SoSetLogo variant="icon" />);
    expect(queryByText('So')).toBeNull();
    expect(queryByText('Set')).toBeNull();
  });

  it('exposes a single "SoSet" accessibility label by default, not per-word', async () => {
    const { getByLabelText } = await render(<SoSetLogo variant="stacked" />);
    expect(getByLabelText('SoSet')).toBeTruthy();
  });

  it('lets a caller suppress the accessibility label when a nearby element already labels it', async () => {
    const { queryByLabelText } = await render(<SoSetLogo variant="icon" accessibilityLabel="" />);
    expect(queryByLabelText('SoSet')).toBeNull();
  });

  it('SoSetIcon renders without crashing in both themes', async () => {
    const { rerender } = await render(<SoSetIcon theme="light-on-dark" />);
    await rerender(<SoSetIcon theme="dark-on-light" />);
  });
});
