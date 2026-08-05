import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card, Text, Icon, Button, ListRow, EmptyState, Numeral } from '../../components/core';
import type { NutritionGoal } from '../../types/database';
import type { DailyEnergyTotals } from '../../utils/energyBalance';

export type EnergyTodayEntry = {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type MacroTargets = { proteinTargetG: number; carbsTargetG: number; fatTargetG: number };

type EnergyTodayCardProps = {
  entries: EnergyTodayEntry[];
  totals: DailyEnergyTotals;
  goal: NutritionGoal;
  macroTargets: MacroTargets;
  /** Composed by coachingEngine.generateEnergySummary — this card only
   * renders it, same "engine composes, screen renders" split AiSummaryCard
   * already uses for todayFocusSummary. */
  insightHeadline: string;
  insightBody: string;
  onLogMeal: () => void;
};

const GOAL_PILL_LABEL: Record<NutritionGoal, string> = {
  cut: 'Cutting',
  bulk: 'Bulking',
  maintain: 'Maintaining',
};

function formatSigned(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${Math.abs(rounded).toLocaleString()}`;
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const theme = useTheme();
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <View style={{ gap: theme.spacing.xxs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color="secondary">
          {label}
        </Text>
        <Text variant="caption" style={{ fontWeight: '700' }}>
          {Math.round(value)}g / {Math.round(target)}g
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: theme.radii.xs,
          backgroundColor: theme.colors.bg.surfaceElevated,
          overflow: 'hidden',
        }}
      >
        <View style={{ height: '100%', width: `${pct}%`, borderRadius: theme.radii.xs, backgroundColor: color }} />
      </View>
    </View>
  );
}

/**
 * Home's daily energy-balance card — merges the running In/Out numbers,
 * macros, and today's logged meals into one card rather than three, the
 * same consolidation VitalsTile already uses for weight/consistency/streak.
 * Plain `Card`, not `AiCard`'s corner-bloom treatment: most of this card is
 * raw data, not AI-synthesized content, so only the one composed insight
 * line gets an accent marker (the purple "zap" icon — AI/insight's own
 * secondary accent per theme/tokens.ts) rather than the whole card.
 */
export function EnergyTodayCard({
  entries,
  totals,
  goal,
  macroTargets,
  insightHeadline,
  insightBody,
  onLogMeal,
}: EnergyTodayCardProps) {
  const theme = useTheme();
  const hasEntries = entries.length > 0;
  const shownEntries = entries.slice(0, 3);

  return (
    <Card variant="elevated" style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="subtitle">Energy today</Text>
        <View
          style={{
            backgroundColor: theme.colors.accent.subtle,
            borderRadius: theme.radii.pill,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xxs,
          }}
        >
          <Text variant="label" style={{ color: theme.colors.accent.primary }}>
            {GOAL_PILL_LABEL[goal].toUpperCase()}
          </Text>
        </View>
      </View>

      {insightHeadline || insightBody ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'flex-start' }}>
          <Icon name="zap" size="sm" color={theme.colors.accent.purple} />
          <View style={{ flex: 1 }}>
            {insightHeadline ? (
              <Text variant="body" style={{ fontWeight: '700' }}>
                {insightHeadline}
              </Text>
            ) : null}
            {insightBody ? (
              <Text variant="caption" color="secondary">
                {insightBody}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {hasEntries ? (
        <>
          <View>
            <Numeral
              value={formatSigned(totals.net)}
              size="xl"
              color={totals.net <= 0 ? theme.colors.accent.primary : theme.colors.accent.orange}
            />
            <Text variant="caption" color="tertiary">
              Net today · In {totals.caloriesIn.toLocaleString()} · Out {totals.caloriesOut.toLocaleString()}
            </Text>
            {!totals.hasEnoughProfileData ? (
              <Text variant="caption" color="tertiary" style={{ marginTop: theme.spacing.xxs }}>
                Using an estimated baseline — add your height, weight and sex in Settings for a more accurate number.
              </Text>
            ) : null}
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <MacroBar label="Protein" value={totals.proteinG} target={macroTargets.proteinTargetG} color={theme.colors.accent.blue} />
            <MacroBar label="Carbs" value={totals.carbsG} target={macroTargets.carbsTargetG} color={theme.colors.accent.teal} />
            <MacroBar label="Fat" value={totals.fatG} target={macroTargets.fatTargetG} color={theme.colors.accent.orange} />
          </View>

          <View>
            {shownEntries.map((entry, index) => (
              <ListRow
                key={entry.id}
                icon="flame"
                title={entry.name}
                subtitle={`${Math.round(entry.protein_g)}p / ${Math.round(entry.carbs_g)}c / ${Math.round(entry.fat_g)}f`}
                trailing={
                  <Text variant="body" style={{ fontWeight: '700' }}>
                    {entry.calories}
                  </Text>
                }
                style={index > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border.subtle } : undefined}
              />
            ))}
            {entries.length > shownEntries.length ? (
              <Text variant="caption" color="tertiary" style={{ paddingTop: theme.spacing.xxs }}>
                + {entries.length - shownEntries.length} more
              </Text>
            ) : null}
          </View>

          <Button label="Log a meal" variant="secondary" icon="plusCircle" onPress={onLogMeal} />
        </>
      ) : (
        <EmptyState
          icon="flame"
          title="Nothing logged yet today"
          description="Log your next meal and I'll track the rest."
          actionLabel="Log a meal"
          onAction={onLogMeal}
        />
      )}
    </Card>
  );
}
