import { preparePhoto, pickPhoto } from '../src/moments/photo-picker';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'stable-id' }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
const asset: ImagePickerAsset = { uri: 'original', width: 4000, height: 3000, fileSize: 1000, exif: { DateTimeOriginal: '2020:01:02 03:04:05', GPSLatitude: 40 } };
test('picker cancellation does not prepare a file', async () => {
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: true, assets: null });
  expect(await pickPhoto()).toBeNull();
});
test('large source files are rejected before decoding', async () => {
  await expect(preparePhoto({ ...asset, fileSize: 51 * 1024 * 1024 }, 'owner')).rejects.toThrow('50 MB');
  expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
});
test('normalizes a photo, preserves a literal source timestamp, and releases temporary resources', async () => {
  const image = { saveAsync: jest.fn().mockResolvedValue({ uri: 'temporary', width: 2048, height: 1536 }), release: jest.fn() };
  const context = { resize: jest.fn(), renderAsync: jest.fn().mockResolvedValue(image), release: jest.fn() };
  jest.mocked(ImageManipulator.manipulate).mockReturnValue(context as unknown as ReturnType<typeof ImageManipulator.manipulate>);
  const deleteFile = jest.fn();
  jest.mocked(File).mockImplementation(() => ({ arrayBuffer: async () => new ArrayBuffer(123), delete: deleteFile }) as unknown as File);
  const photo = await preparePhoto(asset, 'owner');
  expect(context.resize).toHaveBeenCalledWith({ width: 2048 });
  expect(image.saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.85 });
  expect(photo).toMatchObject({ userId: 'owner', id: 'stable-id', width: 2048, height: 1536, sourceTimestamp: '2020:01:02 03:04:05' });
  expect(photo.bytes.byteLength).toBe(123);
  expect(photo).not.toHaveProperty('exif');
  expect(image.release).toHaveBeenCalled();
  expect(context.release).toHaveBeenCalled();
  expect(deleteFile).toHaveBeenCalled();
});
