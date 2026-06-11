jest.mock('phosphor-react-native', () => new Proxy({}, { get: (_, name) => String(name) }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MediaCaption } from '@/components/ui/MediaCaption';

describe('MediaCaption', () => {
  it('renders the time string', () => {
    const { getByTestId } = render(<MediaCaption time="14:32" />);
    expect(getByTestId('media-caption-time').props.children).toBe('14:32');
  });

  it('renders static caption Text when editable is false', () => {
    const { getByTestId } = render(<MediaCaption time="14:32" caption="Buổi sáng" />);
    expect(getByTestId('media-caption-text').props.children).toBe('Buổi sáng');
  });

  it('renders nothing for caption when editable=false and caption is absent', () => {
    const { queryByTestId } = render(<MediaCaption time="14:32" />);
    expect(queryByTestId('media-caption-text')).toBeNull();
  });

  it('renders a TextInput with testID forwarded when editable=true', () => {
    const { getByTestId } = render(
      <MediaCaption
        time="14:32"
        caption=""
        editable
        onCaptionChange={jest.fn()}
        testID="review-note-input"
      />,
    );
    expect(getByTestId('review-note-input')).toBeTruthy();
  });

  it('calls onCaptionChange when text changes in editable mode', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <MediaCaption time="14:32" editable onCaptionChange={onChange} testID="my-input" />,
    );
    fireEvent.changeText(getByTestId('my-input'), 'new text');
    expect(onChange).toHaveBeenCalledWith('new text');
  });
});
