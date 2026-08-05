import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../store/authStore';
import { Text, Button, IconButton, Icon, SelectableCard, LoadingState, EmptyState } from '../../components/core';
import { useOfferings, usePurchasePackage, useRestorePurchases } from '../../services/api/queries/purchases';
import { getThreePlanPackages, hasProEntitlement, REVENUECAT_ENABLED } from '../../services/purchases/revenueCat';
import { getErrorMessage } from '../../utils/errors';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

const TRIGGER_COPY: Record<string, string> = {
  ai_chat: "You've used your 3 free Arnold messages this month.",
  whoop: 'Whoop sync is part of SetSocial Pro.',
  analytics: 'Deeper progress analytics are part of SetSocial Pro.',
  widget: 'The home screen widget is part of SetSocial Pro.',
  program_regen: 'Rebuilding your program is part of SetSocial Pro.',
  adaptive_coaching: 'Adaptive Coaching Intelligence is part of SetSocial Pro.',
};

const FEATURES = [
  'Unlimited Arnold conversations',
  'Whoop wearable sync',
  'Full progress analytics & PR history',
  'Home screen widget',
  'Adaptive Coaching Intelligence',
  'Regenerate your program anytime',
];

type Plan = {
  pkg: PurchasesPackage;
  label: string;
  priceLine: string;
  tag?: string;
};

function buildPlans(offering: PurchasesOffering | null | undefined): Plan[] {
  const { monthly, yearly, lifetime } = getThreePlanPackages(offering);
  const plans: Plan[] = [];
  if (yearly) {
    plans.push({
      pkg: yearly,
      label: 'Yearly',
      priceLine: yearly.product.pricePerMonthString
        ? `${yearly.product.pricePerMonthString}/mo — billed ${yearly.product.priceString}/yr`
        : `${yearly.product.priceString}/year`,
      tag: 'Best value',
    });
  }
  if (monthly) {
    plans.push({ pkg: monthly, label: 'Monthly', priceLine: `${monthly.product.priceString}/month` });
  }
  if (lifetime) {
    plans.push({ pkg: lifetime, label: 'Lifetime', priceLine: `${lifetime.product.priceString}, once` });
  }
  return plans;
}

/**
 * SetSocial Pro's one purchase surface — reached the same way from every
 * gated feature (AI Chat's message cap, Whoop connect, locked analytics,
 * widget setup, program regeneration, adaptive coaching) via
 * rootNavigation.navigate('Paywall', { trigger: ... }).
 *
 * Fully custom rather than RevenueCat's hosted UI — this app's own theme,
 * components, and copy, built on the plain data hooks (useOfferings,
 * usePurchasePackage, useRestorePurchases) rather than a dashboard-configured
 * template. `trigger`'s copy swaps in the reason the athlete landed here.
 */
export function PaywallScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const queryClient = useQueryClient();
  const trigger = route.params?.trigger;
  const subtitle = (trigger && TRIGGER_COPY[trigger]) ?? 'Train smarter with the full SetSocial experience.';

  const { data: offerings, isLoading: offeringsLoading, refetch: refetchOfferings } = useOfferings();
  const plans = useMemo(() => buildPlans(offerings?.current), [offerings]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedId || plans.length === 0) return;
    setSelectedId(plans[0].pkg.identifier);
  }, [plans, selectedId]);

  const purchasePackage = usePurchasePackage();
  const restorePurchases = useRestorePurchases();

  const onPurchase = () => {
    const plan = plans.find(p => p.pkg.identifier === selectedId);
    if (!plan) return;
    purchasePackage.mutate(plan.pkg, {
      onSuccess: outcome => {
        if (outcome.status === 'purchased') {
          if (userId) queryClient.invalidateQueries({ queryKey: ['profile', userId] });
          navigation.goBack();
        } else if (outcome.status === 'error') {
          Alert.alert('Purchase failed', outcome.message);
        }
      },
    });
  };

  const onRestore = () => {
    restorePurchases.mutate(undefined, {
      onSuccess: customerInfo => {
        const entitled = hasProEntitlement(customerInfo);
        Alert.alert(
          entitled ? 'Restored' : 'Nothing to restore',
          entitled
            ? 'Your SetSocial Pro purchase has been restored.'
            : "We didn't find a previous purchase for this account.",
        );
        if (entitled) {
          if (userId) queryClient.invalidateQueries({ queryKey: ['profile', userId] });
          navigation.goBack();
        }
      },
      onError: err => Alert.alert('Restore failed', getErrorMessage(err, 'Please try again.')),
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: theme.spacing.md }}>
        <IconButton name="x" variant="ghost" accessibilityLabel="Close" onPress={() => navigation.goBack()} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: theme.radii.xl,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LinearGradient
              colors={[...theme.gradients.premium]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Icon name="zap" size="lg" color={theme.colors.bg.base} />
          </View>
          <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
            <Text variant="display" style={{ textAlign: 'center' }}>
              SetSocial Pro
            </Text>
            <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          {FEATURES.map(feature => (
            <View key={feature} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Icon name="check" size="sm" color={theme.gradients.premium[1]} />
              <Text variant="body" style={{ flex: 1 }}>
                {feature}
              </Text>
            </View>
          ))}
        </View>

        {!REVENUECAT_ENABLED ? (
          <EmptyState
            icon="clock"
            title="Not available yet"
            description="SetSocial Pro purchases aren't open during the beta — check back soon."
          />
        ) : offeringsLoading ? (
          <LoadingState fill={false} label="Loading plans…" />
        ) : plans.length === 0 ? (
          <EmptyState
            icon="circleAlert"
            title="Pricing unavailable"
            description="Check your connection and try again."
            actionLabel="Retry"
            onAction={() => refetchOfferings()}
          />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {plans.map(plan => (
              <SelectableCard
                key={plan.pkg.identifier}
                label={plan.tag ? `${plan.label} · ${plan.tag}` : plan.label}
                description={plan.priceLine}
                selected={selectedId === plan.pkg.identifier}
                onPress={() => setSelectedId(plan.pkg.identifier)}
              />
            ))}
          </View>
        )}

        {REVENUECAT_ENABLED ? (
          <>
            <View style={{ gap: theme.spacing.sm }}>
              <Button
                label="Continue"
                onPress={onPurchase}
                gradientColors={theme.gradients.premium}
                loading={purchasePackage.isPending}
                disabled={!selectedId || plans.length === 0}
                size="lg"
              />
              <Button
                label="Restore Purchases"
                variant="ghost"
                onPress={onRestore}
                loading={restorePurchases.isPending}
              />
            </View>

            <Text variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
              Subscriptions renew automatically until cancelled. Manage or cancel anytime from your device's account
              settings.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
