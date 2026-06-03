import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';

function flatten(style: any): any {
  if (!style) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.flat().filter(Boolean));
  }
  return style;
}

describe('Card', () => {
  it('renders its children', () => {
    const { getByText } = render(
      <Card>
        <Text>Card content</Text>
      </Card>,
    );
    expect(getByText('Card content')).toBeTruthy();
  });

  it('renders multiple children', () => {
    const { getByText } = render(
      <Card>
        <Text>Title</Text>
        <Text>Subtitle</Text>
      </Card>,
    );
    expect(getByText('Title')).toBeTruthy();
    expect(getByText('Subtitle')).toBeTruthy();
  });

  it('applies the default card style', () => {
    const { UNSAFE_getByType } = render(
      <Card>
        <Text>Hi</Text>
      </Card>,
    );
    const container = UNSAFE_getByType(View);
    const style = flatten(container.props.style);
    expect(style.borderRadius).toBeDefined();
    expect(style.padding).toBeDefined();
    expect(style.backgroundColor).toBeDefined();
  });

  it('merges a custom style prop', () => {
    const { UNSAFE_getByType } = render(
      <Card style={{ marginTop: 42, backgroundColor: '#abcdef' }}>
        <Text>Styled</Text>
      </Card>,
    );
    const container = UNSAFE_getByType(View);
    const style = flatten(container.props.style);
    expect(style.marginTop).toBe(42);
    // custom backgroundColor overrides default since it comes later in array
    expect(style.backgroundColor).toBe('#abcdef');
  });

  it('handles null children without crashing', () => {
    const { UNSAFE_getByType } = render(<Card>{null}</Card>);
    expect(UNSAFE_getByType(View)).toBeTruthy();
  });
});
