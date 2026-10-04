import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MomentDetail } from '../src/moments/MomentDetail';
import type { Moment, MomentRepository } from '../src/moments/repository';
jest.mock('expo-router', () => ({ Link: require('react-native').Text }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const moment: Moment = { id: '1', captured_at: new Date().toISOString(), title: 'A quiet desk', note: null, kind: 'photo', source: 'manual_import', analysis_status: 'complete', moment_media: [], ai_context: { summary: 'A notebook beside a cup.', likely_activity: 'Possibly writing', confidence: 'low', uncertainty: 'The purpose is unclear.', reflection_questions: ['What mattered here?'] } };
function repo(): jest.Mocked<MomentRepository> { return { getMoment: jest.fn().mockResolvedValue(moment), requestAnalysis: jest.fn().mockResolvedValue(undefined), listDay: jest.fn(), imageUrl: jest.fn(), importPhoto: jest.fn(), removeImport: jest.fn() }; }
test('detail presents context as a hypothesis with confidence and questions', async () => {
  await render(<MomentDetail id="1" userId="owner" repository={repo()} goBack={jest.fn()} />);
  await waitFor(() => expect(screen.getByText('A notebook beside a cup.')).toBeTruthy());
  expect(screen.getByText(/not a factual record/)).toBeTruthy();
  expect(screen.getByText('Confidence: low')).toBeTruthy();
  expect(screen.getByText('The purpose is unclear.')).toBeTruthy();
  expect(screen.getByText('1. What mattered here?')).toBeTruthy();
});
test('failed analysis offers retry and reloads persisted context', async () => {
  const repository = repo();
  repository.getMoment.mockResolvedValueOnce({ ...moment, analysis_status: 'failed', ai_context: {} });
  await render(<MomentDetail id="1" userId="owner" repository={repository} goBack={jest.fn()} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Retry AI context' })).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Retry AI context' }));
  await waitFor(() => expect(screen.getByText('A notebook beside a cup.')).toBeTruthy());
  expect(repository.requestAnalysis).toHaveBeenCalledWith('1');
});
test('unavailable or foreign moment displays no private content', async () => {
  const repository = repo(); repository.getMoment.mockResolvedValue(null);
  await render(<MomentDetail id="foreign" userId="owner" repository={repository} goBack={jest.fn()} />);
  await waitFor(() => expect(screen.getByText('This moment is unavailable.')).toBeTruthy());
  expect(screen.queryByText('A quiet desk')).toBeNull();
  expect(repository.getMoment).toHaveBeenCalledWith('owner','foreign');
});
