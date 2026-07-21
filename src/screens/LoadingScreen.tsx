import React, { useEffect } from 'react';
import { Image, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

const BACKGROUND = require('../assets/branding/loading-screen-bg.png');

// Matches the source design's static progress bar — same screen position and
// width, so the animated indicator below replaces it in place rather than
// appearing as an unrelated new element.
const TRACK_WIDTH_FRACTION = 0.33;
const TRACK_TOP_FRACTION = 0.676;
const DOT_SIZE = 10;
const TRACK_HEIGHT = 2;

type LoadingScreenProps = {
  /** Also used as the accessibility label for the progress indicator. */
  label?: string;
};

/**
 * Full-bleed branded loading screen (src/assets/branding/loading-screen-bg.png,
 * derived from the design team's loading_screen.png) shown while app-level
 * state that gates navigation — e.g. auth hydration — is still resolving.
 * Not the same as LoadingState (components/core), which stays a small inline
 * spinner used throughout individual screens' own data-loading states.
 */
export function LoadingScreen({ label = 'Loading SoSet' }: LoadingScreenProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const trackWidth = width * TRACK_WIDTH_FRACTION;

  useEffect(() => {
    if (reducedMotion) {
      // Static, centered — matches the un-animated source design rather than
      // leaving the indicator pinned at an arbitrary edge.
      progress.value = 0.5;
      return;
    }
    progress.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reducedMotion, progress]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (trackWidth - DOT_SIZE) }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg.base }}>
      <Image source={BACKGROUND} resizeMode="cover" style={{ position: 'absolute', width, height }} />
      <View
        style={{ position: 'absolute', top: height * TRACK_TOP_FRACTION, left: (width - trackWidth) / 2, width: trackWidth }}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
      >
        <View style={{ width: trackWidth, height: DOT_SIZE, justifyContent: 'center' }}>
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: (DOT_SIZE - TRACK_HEIGHT) / 2,
              height: TRACK_HEIGHT,
              borderRadius: TRACK_HEIGHT / 2,
              backgroundColor: theme.colors.border.default,
            }}
          />
          <Animated.View
            style={[
              {
                width: DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: DOT_SIZE / 2,
                backgroundColor: theme.colors.accent.teal,
                shadowColor: theme.colors.accent.teal,
                shadowOpacity: 0.9,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 0 },
                elevation: 6,
              },
              dotStyle,
            ]}
          />
        </View>
      </View>
    </View>
  );
}
