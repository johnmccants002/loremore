import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';
import type { PhotoImport } from './repository';

export async function pickPhoto() {
  // System picker grants access only to selected photos; no broad library request.
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1, exif: true });
  return result.canceled ? null : result.assets[0] ?? null;
}

export async function preparePhoto(asset: ImagePicker.ImagePickerAsset, userId: string): Promise<PhotoImport> {
  if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) throw new Error('Choose a photo smaller than 50 MB.');
  if (asset.width <= 0 || asset.height <= 0) throw new Error('This photo could not be read. Choose another image.');
  const context = ImageManipulator.manipulate(asset.uri);
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  let uri: string | undefined;
  try {
    if (Math.max(asset.width, asset.height) > 2048) {
      context.resize(asset.width >= asset.height ? { width: 2048 } : { height: 2048 });
    }
    rendered = await context.renderAsync();
    const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
    uri = image.uri;
    const bytes = Platform.OS === 'web' ? await (await fetch(image.uri)).arrayBuffer() : await new File(image.uri).arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > 50 * 1024 * 1024) throw new Error('Choose a smaller photo.');
    // Keep a literal EXIF date rather than inventing a timezone. No GPS is stored.
    const timestamp: unknown = asset.exif?.DateTimeOriginal ?? asset.exif?.DateTime;
    return { id: randomUUID(), userId, capturedAt: new Date().toISOString(), bytes,
      width: image.width, height: image.height,
      sourceTimestamp: typeof timestamp === 'string' ? timestamp.slice(0, 100) : null };
  } finally {
    rendered?.release();
    context.release();
    if (uri && Platform.OS !== 'web') {
      try { new File(uri).delete(); } catch { /* OS also clears its cache. */ }
    }
  }
}
