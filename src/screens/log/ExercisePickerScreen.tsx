import React, { useState } from 'react';
import { FlatList, View, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text, TextField } from '../../components/core';
import { useExercises } from '../../services/api/queries/exercises';
import { useActiveWorkoutStore } from '../../store/activeWorkoutStore';
import type { LogStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<LogStackParamList>;
type Route = RouteProp<LogStackParamList, 'ExercisePicker'>;

export function ExercisePickerScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const selectMode = params?.selectMode ?? false;
  const addExercise = useActiveWorkoutStore(state => state.addExercise);
  const [search, setSearch] = useState('');
  const { data: exercises, isLoading } = useExercises(search);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md, flex: 1 }}>
        <Text variant="title">Exercise Library</Text>
        <TextField
          placeholder="Search exercises…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />

        {isLoading ? (
          <ActivityIndicator color={theme.colors.accent.primary} />
        ) : (
          <FlatList
            data={exercises ?? []}
            keyExtractor={item => item.id}
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: theme.colors.border.default }} />
            )}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  if (selectMode) {
                    addExercise({ exerciseId: item.id, exerciseName: item.name });
                    navigation.goBack();
                  } else {
                    navigation.navigate('ExerciseDetail', { exerciseId: item.id });
                  }
                }}
                style={{ paddingVertical: theme.spacing.md }}
              >
                <Text variant="body">{item.name}</Text>
                <Text variant="caption" color="secondary">
                  {item.category} · {item.equipment} · {item.primary_muscle}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text variant="body" color="secondary">
                No exercises match "{search}".
              </Text>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
