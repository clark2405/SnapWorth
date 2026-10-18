import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';
import type * as ReactApi from 'react';
import { AppState } from 'react-native';
import type * as ReactNativeApi from 'react-native';

import { CameraCapture } from './CameraCapture';

const mockTakePicture = jest.fn();
const mockRequestPermission = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-camera', () => {
  const React = jest.requireActual<typeof ReactApi>('react');
  const { View } = jest.requireActual<typeof ReactNativeApi>('react-native');
  return {
    useCameraPermissions: jest.fn(),
    CameraView: React.forwardRef((props: object, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePicture }));
      return React.createElement(View, { ...props, testID: 'camera' });
    }),
  };
});

// Camera hardware and the animated presentation are replaced; the native screen's
// permission, capture, error, and lifecycle handling run unchanged.
jest.mock('@snapworth/shared/features/capture', () => {
  const React = jest.requireActual<typeof ReactApi>('react');
  const { View, Button } = jest.requireActual<typeof ReactNativeApi>('react-native');
  return {
    CaptureView: (props: {
      viewfinder: React.ReactNode;
      captureDisabled: boolean;
      onCapture: () => void;
      onToggleFlash: () => void;
    }) =>
      React.createElement(
        View,
        null,
        props.viewfinder,
        React.createElement(Button, {
          title: 'Take photo',
          disabled: props.captureDisabled,
          onPress: props.onCapture,
        }),
        React.createElement(Button, { title: 'Toggle flash', onPress: props.onToggleFlash }),
      ),
  };
});

jest.mock('@snapworth/shared/components', () => {
  const React = jest.requireActual<typeof ReactApi>('react');
  const { Button, Text } = jest.requireActual<typeof ReactNativeApi>('react-native');
  return {
    Button: ({ label, ...props }: { label: string }) =>
      React.createElement(Button, { ...props, title: label }),
    SWText: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

jest.mock('@snapworth/shared/design', () => ({
  tokens: {
    color: { dark: { sunken: '#000' } },
    overlay: { text: '#fff' },
    spacing: { 4: 16, 6: 24 },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest
    .mocked(useCameraPermissions)
    .mockReturnValue([
      { granted: true, canAskAgain: true, status: 'granted', expires: 'never' } as never,
      mockRequestPermission,
      jest.fn(),
    ]);
  mockTakePicture.mockResolvedValue({ uri: 'file:///photo.jpg', width: 100, height: 100 });
});

function openCamera(active = true) {
  return render(<CameraCapture active={active} onClose={jest.fn()} onOpenHistory={jest.fn()} />);
}

it('requests permission before mounting the camera', () => {
  jest
    .mocked(useCameraPermissions)
    .mockReturnValue([
      { granted: false, canAskAgain: true, status: 'undetermined', expires: 'never' } as never,
      mockRequestPermission,
      jest.fn(),
    ]);
  openCamera();
  expect(screen.queryByTestId('camera')).toBeNull();
  fireEvent.press(screen.getByText('Allow camera access'));
  expect(mockRequestPermission).toHaveBeenCalledTimes(1);
});

it('offers settings when camera permission cannot be requested again', () => {
  jest
    .mocked(useCameraPermissions)
    .mockReturnValue([
      { granted: false, canAskAgain: false, status: 'denied', expires: 'never' } as never,
      mockRequestPermission,
      jest.fn(),
    ]);
  openCamera();
  expect(screen.getByText('Open settings')).toBeTruthy();
  expect(screen.queryByTestId('camera')).toBeNull();
});

it('waits for readiness and displays the actual photo without a fake estimate', async () => {
  openCamera();
  fireEvent.press(screen.getByText('Take photo'));
  expect(mockTakePicture).not.toHaveBeenCalled();
  fireEvent(screen.getByTestId('camera'), 'cameraReady');
  fireEvent.press(screen.getByText('Take photo'));
  await waitFor(() =>
    expect(screen.getByLabelText('Your captured photo').props.source).toEqual({
      uri: 'file:///photo.jpg',
    }),
  );
  expect(screen.queryByTestId('camera')).toBeNull();
  expect(screen.getByText('AI estimation is not connected yet.')).toBeTruthy();
  fireEvent.press(screen.getByText('Retake photo'));
  expect(screen.getByTestId('camera')).toBeTruthy();
});

it('allows retry after a capture failure', async () => {
  mockTakePicture.mockRejectedValueOnce(new Error('Camera busy'));
  openCamera();
  fireEvent(screen.getByTestId('camera'), 'cameraReady');
  fireEvent.press(screen.getByText('Take photo'));
  await screen.findByText('Could not take the photo. Please try again.');
  fireEvent.press(screen.getByText('Take photo'));
  await screen.findByLabelText('Your captured photo');
  expect(mockTakePicture).toHaveBeenCalledTimes(2);
});

it('never mounts the camera on an inactive tab', () => {
  openCamera(false);
  expect(screen.queryByTestId('camera')).toBeNull();
});

it('unmounts the camera when the app enters the background', () => {
  openCamera();
  expect(screen.getByTestId('camera')).toBeTruthy();
  const listener = jest.mocked(AppState.addEventListener).mock.calls.at(-1)![1];
  act(() => listener('background'));
  expect(screen.queryByTestId('camera')).toBeNull();
});

it('ignores repeated shutter presses and discards a result after leaving the tab', async () => {
  let finishCapture!: (photo: { uri: string }) => void;
  mockTakePicture.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishCapture = resolve;
      }),
  );
  const { rerender } = openCamera();
  fireEvent(screen.getByTestId('camera'), 'cameraReady');
  fireEvent.press(screen.getByText('Take photo'));
  fireEvent.press(screen.getByText('Take photo'));
  expect(mockTakePicture).toHaveBeenCalledTimes(1);
  rerender(<CameraCapture active={false} onClose={jest.fn()} onOpenHistory={jest.fn()} />);
  await act(async () => finishCapture({ uri: 'file:///stale.jpg' }));
  rerender(<CameraCapture active={true} onClose={jest.fn()} onOpenHistory={jest.fn()} />);
  expect(screen.queryByLabelText('Your captured photo')).toBeNull();
  expect(screen.getByTestId('camera')).toBeTruthy();
});

it('passes the flash setting to the camera', () => {
  openCamera();
  expect(screen.getByTestId('camera').props.flash).toBe('off');
  fireEvent.press(screen.getByText('Toggle flash'));
  expect(screen.getByTestId('camera').props.flash).toBe('on');
});

it('can capture again when leaving the tab cancels a native capture that never settles', async () => {
  mockTakePicture.mockImplementationOnce(() => new Promise(() => {}));
  const { rerender } = openCamera();
  fireEvent(screen.getByTestId('camera'), 'cameraReady');
  fireEvent.press(screen.getByText('Take photo'));
  rerender(<CameraCapture active={false} onClose={jest.fn()} onOpenHistory={jest.fn()} />);
  rerender(<CameraCapture active={true} onClose={jest.fn()} onOpenHistory={jest.fn()} />);
  fireEvent(screen.getByTestId('camera'), 'cameraReady');
  fireEvent.press(screen.getByText('Take photo'));
  await screen.findByLabelText('Your captured photo');
  expect(mockTakePicture).toHaveBeenCalledTimes(2);
});
