import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TextInput as RNTextInput } from 'react-native';
import { TextInput } from '@/components/ui/TextInput';
import { colors } from '@/constants/theme';

describe('TextInput', () => {
  it('renders the underlying RN TextInput with the given value', () => {
    const { getByDisplayValue } = render(
      <TextInput value="hello" onChangeText={() => {}} />
    );
    expect(getByDisplayValue('hello')).toBeTruthy();
  });

  it('renders the placeholder', () => {
    const { getByPlaceholderText } = render(
      <TextInput placeholder="email" value="" onChangeText={() => {}} />
    );
    expect(getByPlaceholderText('email')).toBeTruthy();
  });

  it('does not render a label when label prop is omitted', () => {
    const { queryByText } = render(
      <TextInput placeholder="email" value="" onChangeText={() => {}} />
    );
    expect(queryByText(/.+/)).toBeNull();
  });

  it('renders the label when provided', () => {
    const { getByText } = render(
      <TextInput label="Email" placeholder="email" value="" onChangeText={() => {}} />
    );
    expect(getByText('Email')).toBeTruthy();
  });

  it('calls onChangeText when the user types', () => {
    const onChangeText = jest.fn();
    const { getByPlaceholderText } = render(
      <TextInput placeholder="email" value="" onChangeText={onChangeText} />
    );
    fireEvent.changeText(getByPlaceholderText('email'), 'hello');
    expect(onChangeText).toHaveBeenCalledWith('hello');
  });

  it('toggles focused style on focus and blur', () => {
    const { UNSAFE_getByType } = render(
      <TextInput placeholder="email" value="" onChangeText={() => {}} />
    );
    const input = UNSAFE_getByType(RNTextInput);

    // Pre-focus: style is an array including a falsy entry where `focused` style would be.
    const flattenStyle = (s: unknown): Record<string, unknown> =>
      Array.isArray(s)
        ? Object.assign({}, ...s.flat().filter(Boolean))
        : ((s ?? {}) as Record<string, unknown>);

    const initialBorderColor = flattenStyle(input.props.style).borderColor;

    fireEvent(input, 'focus');
    const focusedBorderColor = flattenStyle(input.props.style).borderColor;
    expect(focusedBorderColor).toBe(colors.pink);

    fireEvent(input, 'blur');
    const blurredBorderColor = flattenStyle(input.props.style).borderColor;
    expect(blurredBorderColor).toBe(initialBorderColor);
  });

  it('forwards additional TextInputProps (secureTextEntry, autoCapitalize)', () => {
    const { UNSAFE_getByType } = render(
      <TextInput
        placeholder="pw"
        value=""
        onChangeText={() => {}}
        secureTextEntry
        autoCapitalize="none"
      />
    );
    const input = UNSAFE_getByType(RNTextInput);
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.autoCapitalize).toBe('none');
  });

  it('merges custom style prop into the input style array', () => {
    const { UNSAFE_getByType } = render(
      <TextInput
        placeholder="email"
        value=""
        onChangeText={() => {}}
        style={{ marginTop: 42 }}
      />
    );
    const input = UNSAFE_getByType(RNTextInput);
    const flat = Array.isArray(input.props.style)
      ? Object.assign({}, ...input.props.style.flat().filter(Boolean))
      : input.props.style;
    expect(flat.marginTop).toBe(42);
  });

  it('applies a placeholderTextColor', () => {
    const { UNSAFE_getByType } = render(
      <TextInput placeholder="email" value="" onChangeText={() => {}} />
    );
    const input = UNSAFE_getByType(RNTextInput);
    expect(typeof input.props.placeholderTextColor).toBe('string');
    expect(input.props.placeholderTextColor).toBe(colors.inkMuted);
  });
});
