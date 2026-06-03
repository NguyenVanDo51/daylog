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

  it('passes sizes=["auto"] by default', () => {
    const { UNSAFE_getByType } = render(
      <SheetModal visible onClose={jest.fn()}>
        <Text>x</Text>
      </SheetModal>,
    );
    const sheet = UNSAFE_getByType('TrueSheet' as unknown as React.ComponentType);
    expect(sheet.props.sizes).toEqual(['auto']);
  });

  it('passes sizes=["92%"] when size="large"', () => {
    const { UNSAFE_getByType } = render(
      <SheetModal visible onClose={jest.fn()} size="large">
        <Text>x</Text>
      </SheetModal>,
    );
    const sheet = UNSAFE_getByType('TrueSheet' as unknown as React.ComponentType);
    expect(sheet.props.sizes).toEqual(['92%']);
  });

  it('wires onDismiss to onClose', () => {
    const onClose = jest.fn();
    const { UNSAFE_getByType } = render(
      <SheetModal visible={false} onClose={onClose}>
        <Text>x</Text>
      </SheetModal>,
    );
    const sheet = UNSAFE_getByType('TrueSheet' as unknown as React.ComponentType);
    sheet.props.onDismiss();
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
