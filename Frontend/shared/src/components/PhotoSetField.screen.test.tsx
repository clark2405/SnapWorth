import { act, fireEvent, screen } from '@testing-library/react-native';
import type { LayoutChangeEvent } from 'react-native';

import { renderScreen } from '../testing/render-screen';
import { PhotoSetField } from './PhotoSetField';
import type { ItemPhoto } from './PhotoViewer';

const photo = (label: string): ItemPhoto => ({ source: { uri: `file:///${label}.jpg` }, label });

/** The tiles only lay out once the row knows its width, as it does on a device. */
function layOut() {
  const row = screen.getByTestId('photo-row');
  fireEvent(row, 'layout', {
    nativeEvent: { layout: { width: 360, height: 84, x: 0, y: 0 } },
  } as LayoutChangeEvent);
}

describe('PhotoSetField', () => {
  it('counts the photos against the limit and offers the room that is left', async () => {
    const onAddPhotos = jest.fn(async (room: number) => [photo('back')].slice(0, room));
    const onChange = jest.fn();
    renderScreen(
      <PhotoSetField photos={[photo('front')]} onChange={onChange} onAddPhotos={onAddPhotos} />,
    );
    layOut();

    expect(screen.getByText('1 of 4')).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Add photos, 3 more allowed'));
    });

    expect(onAddPhotos).toHaveBeenCalledWith(3);
    expect(onChange).toHaveBeenCalledWith([photo('front'), photo('back')]);
  });

  it('stops offering more at four and says how to swap one', () => {
    renderScreen(
      <PhotoSetField
        photos={['a', 'b', 'c', 'd'].map(photo)}
        onChange={jest.fn()}
        onAddPhotos={jest.fn()}
      />,
    );
    layOut();

    expect(screen.queryByLabelText(/Add photos/)).toBeNull();
    expect(screen.getByText(/the most an item can have/)).toBeOnTheScreen();
  });

  it('removes the photo asked for and never the last one', () => {
    const onChange = jest.fn();
    const { rerender } = renderScreen(
      <PhotoSetField photos={[photo('front'), photo('label')]} onChange={onChange} />,
    );
    layOut();

    fireEvent.press(screen.getByLabelText('Remove photo 2'));
    expect(onChange).toHaveBeenCalledWith([photo('front')]);

    rerender(<PhotoSetField photos={[photo('front')]} onChange={onChange} />);
    expect(screen.queryByLabelText(/Remove/)).toBeNull();
  });
});
