import React, { useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Numeral } from '../../components/core';
import { useActiveWorkoutStore } from '../../store/activeWorkoutStore';

/** Ticks the shared rest-timer countdown every second while it's running. */
function useRestTimerTicker() {
  const restRunning = useActiveWorkoutStore(state => state.restRunning);
  const tickRestTimer = useActiveWorkoutStore(state => state.tickRestTimer);

  useEffect(() => {
    if (!restRunning) return;
    const interval = setInterval(tickRestTimer, 1000);
    return () => clearInterval(interval);
  }, [restRunning, tickRestTimer]);
}

export function RestTimerBanner() {
  const theme = useTheme();
  useRestTimerTicker();
  const restRunning = useActiveWorkoutStore(state => state.restRunning);
  const restSecondsRemaining = useActiveWorkoutStore(state => state.restSecondsRemaining);
  const skipRestTimer = useActiveWorkoutStore(state => state.skipRestTimer);

  if (!restRunning) return null;

  const minutes = Math.floor(restSecondsRemaining / 60);
  const seconds = restSecondsRemaining % 60;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.bg.surfaceElevated,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: theme.colors.accent.primary,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <View>
        <Text variant="label" color="secondary">
          RESTING
        </Text>
        <Numeral value={`${minutes}:${seconds.toString().padStart(2, '0')}`} size="md" />
      </View>
      <Pressable onPress={skipRestTimer}>
        <Text variant="subtitle" style={{ color: theme.colors.accent.primary }}>
          Skip
        </Text>
      </Pressable>
    </View>
  );
}
