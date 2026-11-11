import { act, screen } from '@testing-library/react-native';
import { Image } from 'react-native';

import { renderScreen } from '../testing/render-screen';
import { Avatar, Photo } from './Photo';

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

it('shows a placeholder, not a picture, when there is no photo', () => {
  renderScreen(<Photo source={null} label="Brass lamp" aspectRatio={1} />);
  expect(screen.queryByTestId('photo-image')).toBeNull();
  expect(screen.UNSAFE_queryByType(Image)).toBeNull();
  expect(screen.getByLabelText('Brass lamp, no photo')).toBeOnTheScreen();
});

it('shows a person’s initial when they have no profile photo', () => {
  renderScreen(<Avatar source={null} name="maya_sells" />);
  expect(screen.UNSAFE_queryByType(Image)).toBeNull();
  expect(screen.getByText('M')).toBeOnTheScreen();
});
