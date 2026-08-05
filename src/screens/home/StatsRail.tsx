import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { PrForecastCard } from './PrForecastCard';
import { VitalsTile } from './VitalsTile';
import type { PrPrediction } from '../../services/coaching';
import type { UnitPreference } from '../../types/database';

type StatsRailProps = {
  userId: string | null;
  prediction: PrPrediction | null;
  unitPref: UnitPreference;
  streak: number;
};

/** Home's stats tier — the PR forecast card (still owns its own gating),
 * stacked above the merged weight/consistency/streak vitals card (see
 * VitalsTile). Both are full-width, matching the rest of Home's cards. */
export function StatsRail({ userId, prediction, unitPref, streak }: StatsRailProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <PrForecastCard prediction={prediction} unitPref={unitPref} />
      <VitalsTile userId={userId} streak={streak} />
    </View>
  );
}
