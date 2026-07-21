import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.8;
const DISMISS_DISTANCE_RATIO = 0.3;
const DISMISS_VELOCITY = 800;

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

/**
 * Modal-based bottom sheet used for selection flows across the app (add-to-day,
 * library card overflow menu, per-exercise metric picker). Controlled via a
 * plain `visible` boolean — stays mounted through its own close animation,
 * then unmounts, rather than disappearing the instant the caller flips the prop.
 */
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const theme = useTheme();
  const translateY = useSharedValue(SHEET_MAX_HEIGHT);
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
    } else if (rendered) {
      translateY.value = withTiming(SHEET_MAX_HEIGHT, { duration: 200 }, finished => {
        if (finished) runOnJS(setRendered)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = Gesture.Pan()
    .onChange(event => {
      translateY.value = Math.max(0, translateY.value + event.changeY);
    })
    .onEnd(event => {
      const shouldDismiss =
        translateY.value > SHEET_MAX_HEIGHT * DISMISS_DISTANCE_RATIO || event.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, SHEET_MAX_HEIGHT], [1, 0], Extrapolation.CLAMP),
  }));

  if (!rendered) return null;

  return (
    <Modal visible={rendered} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            <Animated.View
              style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }, backdropStyle]}
            />
          </Pressable>

          <GestureDetector gesture={pan}>
            <Animated.View
              style={[
                {
                  maxHeight: SHEET_MAX_HEIGHT,
                  backgroundColor: theme.colors.bg.surfaceElevated,
                  borderTopLeftRadius: theme.radii.xl,
                  borderTopRightRadius: theme.radii.xl,
                },
                theme.shadows.lg,
                sheetStyle,
              ]}
            >
              <SafeAreaView edges={['bottom']}>
                <View
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: theme.radii.pill,
                    backgroundColor: theme.colors.border.default,
                    alignSelf: 'center',
                    marginTop: theme.spacing.sm,
                  }}
                />
                {title ? (
                  <Text
                    variant="subtitle"
                    style={{
                      textAlign: 'center',
                      marginTop: theme.spacing.sm,
                      marginHorizontal: theme.spacing.lg,
                    }}
                  >
                    {title}
                  </Text>
                ) : null}
                <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }} showsVerticalScrollIndicator={false}>
                  {children}
                </ScrollView>
              </SafeAreaView>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
