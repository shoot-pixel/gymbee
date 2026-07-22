import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, SegmentedControl, SelectableCard, Header, ListRow, LoadingState, Card } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useProfile, useUpdateProfile } from '../../services/api/queries/profiles';
import type { ProfileStackParamList } from '../../navigation/types';
import type { EquipmentType, UnitPreference } from '../../types/database';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;

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
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
