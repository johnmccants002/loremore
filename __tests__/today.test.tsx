import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TodayScreen } from '../src/moments/TodayScreen';
import { pickPhoto, preparePhoto } from '../src/moments/photo-picker';
import type { Moment, MomentRepository, PhotoImport } from '../src/moments/repository';
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('../src/moments/photo-picker', () => ({ pickPhoto: jest.fn(), preparePhoto: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const moment: Moment = { id: '1', captured_at: new Date().toISOString(), title: 'Coffee with a friend', note: null, kind: 'photo', source: 'manual_import', analysis_status: 'not_requested', moment_media: [] };
let repository: jest.Mocked<MomentRepository>;
beforeEach(() => {
  jest.clearAllMocks();
  repository = { listDay: jest.fn().mockResolvedValue([]), imageUrl: jest.fn(), importPhoto: jest.fn().mockResolvedValue(undefined), removeImport: jest.fn().mockResolvedValue(undefined) };
});
test('empty state and cancellation create no moment', async () => {
  await render(<TodayScreen repository={repository} userId="owner" />);
  await waitFor(() => expect(screen.getByText('Your day starts here')).toBeTruthy());
  jest.mocked(pickPhoto).mockResolvedValue(null);
  await fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }));
  expect(repository.importPhoto).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Add a photo' })).toBeEnabled();
});
test('failed feed can refresh and display moment details', async () => {
  repository.listDay.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([moment]);
  await render(<TodayScreen repository={repository} userId="owner" />);
  await waitFor(() => expect(screen.getByText(/couldn’t load today/)).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(screen.getByText('Coffee with a friend')).toBeTruthy());
  expect(screen.getByText('Saved privately')).toBeTruthy();
});
test('import failure retains the same photo for retry and refreshes on success', async () => {
  const photo = { id: 'retry-me' } as PhotoImport;
  jest.mocked(pickPhoto).mockResolvedValue({ uri: 'photo' } as Awaited<ReturnType<typeof pickPhoto>>);
  jest.mocked(preparePhoto).mockResolvedValue(photo);
  repository.importPhoto.mockRejectedValueOnce(new Error('offline'));
  await render(<TodayScreen repository={repository} userId="owner" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }));
  await waitFor(() => expect(screen.getByText(/couldn’t finish this photo/)).toBeTruthy());
  repository.listDay.mockResolvedValue([moment]);
  await fireEvent.press(screen.getByRole('button', { name: 'Retry photo import' }));
  await waitFor(() => expect(screen.getByText('Coffee with a friend')).toBeTruthy());
  expect(pickPhoto).toHaveBeenCalledTimes(1);
  expect(repository.importPhoto.mock.calls[0]![0]).toBe(photo);
  expect(repository.importPhoto.mock.calls[1]![0]).toBe(photo);
});
test('an old user’s slow response does not replace the new user’s feed', async () => {
  let resolveOld!: (value: Moment[]) => void;
  repository.listDay.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  const view = await render(<TodayScreen repository={repository} userId="old" />);
  await view.rerender(<TodayScreen repository={repository} userId="new" />);
  await waitFor(() => expect(screen.getByText('Your day starts here')).toBeTruthy());
  await act(async () => resolveOld([moment]));
  expect(screen.queryByText('Coffee with a friend')).toBeNull();
});
