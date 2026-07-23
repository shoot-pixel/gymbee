import React, { useEffect } from 'react';
import { Image, useWindowDimensions, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
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
const TRACK_HEIGHT = 2;
// Fraction of the track's width the glowing streak covers.
const STREAK_WIDTH_FRACTION = 0.42;
const STREAK_HEIGHT = 6;
// One full back-and-forth loop (there and back) takes this long — a single
// leg (withTiming's own duration) is half of it, since withRepeat's
// reverse=true plays the timing forward then backward as the two halves
// of one cycle.
const CYCLE_DURATION_MS = 3000;

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
  const streakWidth = trackWidth * STREAK_WIDTH_FRACTION;

  useEffect(() => {
    if (reducedMotion) {
      // Static, centered — matches the un-animated source design rather than
      // leaving the indicator pinned at an arbitrary edge.
      progress.value = 0.5;
      return;
    }
    // withRepeat's reverse=true plays this timing forward then backward as
    // the two legs of one loop, so halving the cycle duration here is what
    // makes a full there-and-back pass take CYCLE_DURATION_MS.
    progress.value = withRepeat(
      withTiming(1, { duration: CYCLE_DURATION_MS / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [reducedMotion, progress]);

  const streakStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (trackWidth - streakWidth) }],
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
        <View style={{ width: trackWidth, height: STREAK_HEIGHT, justifyContent: 'center' }}>
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: (STREAK_HEIGHT - TRACK_HEIGHT) / 2,
              height: TRACK_HEIGHT,
              borderRadius: TRACK_HEIGHT / 2,
              backgroundColor: theme.colors.border.default,
            }}
          />
          <Animated.View
            style={[
              {
                width: streakWidth,
                height: STREAK_HEIGHT,
                borderRadius: STREAK_HEIGHT / 2,
                shadowColor: theme.colors.accent.teal,
                shadowOpacity: 0.9,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 0 },
                elevation: 6,
              },
              streakStyle,
            ]}
          >
            <LinearGradient
              colors={['rgba(0,216,180,0)', theme.colors.accent.teal, 'rgba(0,216,180,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1, borderRadius: STREAK_HEIGHT / 2 }}
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
