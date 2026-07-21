import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

export type SoSetLogoVariant = 'icon' | 'horizontal' | 'stacked';
export type SoSetLogoTheme = 'light-on-dark' | 'dark-on-light';

type SoSetLogoProps = {
  /** 'icon' = mark only, 'horizontal' = mark + wordmark side-by-side, 'stacked' = mark above wordmark. */
  variant?: SoSetLogoVariant;
  /** 'light-on-dark' (default) is the primary treatment for this app's dark backgrounds. */
  theme?: SoSetLogoTheme;
  /** Height of the mark in px — the wordmark (horizontal/stacked) scales off this. */
  size?: number;
  /** Announced by screen readers; defaults to "SoSet". Pass "" only when an adjacent element already labels this logo, to avoid double-announcing. */
  accessibilityLabel?: string;
};

// Real exported brand assets (from src/assets/design/iOS_icon.png and
// "SoSet Logo.png"), processed into transparent-background PNGs — see
// src/assets/branding/. Only a light-on-dark version exists since this app
// has no light theme anywhere; dark-on-light below is a geometric SVG
// approximation kept as a documented fallback for if/when a light surface
// ever needs the mark.
const MARK_SOURCE = require('../../assets/branding/soset-mark.png');
const WORDMARK_SOURCE = require('../../assets/branding/soset-wordmark.png');
/** Native pixel aspect ratios of the source assets — used to size the Image from a single `size` prop. */
const MARK_ASPECT = 810 / 786;
const WORDMARK_ASPECT = 1088 / 371;

function SoSetMarkFallbackSvg({ size }: { size: number }) {
  const theme = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M72,24 C72,10 28,12 28,32 C28,52 72,48 72,68 C72,88 28,86 26,74"
        fill="none"
        stroke={theme.colors.bg.base}
        strokeWidth={20}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </Svg>
  );
}

/** Icon-only mark — app icon reference, tab bars, compact headers. */
export function SoSetIcon({
  size = 32,
  theme = 'light-on-dark',
  accessibilityLabel = 'SoSet',
}: {
  size?: number;
  theme?: SoSetLogoTheme;
  accessibilityLabel?: string;
}) {
  return (
    <View accessible={accessibilityLabel !== ''} accessibilityRole="image" accessibilityLabel={accessibilityLabel || undefined}>
      {theme === 'light-on-dark' ? (
        <Image source={MARK_SOURCE} style={{ width: size, height: size / MARK_ASPECT }} resizeMode="contain" />
      ) : (
        <SoSetMarkFallbackSvg size={size} />
      )}
    </View>
  );
}

export function SoSetLogo({ variant = 'icon', theme = 'light-on-dark', size = 32, accessibilityLabel = 'SoSet' }: SoSetLogoProps) {
  const appTheme = useTheme();

  if (variant === 'icon') {
    return <SoSetIcon size={size} theme={theme} accessibilityLabel={accessibilityLabel} />;
  }

  if (variant === 'horizontal' && theme === 'light-on-dark') {
    // The real combined mark+wordmark lockup, used exactly as designed —
    // no separate mark/text composition needed for this treatment.
    const height = size;
    const width = height * WORDMARK_ASPECT;
    return (
      <Image
        source={WORDMARK_SOURCE}
        style={{ width, height }}
        resizeMode="contain"
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel || undefined}
      />
    );
  }

  // 'stacked' (no stacked source asset exists, only the horizontal lockup),
  // or 'horizontal' in the dark-on-light treatment — compose the real mark
  // with a code-rendered two-tone wordmark instead.
  const onDark = theme === 'light-on-dark';
  const soColor = onDark ? appTheme.colors.text.primary : appTheme.colors.bg.base;
  const setColor = appTheme.colors.accent.primary;
  const wordmarkFontSize = size * 0.9;

  // The wordmark is rendered visually (So/Set two-tone) but hidden from the
  // accessibility tree — the wrapping View below carries the single "SoSet"
  // label so a screen reader announces it once, not "So Set" split oddly.
  const wordmarkText = (
    <Text
      importantForAccessibility="no"
      style={{
        fontSize: wordmarkFontSize,
        fontWeight: '800',
        letterSpacing: -0.5,
        lineHeight: wordmarkFontSize * 1.1,
      }}
    >
      <Text style={{ fontSize: wordmarkFontSize, fontWeight: '800', color: soColor }}>So</Text>
      <Text style={{ fontSize: wordmarkFontSize, fontWeight: '800', color: setColor }}>Set</Text>
    </Text>
  );

  const containerStyle =
    variant === 'stacked'
      ? { alignItems: 'center' as const, gap: size * 0.15 }
      : { flexDirection: 'row' as const, alignItems: 'center' as const, gap: size * 0.2 };

  return (
    <View style={containerStyle} accessible={accessibilityLabel !== ''} accessibilityRole="image" accessibilityLabel={accessibilityLabel || undefined}>
      <SoSetIcon size={size} theme={theme} accessibilityLabel="" />
      {wordmarkText}
    </View>
  );
}
