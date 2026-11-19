import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '../../testing/render-screen';
import { CaptureResultScene, EstimateRange, EstimatingScene } from './EstimatingScene';

const peso = (amount: number) => `₱${amount.toLocaleString('en-PH')}`;

describe('the snap screens: pricing and the result', () => {
  it('looks first, then prices, saying only what the phone really found', () => {
    const onClose = jest.fn();
    const { rerender } = renderScreen(
      <EstimatingScene photoUri="file:///jacket.jpg" stage="looking" onClose={onClose} />,
    );

    expect(screen.getByLabelText('Your photo')).toBeTruthy();
    expect(screen.getByText('Let me take a look…')).toBeTruthy();
    expect(screen.getByLabelText('Step 1 of 3, looking')).toBeTruthy();
    // Nothing found yet: only the "still checking" sticker, and no invented label.
    expect(screen.queryByText('LABEL')).toBeNull();
    expect(screen.getByLabelText('Working out the price')).toBeTruthy();

    rerender(
      <EstimatingScene
        photoUri="file:///jacket.jpg"
        stage="estimating"
        looksLike="windbreaker · Nike"
        labelRead="NIKE"
        onClose={onClose}
      />,
    );
    expect(screen.getByText('Windbreaker. Pricing it…')).toBeTruthy();
    expect(screen.getByLabelText('LABEL: “NIKE”')).toBeTruthy();
    expect(screen.getByLabelText('LOOKS LIKE: windbreaker · Nike')).toBeTruthy();
    // Two found stickers already: the checking one steps aside so the photo isn't buried.
    expect(screen.queryByText('CHECKING')).toBeNull();

    fireEvent.press(screen.getByLabelText('Close camera'));
    expect(onClose).toHaveBeenCalled();
  });

  it('lands the price on the tag, with the item named in the band', () => {
    renderScreen(
      <CaptureResultScene
        photoUri="file:///jacket.jpg"
        eyebrow="PRICED BY WORTHY"
        title="90s Nike windbreaker"
        amountPhp={1450}
        formatPrice={peso}
        found={[{ label: 'LABEL', value: '“NIKE”' }]}
      />,
    );

    expect(screen.getByLabelText('Your captured photo')).toBeTruthy();
    expect(screen.getByText('90s Nike windbreaker')).toBeTruthy();
    expect(screen.getByLabelText('AI estimate, ₱1,450')).toBeTruthy();
    expect(screen.getByText('PRICED')).toBeTruthy();
  });

  it('keeps the tag off when there is no price', () => {
    renderScreen(
      <CaptureResultScene
        photoUri="file:///jacket.jpg"
        eyebrow="CHECK THE PHOTO"
        title="Too dark to price"
      />,
    );
    expect(screen.getByText('Too dark to price')).toBeTruthy();
    expect(screen.queryByText('PRICED')).toBeNull();
  });

  it('reads the range aloud as words', () => {
    renderScreen(<EstimateRange lowPhp={900} highPhp={2000} amountPhp={1450} formatPrice={peso} />);
    expect(
      screen.getByLabelText('Likely ₱900 to ₱2,000, estimate ₱1,450. A rough AI guess.'),
    ).toBeTruthy();
  });
});
