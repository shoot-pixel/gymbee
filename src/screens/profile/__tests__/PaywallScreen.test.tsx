import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { PaywallScreen } from '../PaywallScreen';
import type { PurchasesPackage, PurchasesOffering } from 'react-native-purchases';

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string | null }) => unknown) => selector({ userId: 'user-1' }),
}));

// REVENUECAT_ENABLED is currently hardcoded off (see its own doc comment —
// a bad key crashed a live App Store build) — this file exercises the full
// purchase flow as it behaves once that's flipped back on; the disabled
// default's own "not available yet" UI is covered separately in
// PaywallScreen.betaDisabled.test.tsx, against the real unmocked flag.
jest.mock('../../../services/purchases/revenueCat', () => ({
  ...jest.requireActual('../../../services/purchases/revenueCat'),
  REVENUECAT_ENABLED: true,
}));

const mockInvalidateQueries = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockUseOfferings = jest.fn();
const mockPurchaseMutate = jest.fn();
const mockRestoreMutate = jest.fn();

jest.mock('../../../services/api/queries/purchases', () => ({
  useOfferings: (...args: unknown[]) => mockUseOfferings(...args),
  usePurchasePackage: jest.fn(() => ({ mutate: mockPurchaseMutate, isPending: false })),
  useRestorePurchases: jest.fn(() => ({ mutate: mockRestoreMutate, isPending: false })),
}));

function makePackage(identifier: string, priceString: string, pricePerMonthString: string | null = null): PurchasesPackage {
  return {
    identifier,
    product: { priceString, pricePerMonthString, title: identifier, description: '' },
  } as unknown as PurchasesPackage;
}

const monthlyPkg = makePackage('monthly', '$6.99');
const yearlyPkg = makePackage('yearly', '$59.99', '$5.00');
const lifetimePkg = makePackage('lifetime', '$199.99');

const offeringWithAllPlans = {
  monthly: monthlyPkg,
  annual: yearlyPkg,
  lifetime: lifetimePkg,
  availablePackages: [monthlyPkg, yearlyPkg, lifetimePkg],
} as unknown as PurchasesOffering;

const mockRefetchOfferings = jest.fn();
const mockGoBack = jest.fn();

function renderScreen(trigger?: string) {
  const navigation = { goBack: mockGoBack } as never;
  const route = { key: 'paywall', name: 'Paywall' as const, params: trigger ? { trigger } : undefined } as never;
  return render(<PaywallScreen navigation={navigation} route={route} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseOfferings.mockReturnValue({
    data: { current: offeringWithAllPlans },
    isLoading: false,
    refetch: mockRefetchOfferings,
  });
});

describe('PaywallScreen', () => {
  it('shows the trigger-specific reason an athlete landed here', async () => {
    const { getByText } = await renderScreen('ai_chat');
    expect(getByText("You've used your 3 free Arnold messages this month.")).toBeTruthy();
  });

  it('purchases the yearly plan by default without needing to pick one first', async () => {
    const { getByText } = await renderScreen();
    await fireEvent.press(getByText('Continue'));

    expect(mockPurchaseMutate).toHaveBeenCalledWith(yearlyPkg, expect.anything());
  });

  it('lets an athlete switch plans before purchasing', async () => {
    const { getByText } = await renderScreen();
    await fireEvent.press(getByText('Monthly'));
    await fireEvent.press(getByText('Continue'));

    expect(mockPurchaseMutate).toHaveBeenCalledWith(monthlyPkg, expect.anything());
  });

  it('goes back and invalidates the profile query after a successful purchase', async () => {
    mockPurchaseMutate.mockImplementation((_pkg, { onSuccess }) => {
      onSuccess({ status: 'purchased' });
    });

    const { getByText } = await renderScreen();
    await fireEvent.press(getByText('Continue'));

    expect(mockGoBack).toHaveBeenCalled();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['profile', 'user-1'] });
  });

  it('alerts on a purchase error without navigating away', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockPurchaseMutate.mockImplementation((_pkg, { onSuccess }) => {
      onSuccess({ status: 'error', message: 'Card declined' });
    });

    const { getByText } = await renderScreen();
    await fireEvent.press(getByText('Continue'));

    expect(alertSpy).toHaveBeenCalledWith('Purchase failed', 'Card declined');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('does not navigate away when the purchase is cancelled', async () => {
    mockPurchaseMutate.mockImplementation((_pkg, { onSuccess }) => {
      onSuccess({ status: 'cancelled' });
    });

    const { getByText } = await renderScreen();
    await fireEvent.press(getByText('Continue'));

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('restores a purchase, alerts, invalidates, and goes back when entitled', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockRestoreMutate.mockImplementation((_vars, { onSuccess }) => {
      onSuccess({ entitlements: { active: { 'SetSocial Pro': {} } } });
    });

    const { getByText } = await renderScreen();
    await fireEvent.press(getByText('Restore Purchases'));

    expect(alertSpy).toHaveBeenCalledWith('Restored', 'Your SetSocial Pro purchase has been restored.');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['profile', 'user-1'] });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('alerts without navigating when a restore finds nothing', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockRestoreMutate.mockImplementation((_vars, { onSuccess }) => {
      onSuccess({ entitlements: { active: {} } });
    });

    const { getByText } = await renderScreen();
    await fireEvent.press(getByText('Restore Purchases'));

    expect(alertSpy).toHaveBeenCalledWith('Nothing to restore', "We didn't find a previous purchase for this account.");
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('shows a retry option instead of plans when offerings fail to load', async () => {
    mockUseOfferings.mockReturnValue({ data: { current: null }, isLoading: false, refetch: mockRefetchOfferings });

    const { getByText } = await renderScreen();
    expect(getByText('Pricing unavailable')).toBeTruthy();

    await fireEvent.press(getByText('Retry'));
    expect(mockRefetchOfferings).toHaveBeenCalledTimes(1);
  });
});
