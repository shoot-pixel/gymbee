import React from 'react';
import { ScrollView, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, Card } from '../../components/core';
import { useExercise } from '../../services/api/queries/exercises';
import type { LogStackParamList, TodayStackParamList } from '../../navigation/types';

type Route = RouteProp<LogStackParamList | TodayStackParamList, 'ExerciseDetail'>;
type Nav = NativeStackNavigationProp<LogStackParamList | TodayStackParamList>;

export function ExerciseDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { data: exercise, isLoading } = useExercise(params.exerciseId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Text
            variant="subtitle"
            color="secondary"
            onPress={() => navigation.goBack()}
            style={{ fontSize: 22 }}
          >
            ←
          </Text>
          <Text variant="title">{exercise?.name ?? 'Exercise'}</Text>
        </View>

        {isLoading || !exercise ? (
          <ActivityIndicator color={theme.colors.accent.primary} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
              <View>
                <Text variant="label" color="secondary">
                  CATEGORY
                </Text>
                <Text variant="body">{exercise.category}</Text>
              </View>
              <View>
                <Text variant="label" color="secondary">
                  EQUIPMENT
                </Text>
                <Text variant="body">{exercise.equipment}</Text>
              </View>
              <View>
                <Text variant="label" color="secondary">
                  MUSCLE
                </Text>
                <Text variant="body">{exercise.primary_muscle}</Text>
              </View>
            </View>

            <Card>
              <Text variant="subtitle">How to perform it</Text>
              <Text variant="body" color="secondary" style={{ marginTop: theme.spacing.xs }}>
                {exercise.instructions ?? 'No instructions yet.'}
              </Text>
            </Card>

            {!exercise.demo_media_url ? (
              <Text variant="caption" color="tertiary">
                Demo video/image coming later — this exercise doesn't have one yet.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
