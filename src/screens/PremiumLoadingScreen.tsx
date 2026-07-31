import React, { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { SetSocialIcon, Text } from '../components/core';
import { useTheme } from '../theme/ThemeProvider';

// Mirrors LoadingScreen's constants exactly — same mark asset, same
// correction factors, so the two screens' marks sit pixel-identically and
// swapping between them (see RootNavigator) never produces a visible jump.
const MARK_ASPECT = 220 / 174;
const MARK_WIDTH_FRACTION = 0.24;
const GLOW_TO_MARK_WIDTH_RATIO = 2.1;
const MARK_VISUAL_OFFSET_X_FRACTION = 13 / 220;
const MARK_VISUAL_OFFSET_Y_FRACTION = 1.5 / 174;
const HAIRLINE_WIDTH_FRACTION = 0.22;
const HAIRLINE_SEGMENT_FRACTION = 0.42;
const BREATH_LEG_MS = 2400;
const HAIRLINE_LEG_MS = 1400;

type PremiumLoadingScreenProps = {
  label?: string;
};

/**
 * Premium counterpart to LoadingScreen (screens/LoadingScreen.tsx) — shown
 * instead of it, for the same gating window in RootNavigator, whenever the
 * warmed profile cache says the signed-in athlete is on SetSocial Premium.
 * Identical animation/layout to LoadingScreen so switching between the two
 * reads as "the same screen, recolored," not a different loading path;
 * only the glow hue, hairline gradient, and the added PREMIUM wordmark
 * differ — see theme.gradients.premium's own comment for why gold and not
 * an invented color.
 */
export function PremiumLoadingScreen({ label = 'Loading SetSocial Premium' }: PremiumLoadingScreenProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const breath = useSharedValue(0);
  const hairlineSlide = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      breath.value = 0.5;
      hairlineSlide.value = 1;
      return;
    }
    breath.value = withRepeat(withTiming(1, { duration: BREATH_LEG_MS, easing: Easing.inOut(Easing.sin) }), -1, true);
    hairlineSlide.value = withRepeat(withTiming(1, { duration: HAIRLINE_LEG_MS, easing: Easing.inOut(Easing.cubic) }), -1, false);
  }, [reducedMotion, breath, hairlineSlide]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.45, 0.8]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [1, 1.12]) }],
  }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(breath.value, [0, 1], [1, 1.02]) }],
  }));

  const markWidth = width * MARK_WIDTH_FRACTION;
  const markHeight = markWidth / MARK_ASPECT;
  const markCorrectionX = markWidth * MARK_VISUAL_OFFSET_X_FRACTION;
  const markCorrectionY = markHeight * MARK_VISUAL_OFFSET_Y_FRACTION;
  const glowSize = markWidth * GLOW_TO_MARK_WIDTH_RATIO;
  const trackWidth = width * HAIRLINE_WIDTH_FRACTION;
  const segmentWidth = trackWidth * HAIRLINE_SEGMENT_FRACTION;

  const segmentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(hairlineSlide.value, [0, 1], [-segmentWidth, trackWidth]) }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg.base, overflow: 'hidden' }}>
      <Svg style={{ position: 'absolute' }} width={width} height={height}>
        <Defs>
          <RadialGradient id="goldBlobTop" cx="70%" cy="15%" r="45%">
            <Stop offset="0%" stopColor={theme.colors.semantic.warning} stopOpacity={0.16} />
            <Stop offset="55%" stopColor={theme.colors.semantic.warning} stopOpacity={0.06} />
            <Stop offset="100%" stopColor={theme.colors.semantic.warning} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="goldBlobBottom" cx="20%" cy="85%" r="55%">
            <Stop offset="0%" stopColor={theme.colors.semantic.warning} stopOpacity={0.12} />
            <Stop offset="55%" stopColor={theme.colors.semantic.warning} stopOpacity={0.04} />
            <Stop offset="100%" stopColor={theme.colors.semantic.warning} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#goldBlobTop)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#goldBlobBottom)" />
      </Svg>

      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        accessible
        accessibilityLabel={label}
      >
        <Animated.View style={[{ position: 'absolute', width: glowSize, height: glowSize }, glowStyle]}>
          <Svg width={glowSize} height={glowSize} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="markGlowGold" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={theme.gradients.premium[0]} stopOpacity={0.5} />
                <Stop offset="55%" stopColor={theme.gradients.premium[1]} stopOpacity={0.18} />
                <Stop offset="100%" stopColor={theme.gradients.premium[1]} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={50} cy={50} r={50} fill="url(#markGlowGold)" />
          </Svg>
        </Animated.View>

        <Animated.View style={markStyle}>
          <View style={{ transform: [{ translateX: markCorrectionX }, { translateY: markCorrectionY }] }}>
            <SetSocialIcon size={markWidth} accessibilityLabel="" />
          </View>
        </Animated.View>

        <Text
          variant="label"
          style={{
            marginTop: theme.spacing.md,
            color: theme.colors.semantic.warning,
            letterSpacing: 3,
            fontWeight: '700',
          }}
        >
          PREMIUM
        </Text>

        <View
          style={{
            marginTop: theme.spacing.lg,
            width: trackWidth,
            height: 3,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.bg.surfaceElevated,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={[
              { width: segmentWidth, height: 3, borderRadius: theme.radii.pill, overflow: 'hidden' },
              segmentStyle,
            ]}
          >
            <LinearGradient
              colors={[...theme.gradients.premium]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: '100%', height: '100%' }}
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
