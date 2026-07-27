import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, AiCard, Icon, IconButton, type IconName } from '../../components/core';
import type { ReadinessBand } from '../../services/coaching';
import { useCoachSummaryStore } from '../../store/coachSummaryStore';

type AiSummaryCardProps = {
  headline: string;
  summary: string;
  band: ReadinessBand | null;
  isRestDay: boolean;
};

function iconFor(band: ReadinessBand | null, isRestDay: boolean): IconName {
  if (isRestDay) return 'moon';
  if (band === 'high' || band === 'moderate') return 'megaphone';
  if (band === 'low' || band === 'very_low') return 'moon';
  return 'info';
}

/** Home's pre-workout synthesis card — data comes from coachingEngine.generateTodayFocusSummary, this just renders it (same "engine composes, screen renders" split every other coaching surface uses). Renders nothing when there's no summary to show (AI coaching disabled, nothing computed yet, or the athlete dismissed it this session — see useCoachSummaryStore, which resets on the next app launch rather than persisting the dismissal). */
export function AiSummaryCard({ headline, summary, band, isRestDay }: AiSummaryCardProps) {
  const theme = useTheme();
  const dismissed = useCoachSummaryStore(state => state.dismissed);
  const dismiss = useCoachSummaryStore(state => state.dismiss);
  if (!summary || dismissed) return null;

  return (
    <AiCard style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Icon name={iconFor(band, isRestDay)} size="md" color={theme.colors.accent.primary} />
        <Text variant="subtitle" style={{ flex: 1 }}>
          Coach Summary
        </Text>
        <IconButton name="x" variant="ghost" size={28} accessibilityLabel="Dismiss coach summary" onPress={dismiss} />
      </View>
      {headline ? (
        <Text variant="body" style={{ fontWeight: '700' }}>
          {headline}
        </Text>
      ) : null}
      <Text variant="body" color="secondary">
        {summary}
      </Text>
    </AiCard>
  );
}
