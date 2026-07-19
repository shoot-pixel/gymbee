import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Button, SegmentedControl, SelectableCard } from '../../components/core';
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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.lg,
        }}
      >
        <Text
          variant="subtitle"
          color="secondary"
          onPress={() => navigation.goBack()}
          style={{ fontSize: 22 }}
        >
          ←
        </Text>
        <Text variant="title">Settings</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.colors.accent.primary} />
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

          <Button
            label="Account"
            variant="secondary"
            onPress={() => navigation.navigate('Account')}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
