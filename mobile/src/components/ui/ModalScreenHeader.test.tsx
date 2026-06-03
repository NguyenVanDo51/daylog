import React from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { ModalScreenHeader } from '@/components/ui/ModalScreenHeader';
import { colors, spacing } from '@/constants/theme';

function flatten(style: any): any {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.flat().filter(Boolean));
  return style;
}

describe('ModalScreenHeader', () => {
  it('renders the title', () => {
    const { getByText } = render(<ModalScreenHeader title="New Moment 🌟" />);
    expect(getByText('New Moment 🌟')).toBeTruthy();
  });

  it('renders left slot when provided', () => {
    const { getByText } = render(
      <ModalScreenHeader title="Title" left={<Text>Back</Text>} />,
    );
    expect(getByText('Back')).toBeTruthy();
  });

  it('renders right slot when provided', () => {
    const { getByText } = render(
      <ModalScreenHeader title="Title" right={<Text>Cancel</Text>} />,
    );
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('applies textPrimary color to title', () => {
    const { getByText } = render(<ModalScreenHeader title="Title" />);
    const style = flatten(getByText('Title').props.style);
    expect(style.color).toBe(colors.textPrimary);
  });

  it('applies paddingTop of spacing["4xl"] to the header row', () => {
    const { UNSAFE_getByType } = render(<ModalScreenHeader title="Title" />);
    // outermost View is the header container
    const view = UNSAFE_getByType(View);
    const style = flatten(view.props.style);
    expect(style.paddingTop).toBe(spacing['4xl']);
  });

  it('renders without left or right slots', () => {
    const { getByText } = render(<ModalScreenHeader title="Solo" />);
    expect(getByText('Solo')).toBeTruthy();
  });
});
