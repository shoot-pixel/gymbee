import { NativeModules, Platform } from 'react-native';
import type { WidgetPayload } from './types';

type WidgetBridgeNativeModule = {
  setPayload(json: string): Promise<null>;
  reloadWidgets(): void;
};

const nativeModule = NativeModules.WidgetBridge as WidgetBridgeNativeModule | undefined;

/**
 * Fire-and-forget by design — nothing in the app should ever wait on the
 * widget refreshing. Safe to call unconditionally from day one: it's a
 * no-op on Android, and a no-op on iOS too until the WidgetBridge native
 * module (ios/GymBee/WidgetBridge) is actually wired into the Xcode
 * project, rather than throwing on an unlinked native module.
 */
export function syncWidget(payload: WidgetPayload): void {
  if (Platform.OS !== 'ios' || !nativeModule) return;
  nativeModule.setPayload(JSON.stringify(payload)).then(
    () => nativeModule.reloadWidgets(),
    () => {
      // A malformed payload rejects setPayload on the native side — nothing
      // to recover here; the next successful sync overwrites it.
    },
  );
}
