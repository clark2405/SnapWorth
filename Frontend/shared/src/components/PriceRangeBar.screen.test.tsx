import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { tokens } from '../design';
import { renderScreen } from '../testing/render-screen';
import { PriceRangeBar } from './PriceRangeBar';

const peso = (value: number) => `₱${value}`;

/** The row that holds the key under the ruler: the nearest ancestor with the key's own gap. */
function legendOf(text: string) {
  let node = screen.getByText(text).parent;
  while (node && StyleSheet.flatten(node.props.style)?.gap !== tokens.spacing[3]) {
    node = node.parent;
  }
  return StyleSheet.flatten(node?.props.style);
}

describe('PriceRangeBar: the key under the ruler', () => {
  it('puts the asking price at the left when it is the only thing in the key', () => {
    renderScreen(
      <PriceRangeBar low={1200} high={1800} estimate={1500} asking={1400} format={peso} />,
    );

    expect(screen.getByText('Asking ₱1400')).toBeOnTheScreen();
    const legend = legendOf('Asking ₱1400');
    expect(legend.flexDirection).toBe('row');
    expect(legend.justifyContent).toBeUndefined();
  });

  it('keeps the confidence at the left and the asking price at the right when both show', () => {
    renderScreen(
      <PriceRangeBar
        low={1200}
        high={1800}
        estimate={1500}
        asking={1400}
        confidence="high"
        format={peso}
      />,
    );

    expect(screen.getByText('High confidence')).toBeOnTheScreen();
    expect(legendOf('Asking ₱1400').justifyContent).toBe('space-between');
  });
});
