/**
 * Reanimated 4 (worklets-based, New Architecture only) has no working Jest
 * mock for this environment — its official mock.js still touches native
 * worklets bindings that don't exist under Jest. This is a minimal manual
 * mock covering exactly what the design system's components use (Button.tsx,
 * BottomSheet.tsx), auto-applied by Jest for any import of
 * 'react-native-reanimated'.
 */
const React = require('react');

function useSharedValue(initialValue) {
  return React.useRef({ value: initialValue }).current;
}

function useAnimatedStyle(styleFactory) {
  return styleFactory();
}

function withTiming(toValue) {
  return toValue;
}

function withSpring(toValue) {
  return toValue;
}

function withRepeat(animation) {
  return animation;
}

function useReducedMotion() {
  return false;
}

function interpolate(value, input, output) {
  return output[0];
}

function runOnJS(fn) {
  return fn;
}

const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };

const Easing = {
  ease: value => value,
  inOut: fn => fn,
  linear: value => value,
};

const Animated = {
  createAnimatedComponent: Component => Component,
  View: require('react-native').View,
  Text: require('react-native').Text,
  ScrollView: require('react-native').ScrollView,
};

module.exports = {
  __esModule: true,
  default: Animated,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  useReducedMotion,
  interpolate,
  runOnJS,
  Extrapolation,
  Easing,
};
