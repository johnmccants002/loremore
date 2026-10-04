import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
export type SharedPhoto = { id: string; userId: string; capturedAt: string; width: number; height: number; sizeBytes: number; uri: string; sourceTimestamp?: string };
export type NativeInbox = {
  setOwner(userId: string | null): void;
  list(userId: string): Promise<SharedPhoto[]>;
  acknowledge(userId: string, id: string): Promise<void>;
};
export const nativeInbox = Platform.OS === 'ios' ? requireOptionalNativeModule<NativeInbox>('LoreMoreShare') : null;
