import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, SegmentedControl, SelectableCard, Header, ListRow, LoadingState, Card, Icon } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useProfile, useUpdateProfile } from '../../services/api/queries/profiles';
import type { ProfileStackParamList, RootStackParamList } from '../../navigation/types';
import type { EquipmentType, UnitPreference } from '../../types/database';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;

const SUPPORT_EMAIL = 'support@setsocial.app';

/** Linking.openURL rejects (rather than resolving false) when nothing can
 * handle the URL — no Mail account configured is the common case in the
 * Simulator — so this needs its own catch instead of relying on
 * canOpenURL's result alone; falls back to just surfacing the address. */
async function contactSupport() {
  try {
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  } catch {
    Alert.alert('Email not set up', `Reach us directly at ${SUPPORT_EMAIL}.`);
  }
}

const EQUIPMENT_OPTIONS: { value: EquipmentType; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbells' },
  { value: 'machine', label: 'Machines' },
  { value: 'cable', label: 'Cable' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'band', label: 'Resistance Bands' },
  { value: 'bodyweight', label: 'Bodyweight Only' },
];

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userId = useAuthStore(state => state.userId);
  const { data: profile, isLoading } = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);

  const [equipment, setEquipment] = useState<EquipmentType[]>([]);

  // Mirror the server value into local state so toggles feel instant; re-syncs
  // whenever a fresh profile row lands (e.g. first load).
  useEffect(() => {
    if (profile) setEquipment((profile.equipment_access as EquipmentType[]) ?? []);
  }, [profile]);

  const setUnitPreference = (unit_preference: UnitPreference) => {
    updateProfile.mutate({ unit_preference });
  };

  const toggleEquipment = (item: EquipmentType) => {
    const next = equipment.includes(item)
      ? equipment.filter(e => e !== item)
      : [...equipment, item];
    setEquipment(next);
    updateProfile.mutate({ equipment_access: next });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Header title="Settings" />

      {isLoading ? (
        <LoadingState />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: theme.spacing.lg,
            paddingTop: 0,
            gap: theme.spacing.xl,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              padding: theme.spacing.md,
              borderRadius: theme.radii.lg,
              borderWidth: 1,
              backgroundColor: `${theme.colors.semantic.warning}14`,
              borderColor: `${theme.colors.semantic.warning}59`,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: theme.radii.md,
                backgroundColor: theme.gradients.premium[1],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="crown" size="sm" color={theme.colors.bg.base} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="body" style={{ fontWeight: '700' }}>
                {profile?.is_premium ? 'SetSocial Premium — Active' : 'SetSocial Premium'}
              </Text>
              <Text variant="caption" color="secondary" style={{ marginTop: 1 }}>
                {profile?.is_premium
                  ? 'Unlimited AI Coach, adaptive intelligence, and more'
                  : 'Unlock unlimited AI coaching and adaptive intelligence'}
              </Text>
            </View>
            {!profile?.is_premium ? (
              <Text
                variant="caption"
                style={{ color: theme.colors.semantic.warning, fontWeight: '700' }}
                onPress={() => rootNavigation.navigate('Paywall')}
              >
                Upgrade
              </Text>
            ) : null}
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" color="secondary">
              UNITS
            </Text>
            <SegmentedControl
              options={[
                { value: 'kg', label: 'Kilograms' },
                { value: 'lb', label: 'Pounds' },
              ]}
              value={profile?.unit_preference ?? 'kg'}
              onChange={setUnitPreference}
            />
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" color="secondary">
              EQUIPMENT ACCESS
            </Text>
            <Text variant="caption" color="secondary">
              Used to tailor exercises when a new program is generated.
            </Text>
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
              {EQUIPMENT_OPTIONS.map(option => (
                <SelectableCard
                  key={option.value}
                  label={option.label}
                  selected={equipment.includes(option.value)}
                  onPress={() => toggleEquipment(option.value)}
                />
              ))}
            </View>
          </View>

          <Card variant="elevated" style={{ gap: 0 }}>
            <ListRow title="Account" icon="user" showChevron onPress={() => navigation.navigate('Account')} />
            <ListRow
              title="Notifications"
              icon="bell"
              showChevron
              onPress={() => navigation.navigate('NotificationSettings')}
              style={{ borderTopWidth: 1, borderTopColor: theme.colors.border.subtle }}
            />
            <ListRow
              title="Privacy"
              icon="lock"
              showChevron
              onPress={() => navigation.navigate('Privacy')}
              style={{ borderTopWidth: 1, borderTopColor: theme.colors.border.subtle }}
            />
            <ListRow
              title="Blocked Users"
              icon="circleAlert"
              showChevron
              onPress={() => navigation.navigate('BlockedUsers')}
              style={{ borderTopWidth: 1, borderTopColor: theme.colors.border.subtle }}
            />
            <ListRow
              title="Integrations"
              icon="repeat"
              showChevron
              onPress={() => navigation.navigate('Integrations')}
              style={{ borderTopWidth: 1, borderTopColor: theme.colors.border.subtle }}
            />
            <ListRow
              title="Contact Support"
              icon="mail"
              onPress={contactSupport}
              style={{ borderTopWidth: 1, borderTopColor: theme.colors.border.subtle }}
            />
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
