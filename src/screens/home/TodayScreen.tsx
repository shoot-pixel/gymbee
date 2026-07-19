import React from 'react';
import { ScrollView, View, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card, Button, StatTile, ProgressRing, Numeral } from '../../components/core';
import { useAuthStore } from '../../store/authStore';
import { useActiveProgramTree, getTodayProgramDay } from '../../services/api/queries/programs';
import type { RootStackParamList, TodayStackParamList } from '../../navigation/types';

export function TodayScreen() {
  const theme = useTheme();
  const userId = useAuthStore(state => state.userId);
  const { data: program, isLoading } = useActiveProgramTree(userId);
  // Profile lives on the root stack, not the Today tab stack — navigate()
  // bubbles up to find it since 'Profile' isn't a route in this navigator.
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const todayNavigation = useNavigation<NativeStackNavigationProp<TodayStackParamList>>();

  const resolved = getTodayProgramDay(program);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text variant="label" color="secondary">
              TODAY
            </Text>
            <Text variant="title">{program?.title ?? 'Welcome back'}</Text>
          </View>
          <Pressable
            onPress={() => rootNavigation.navigate('Profile', { screen: 'Profile' })}
            style={{
              width: 40,
              height: 40,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.bg.surfaceElevated,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="subtitle">🐝</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator color={theme.colors.accent.primary} />
        ) : !program ? (
          <Card style={{ alignItems: 'center', gap: theme.spacing.md }}>
            <ProgressRing progress={0} centerValue="0/0" label="sets today" />
            <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
              No active program yet. Complete onboarding to get an AI-generated plan.
            </Text>
            <Button label="Start Onboarding" onPress={() => {}} />
          </Card>
        ) : !resolved || resolved.day.is_rest_day ? (
          <Card style={{ alignItems: 'center', gap: theme.spacing.md }}>
            <Text variant="numeralLg">😴</Text>
            <Text variant="subtitle">Rest day</Text>
            <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
              Recovery is part of the program. Back at it next session.
            </Text>
          </Card>
        ) : (
          <Card style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text variant="label" color="secondary">
                  WEEK {resolved.week.week_number}
                  {resolved.week.deload ? ' · DELOAD' : ''}
                </Text>
                <Text variant="subtitle">{resolved.day.title ?? 'Training Day'}</Text>
              </View>
              <Numeral value={resolved.day.program_exercises.length} />
            </View>

            {resolved.day.program_exercises.map(pe => (
              <View
                key={pe.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: theme.spacing.xs,
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.border.default,
                }}
              >
                <Text variant="body">{pe.exercises.name}</Text>
                <Text variant="body" color="secondary">
                  {pe.target_sets} × {pe.target_reps_min}
                  {pe.target_reps_max && pe.target_reps_max !== pe.target_reps_min
                    ? `-${pe.target_reps_max}`
                    : ''}
                </Text>
              </View>
            ))}

            <Button
              label="View Day"
              onPress={() => todayNavigation.navigate('DayDetail', { programDayId: resolved.day.id })}
            />
          </Card>
        )}

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <StatTile label="This Week" value={program ? `${program.days_per_week} sessions` : '0 sessions'} />
          </View>
          <View style={{ flex: 1 }}>
            <StatTile label="Streak" value="0" trend={{ direction: 'flat', label: 'days' }} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
