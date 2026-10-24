import { act, screen } from '@testing-library/react-native';
import { Image } from 'react-native';

import { renderScreen } from '../testing/render-screen';
import { Photo } from './Photo';

it('replaces the fading image with a fresh native image after the fallback', () => {
  jest.useFakeTimers();
  renderScreen(<Photo source={{ uri: 'sample.jpg' }} label="Sample item" aspectRatio={1} />);
  const fadingImage = screen.UNSAFE_getByType(Image);
  act(() => {
    jest.advanceTimersByTime(1500);
  });
  const settledImage = screen.UNSAFE_getByType(Image);
  expect(settledImage).not.toBe(fadingImage);
  expect(settledImage.props.source).toEqual({ uri: 'sample.jpg' });
  jest.useRealTimers();
});
