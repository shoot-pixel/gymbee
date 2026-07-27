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

function withTiming(toValue, _config, callback) {
  // Real reanimated calls the completion callback (with `finished: true`)
  // asynchronously once the animation finishes — components like
  // BottomSheet gate real work (unmounting, an onDismissed side effect) on
  // it. Firing it synchronously here is the closest a JS-thread mock can get
  // without an actual animation clock, and is what those call sites need to
  // be exercised by tests at all.
  if (callback) callback(true);
  return toValue;
}

function withSpring(toValue) {
  return toValue;
}

function withRepeat(animation) {
  return animation;
}

function withSequence(...animations) {
  return animations[animations.length - 1];
}

function withDelay(_delayMs, animation) {
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
  out: fn => fn,
  in: fn => fn,
  cubic: value => value,
  quad: value => value,
};

const Animated = {
  createAnimatedComponent: Component => Component,
  View: require('react-native').View,
  Text: require('react-native').Text,
  Image: require('react-native').Image,
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
  withSequence,
  withDelay,
  useReducedMotion,
  interpolate,
  runOnJS,
  Extrapolation,
  Easing,
};
