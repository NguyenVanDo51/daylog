import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { colors } from '@/constants/theme';

describe('SheetModal', () => {
  it('renders children', () => {
    const { getByText } = render(
      <SheetModal visible onClose={jest.fn()}>
        <Text>Sheet content</Text>
      </SheetModal>,
    );
    expect(getByText('Sheet content')).toBeTruthy();
  });

  it('passes detents=["auto"] by default', () => {
    const { UNSAFE_getByType } = render(
      <SheetModal visible onClose={jest.fn()}>
        <Text>x</Text>
      </SheetModal>,
    );
    const sheet = UNSAFE_getByType('TrueSheet' as unknown as React.ComponentType);
    expect(sheet.props.detents).toEqual(['auto']);
  });

  it('passes detents=[0.92] when size="large"', () => {
    const { UNSAFE_getByType } = render(
      <SheetModal visible onClose={jest.fn()} size="large">
        <Text>x</Text>
      </SheetModal>,
    );
    const sheet = UNSAFE_getByType('TrueSheet' as unknown as React.ComponentType);
    expect(sheet.props.detents).toEqual([0.92]);
  });

  it('wires onDidDismiss to onClose', () => {
    const onClose = jest.fn();
    const { UNSAFE_getByType } = render(
      <SheetModal visible={false} onClose={onClose}>
        <Text>x</Text>
      </SheetModal>,
    );
    const sheet = UNSAFE_getByType('TrueSheet' as unknown as React.ComponentType);
    sheet.props.onDidDismiss();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('passes backgroundColor from theme', () => {
    const { UNSAFE_getByType } = render(
      <SheetModal visible onClose={jest.fn()}>
        <Text>x</Text>
      </SheetModal>,
    );
    const sheet = UNSAFE_getByType('TrueSheet' as unknown as React.ComponentType);
    expect(sheet.props.backgroundColor).toBe(colors.background);
  });
});
