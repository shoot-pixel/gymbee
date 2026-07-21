import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Icon, type IconName } from '../../components/core';
import type { ReadinessBand } from '../../services/coaching';

type AiSummaryCardProps = {
  headline: string;
  summary: string;
  band: ReadinessBand | null;
  isRestDay: boolean;
};

function iconFor(band: ReadinessBand | null, isRestDay: boolean): IconName {
  if (isRestDay) return 'moon';
  if (band === 'high' || band === 'moderate') return 'zap';
  if (band === 'low' || band === 'very_low') return 'moon';
  return 'info';
}

/** Home's pre-workout synthesis card — data comes from coachingEngine.generateTodayFocusSummary, this just renders it (same "engine composes, screen renders" split every other coaching surface uses). Renders nothing when there's no summary to show (AI coaching disabled, or nothing computed yet). */
export function AiSummaryCard({ headline, summary, band, isRestDay }: AiSummaryCardProps) {
  const theme = useTheme();
  if (!summary) return null;

  return (
    <Card variant="elevated" style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Icon name={iconFor(band, isRestDay)} size="md" color={theme.colors.accent.primary} />
        <Text variant="subtitle">AI Summary</Text>
      </View>
      {headline ? (
        <Text variant="body" style={{ fontWeight: '700' }}>
          {headline}
        </Text>
      ) : null}
      <Text variant="body" color="secondary">
        {summary}
      </Text>
    </Card>
  );
}
