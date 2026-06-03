import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ActivityIndicator, TouchableOpacity } from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/theme';

function flatten(style: any): any {
  if (!style) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.flat().filter(Boolean));
  }
  return style;
}

describe('Button', () => {
  it('renders the label', () => {
    const { getByText } = render(<Button label="Tap" onPress={jest.fn()} />);
    expect(getByText('Tap')).toBeTruthy();
  });

  it('fires onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Tap" onPress={onPress} />);
    fireEvent.press(getByText('Tap'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button label="Tap" onPress={onPress} disabled />,
    );
    fireEvent.press(getByText('Tap'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders an ActivityIndicator and marks the touchable disabled when loading', () => {
    const onPress = jest.fn();
    const { UNSAFE_getByType, queryByText } = render(
      <Button label="Tap" onPress={onPress} loading />,
    );
    // label text is replaced with spinner
    expect(queryByText('Tap')).toBeNull();
    const spinner = UNSAFE_getByType(ActivityIndicator);
    expect(spinner).toBeTruthy();

    // touchable is marked disabled so native press is a no-op
    const touchable = UNSAFE_getByType(TouchableOpacity);
    expect(touchable.props.disabled).toBe(true);
  });

  it('loading spinner color is white for primary variant', () => {
    const { UNSAFE_getByType } = render(
      <Button label="Tap" onPress={jest.fn()} loading variant="primary" />,
    );
    const spinner = UNSAFE_getByType(ActivityIndicator);
    expect(spinner.props.color).toBe(colors.white);
  });

  it('loading spinner color is primary for ghost variant', () => {
    const { UNSAFE_getByType } = render(
      <Button label="Tap" onPress={jest.fn()} loading variant="ghost" />,
    );
    const spinner = UNSAFE_getByType(ActivityIndicator);
    expect(spinner.props.color).toBe(colors.primary);
  });

  it('applies ghost variant styles', () => {
    const { UNSAFE_getByType, getByText } = render(
      <Button label="Ghost" onPress={jest.fn()} variant="ghost" />,
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    const style = flatten(touchable.props.style);
    expect(style.backgroundColor).toBe('transparent');
    expect(style.borderColor).toBe(colors.primary);

    const labelStyle = flatten(getByText('Ghost').props.style);
    expect(labelStyle.color).toBe(colors.primary);
  });

  it('applies danger variant styles', () => {
    const { UNSAFE_getByType, getByText } = render(
      <Button label="Delete" onPress={jest.fn()} variant="danger" />,
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    const style = flatten(touchable.props.style);
    expect(style.backgroundColor).toBe(colors.error);

    const labelStyle = flatten(getByText('Delete').props.style);
    expect(labelStyle.color).toBe(colors.white);
  });

  it('applies primary variant by default', () => {
    const { UNSAFE_getByType } = render(
      <Button label="Save" onPress={jest.fn()} />,
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    const style = flatten(touchable.props.style);
    expect(style.backgroundColor).toBe(colors.primary);
  });

  it('applies fullWidth style when fullWidth is true', () => {
    const { UNSAFE_getByType } = render(
      <Button label="Wide" onPress={jest.fn()} fullWidth />,
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    const style = flatten(touchable.props.style);
    expect(style.width).toBe('100%');
  });

  it('applies the disabled opacity style when disabled', () => {
    const { UNSAFE_getByType } = render(
      <Button label="Tap" onPress={jest.fn()} disabled />,
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    const style = flatten(touchable.props.style);
    expect(style.opacity).toBe(0.5);
    expect(touchable.props.disabled).toBe(true);
  });

  it('applies the disabled opacity style when loading', () => {
    const { UNSAFE_getByType } = render(
      <Button label="Tap" onPress={jest.fn()} loading />,
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    const style = flatten(touchable.props.style);
    expect(style.opacity).toBe(0.5);
  });
});
