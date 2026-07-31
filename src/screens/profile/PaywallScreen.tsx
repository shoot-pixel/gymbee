import React from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Header, Button, Icon, type IconName } from '../../components/core';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

const TRIGGER_COPY: Record<string, string> = {
  ai_chat: "You've used your 3 free AI Coach messages this month.",
  whoop: 'Whoop sync is part of SetSocial Premium.',
  analytics: 'Deeper progress analytics are part of SetSocial Premium.',
  widget: 'The home screen widget is part of SetSocial Premium.',
  program_regen: 'Rebuilding your program is part of SetSocial Premium.',
  adaptive_coaching: 'Adaptive Coaching Intelligence is part of SetSocial Premium.',
};

const PERKS: { icon: IconName; title: string; description: string }[] = [
  {
    icon: 'messageCircle',
    title: 'Unlimited AI Coach',
    description: 'Ask about form, recovery, or your plan — anytime, no monthly cap.',
  },
  {
    icon: 'zap',
    title: 'Adaptive Coaching Intelligence',
    description: 'Auto-adjusted workouts and next-set recommendations based on your readiness.',
  },
  {
    icon: 'heart',
    title: 'Whoop sync + advanced analytics',
    description: 'Full trend history, PR timeline, and Weekly Review pattern insights.',
  },
  {
    icon: 'rotateCcw',
    title: 'Rebuild your program anytime',
    description: "Not just at onboarding — regenerate a fresh plan whenever your goals change.",
  },
  {
    icon: 'crown',
    title: 'Home screen widget + Premium badge',
    description: "Today's plan on your lock screen, and recognition across the app.",
  },
];

/** SetSocial Premium's one purchase screen — reached the same way from every
 * gated feature (AI Chat's message cap, Whoop connect, locked analytics,
 * widget setup, program regeneration) via
 * rootNavigation.navigate('Paywall', { trigger: ... }). `trigger` only
 * changes the subhead copy; every entry point lands here.
 *
 * The purchase button is a stub — there's no RevenueCat/StoreKit/Play
 * Billing wiring yet (needs a real RevenueCat account + App Store Connect /
 * Play Console products first, none of which exist yet). Swap onStartTrial
 * for a real react-native-purchases purchase call once that's set up; the
 * entitlement plumbing it needs to write to (subscriptions table,
 * profiles.is_premium) already exists — see 0050_premium_subscriptions.sql.
 */
export function PaywallScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const trigger = route.params?.trigger;

  const onStartTrial = () => {
    Alert.alert(
      'Coming soon',
      "SetSocial Premium isn't available to purchase yet — check back soon.",
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header title="" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, flexGrow: 1 }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.sm, paddingBottom: theme.spacing.xl }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: theme.radii.lg,
              backgroundColor: theme.gradients.premium[1],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="crown" size="lg" color={theme.colors.bg.base} />
          </View>
          <Text variant="title" style={{ color: theme.colors.semantic.warning, textAlign: 'center' }}>
            SetSocial Premium
          </Text>
          <Text variant="body" color="secondary" style={{ textAlign: 'center', maxWidth: 280 }}>
            {trigger && TRIGGER_COPY[trigger] ? TRIGGER_COPY[trigger] : 'Unlock unlimited AI coaching and adaptive intelligence.'}
          </Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          {PERKS.map(perk => (
            <View
              key={perk.title}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: theme.spacing.md,
                padding: theme.spacing.md,
                backgroundColor: theme.colors.bg.surface,
                borderWidth: 1,
                borderColor: theme.colors.border.subtle,
                borderRadius: theme.radii.md,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: theme.radii.sm,
                  backgroundColor: `${theme.colors.semantic.warning}24`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={perk.icon} size="sm" color={theme.colors.semantic.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontWeight: '600' }}>
                  {perk.title}
                </Text>
                <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>
                  {perk.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ alignItems: 'center', marginTop: 'auto', paddingTop: theme.spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.xxs }}>
            <Text variant="numeralMd">$6.99</Text>
            <Text variant="body" color="secondary">
              / month
            </Text>
          </View>
          <Text variant="caption" color="secondary" style={{ marginTop: theme.spacing.xxs }}>
            7 days free, then $6.99/month — cancel anytime
          </Text>
          <Button
            label="Start Free Trial"
            onPress={onStartTrial}
            gradientColors={theme.gradients.premium}
            style={{ width: '100%', marginTop: theme.spacing.md }}
          />
          <Text
            variant="caption"
            color="secondary"
            style={{ marginTop: theme.spacing.md }}
            onPress={() => Alert.alert('Restore Purchase', "SetSocial Premium isn't available to purchase yet.")}
          >
            Restore Purchase
          </Text>
          <Text variant="caption" color="secondary" style={{ textAlign: 'center', marginTop: theme.spacing.sm, opacity: 0.7 }}>
            Auto-renews monthly until canceled.{'\n'}Terms of Use · Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
