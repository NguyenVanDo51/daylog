// Mocks must be declared before imports of the modules they replace.
const mockMutateAsync = jest.fn();
const mockUseCreateMilestone = jest.fn();
jest.mock('@/hooks/useMilestones', () => ({
  useCreateMilestone: () => mockUseCreateMilestone(),
}));

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { router } from 'expo-router';
import NewMilestoneScreen from '../new';

const mockRouter = router as jest.Mocked<typeof router>;

beforeEach(() => {
  jest.clearAllMocks();
  mockMutateAsync.mockResolvedValue({
    id: 'm-new',
    title: 'New One',
    note: null,
    occurred_at: '2025-11-01',
    cover_photo_id: null,
    icon: null,
  });
  mockUseCreateMilestone.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('NewMilestoneScreen', () => {
  it('renders the form: heading, three labeled inputs and the Save button', () => {
    const { getByText, getByPlaceholderText } = render(<NewMilestoneScreen />);

    expect(getByText(/New Moment/)).toBeTruthy();
    expect(getByText('Title *')).toBeTruthy();
    expect(getByText('Date')).toBeTruthy();
    expect(getByText('Note')).toBeTruthy();
    expect(getByPlaceholderText('e.g. First Steps!')).toBeTruthy();
    expect(getByPlaceholderText('YYYY-MM-DD')).toBeTruthy();
    expect(getByPlaceholderText('Tell the story...')).toBeTruthy();
    expect(getByText('Save Moment')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('pre-fills the Date input with today (YYYY-MM-DD)', () => {
    const today = new Date().toISOString().slice(0, 10);
    const { getByDisplayValue } = render(<NewMilestoneScreen />);
    expect(getByDisplayValue(today)).toBeTruthy();
  });

  it('calls router.back when the Cancel link is pressed', () => {
    const { getByText } = render(<NewMilestoneScreen />);
    fireEvent.press(getByText('Cancel'));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('alerts "Title required" and does not call the mutation when title is empty', async () => {
    const { getByText } = render(<NewMilestoneScreen />);

    await act(async () => {
      fireEvent.press(getByText('Save Moment'));
    });

    expect(Alert.alert).toHaveBeenCalledWith('Title required');
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('treats whitespace-only titles as empty (validation triggers)', async () => {
    const { getByText, getByPlaceholderText } = render(<NewMilestoneScreen />);

    fireEvent.changeText(getByPlaceholderText('e.g. First Steps!'), '   ');

    await act(async () => {
      fireEvent.press(getByText('Save Moment'));
    });

    expect(Alert.alert).toHaveBeenCalledWith('Title required');
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('submits with trimmed title, undefined note, and the date, then navigates back', async () => {
    const today = new Date().toISOString().slice(0, 10);

    const { getByText, getByPlaceholderText } = render(<NewMilestoneScreen />);
    fireEvent.changeText(getByPlaceholderText('e.g. First Steps!'), '  First Smile  ');

    await act(async () => {
      fireEvent.press(getByText('Save Moment'));
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        title: 'First Smile',
        note: undefined,
        occurred_at: today,
      });
    });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('submits with title, trimmed note and an overridden date', async () => {
    const { getByText, getByPlaceholderText } = render(<NewMilestoneScreen />);

    fireEvent.changeText(getByPlaceholderText('e.g. First Steps!'), 'First Steps');
    fireEvent.changeText(getByPlaceholderText('YYYY-MM-DD'), '2025-09-01');
    fireEvent.changeText(getByPlaceholderText('Tell the story...'), '  In the living room  ');

    await act(async () => {
      fireEvent.press(getByText('Save Moment'));
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        title: 'First Steps',
        note: 'In the living room',
        occurred_at: '2025-09-01',
      });
    });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('shows a loading indicator on the Save button while isPending is true', () => {
    mockUseCreateMilestone.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    });

    const { UNSAFE_queryAllByType, queryByText } = render(<NewMilestoneScreen />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_queryAllByType(ActivityIndicator).length).toBeGreaterThan(0);
    // While loading, the Button replaces its label text with the spinner.
    expect(queryByText('Save Moment')).toBeNull();
  });

  it('does NOT navigate back when the mutation is still pending (await unresolved)', async () => {
    // The screen `await`s mutateAsync then calls router.back. While the
    // mutation is in flight, router.back must not have been called yet.
    // (When the mutation eventually rejects, the await throws and router.back
    // still never runs — the same observable outcome from the user's POV.)
    let _resolve: ((v?: unknown) => void) | undefined;
    mockMutateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        _resolve = resolve;
      }),
    );

    const { getByText, getByPlaceholderText } = render(<NewMilestoneScreen />);
    fireEvent.changeText(getByPlaceholderText('e.g. First Steps!'), 'First Steps');

    fireEvent.press(getByText('Save Moment'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
    expect(mockRouter.back).not.toHaveBeenCalled();

    // Cleanup: resolve the pending mutation so the awaiting handler unblocks.
    await act(async () => {
      _resolve!({});
      await Promise.resolve();
    });
  });
});
