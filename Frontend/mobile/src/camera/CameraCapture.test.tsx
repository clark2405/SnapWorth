import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';
import type * as ReactApi from 'react';
import { AppState, Platform } from 'react-native';
import type * as ReactNativeApi from 'react-native';

import { CameraCapture } from './CameraCapture';

const mockTakePicture = jest.fn();
const mockRequestPermission = jest.fn();
const mockEstimate = jest.fn();
const mockCameraMount = jest.fn();
const sampleEstimate = {
  status: 'estimated',
  itemName: 'Camera-tested jacket',
  amountPhp: 1500,
  lowPhp: 900,
  highPhp: 2500,
  explanation: 'A rough estimate based on the visible item.',
  assumptions: ['Condition is based on the photo.'],
};

// The native photo check: absent by default, as on Android, so pricing runs as it always did.
const mockMeasurePhoto = jest.fn();
const mockReadItem = jest.fn();
jest.mock('../snap-sense', () => ({
  measurePhoto: (uri: string) => mockMeasurePhoto(uri),
  readItem: (uri: string) => mockReadItem(uri),
  prepareItemReader: jest.fn(),
}));
const goodPhoto = {
  brightness: 0.6,
  sharpness: 700,
  subject: 0.4,
  looked: true,
  text: [],
  codes: [],
};

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-camera', () => {
  const React = jest.requireActual<typeof ReactApi>('react');
  const { View } = jest.requireActual<typeof ReactNativeApi>('react-native');
  return {
    useCameraPermissions: jest.fn(),
    CameraView: React.forwardRef((props: object, ref: unknown) => {
      React.useEffect(() => {
        mockCameraMount();
      }, []);
      React.useImperativeHandle(ref, () => ({
        takePictureAsync: mockTakePicture,
        getAvailablePictureSizesAsync: async () => [
          '4000x3000',
          '1920x1080',
          '1280x720',
          '640x480',
        ],
      }));
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
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest
    .mocked(useCameraPermissions)
    .mockReturnValue([
      { granted: true, canAskAgain: true, status: 'granted', expires: 'never' } as never,
      mockRequestPermission,
      jest.fn(),
    ]);
  mockTakePicture.mockResolvedValue({
    uri: 'file:///photo.jpg',
    base64: '/9j/4AAQSkZJRg==',
    width: 100,
    height: 100,
  });
  mockEstimate.mockReset().mockResolvedValue(sampleEstimate);
  mockMeasurePhoto.mockReset().mockResolvedValue(null);
  mockReadItem.mockReset().mockResolvedValue(null);
});

function openCamera(active = true) {
  return render(
    <CameraCapture
      active={active}
      onClose={jest.fn()}
      onOpenHistory={jest.fn()}
      onEstimate={mockEstimate}
    />,
  );
}

async function readyCamera() {
  await act(async () => {
    fireEvent(screen.getByTestId('camera'), 'cameraReady');
  });
  await act(async () => {
    fireEvent(screen.getByTestId('camera'), 'cameraReady');
  });
}

it('configures resolution without replacing the native camera session', async () => {
  openCamera();
  expect(mockCameraMount).toHaveBeenCalledTimes(1);
  await readyCamera();
  expect(screen.getByTestId('camera').props.pictureSize).toBe('1280x720');
  expect(mockCameraMount).toHaveBeenCalledTimes(1);
});

it('enables iOS capture after its single camera-ready event', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  openCamera();
  await act(async () => {
    fireEvent(screen.getByTestId('camera'), 'cameraReady');
  });
  expect(screen.getByTestId('camera').props.pictureSize).toBe('1280x720');
  fireEvent.press(screen.getByText('Take photo'));
  await waitFor(() => expect(mockTakePicture).toHaveBeenCalledTimes(1));
});

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
  jest.replaceProperty(Platform, 'OS', 'android');
  openCamera();
  fireEvent.press(screen.getByText(/take photo/i));
  expect(mockTakePicture).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent(screen.getByTestId('camera'), 'cameraReady');
  });
  expect(screen.getByTestId('camera').props.pictureSize).toBe('1280x720');
  fireEvent.press(screen.getByText(/take photo/i));
  expect(mockTakePicture).not.toHaveBeenCalled();
  await readyCamera();
  fireEvent.press(screen.getByText(/take photo/i));
  await waitFor(() =>
    expect(screen.getByLabelText('Your captured photo').props.source).toEqual({
      uri: 'file:///photo.jpg',
    }),
  );
  expect(screen.queryByTestId('camera')).toBeNull();
  await screen.findByText('Camera-tested jacket');
  expect(mockEstimate).toHaveBeenCalledWith(
    { data: '/9j/4AAQSkZJRg==', mimeType: 'image/jpeg' },
    expect.any(AbortSignal),
  );
  fireEvent.press(screen.getByText(/retake photo/i));
  expect(screen.getByTestId('camera')).toBeTruthy();
});

it('allows retry after a capture failure', async () => {
  mockTakePicture.mockRejectedValueOnce(new Error('Camera busy'));
  openCamera();
  await readyCamera();
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
  await readyCamera();
  fireEvent.press(screen.getByText('Take photo'));
  fireEvent.press(screen.getByText('Take photo'));
  expect(mockTakePicture).toHaveBeenCalledTimes(1);
  rerender(
    <CameraCapture
      active={false}
      onClose={jest.fn()}
      onOpenHistory={jest.fn()}
      onEstimate={mockEstimate}
    />,
  );
  await act(async () => finishCapture({ uri: 'file:///stale.jpg' }));
  rerender(
    <CameraCapture
      active={true}
      onClose={jest.fn()}
      onOpenHistory={jest.fn()}
      onEstimate={mockEstimate}
    />,
  );
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
  await readyCamera();
  fireEvent.press(screen.getByText('Take photo'));
  rerender(
    <CameraCapture
      active={false}
      onClose={jest.fn()}
      onOpenHistory={jest.fn()}
      onEstimate={mockEstimate}
    />,
  );
  rerender(
    <CameraCapture
      active={true}
      onClose={jest.fn()}
      onOpenHistory={jest.fn()}
      onEstimate={mockEstimate}
    />,
  );
  await readyCamera();
  fireEvent.press(screen.getByText('Take photo'));
  await screen.findByLabelText('Your captured photo');
  expect(mockTakePicture).toHaveBeenCalledTimes(2);
});

it('retains the photo and retries a failed estimate without taking a second photo', async () => {
  mockEstimate.mockRejectedValueOnce(new Error('The free AI limit has been reached.'));
  openCamera();
  await readyCamera();
  fireEvent.press(screen.getByText('Take photo'));
  await screen.findByText('The free AI limit has been reached.');
  expect(screen.getByLabelText('Your captured photo')).toBeTruthy();
  fireEvent.press(screen.getByText('Retry estimate'));
  await screen.findByText('Camera-tested jacket');
  expect(mockEstimate).toHaveBeenCalledTimes(2);
  expect(mockTakePicture).toHaveBeenCalledTimes(1);
});

it('does not display an old estimate after retaking the photo', async () => {
  let finishEstimate!: (value: typeof sampleEstimate) => void;
  mockEstimate.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishEstimate = resolve;
      }),
  );
  openCamera();
  await readyCamera();
  fireEvent.press(screen.getByText('Take photo'));
  await screen.findByText('Estimating your item…');
  fireEvent.press(screen.getByText('Retake photo'));
  await act(async () => finishEstimate(sampleEstimate));
  expect(screen.queryByText('Camera-tested jacket')).toBeNull();
  expect(screen.getByTestId('camera')).toBeTruthy();
});

it('keeps an oversized photo for review without sending it to the AI', async () => {
  mockTakePicture.mockResolvedValueOnce({
    uri: 'file:///large.jpg',
    base64: 'A'.repeat(6_000_000),
    width: 4000,
    height: 3000,
  });
  openCamera();
  await readyCamera();
  fireEvent.press(screen.getByText('Take photo'));
  await screen.findByText('This photo is too large to estimate. Please retake it.');
  expect(mockEstimate).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Your captured photo')).toBeTruthy();
  expect(screen.queryByText('Retry estimate')).toBeNull();
});

it('holds back a photo too dark to price, and sends it only when asked', async () => {
  mockMeasurePhoto.mockResolvedValue({ ...goodPhoto, brightness: 0.05 });
  openCamera();
  await readyCamera();
  await act(async () => {
    fireEvent.press(screen.getByText('Take photo'));
  });
  expect(await screen.findByText('Too dark to price')).toBeTruthy();
  expect(mockMeasurePhoto).toHaveBeenCalledWith('file:///photo.jpg');
  expect(mockReadItem).not.toHaveBeenCalled();
  expect(mockEstimate).not.toHaveBeenCalled();

  await act(async () => {
    fireEvent.press(screen.getByText('Price it anyway'));
  });
  expect(mockEstimate).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Too dark to price')).toBeNull();
});

it('sends what the phone read along with a good photo', async () => {
  mockMeasurePhoto.mockResolvedValue({
    ...goodPhoto,
    text: ['NIKE', 'AIR JORDAN 1 RETRO HIGH OG'],
  });
  mockReadItem.mockResolvedValue({
    item: 'high top sneakers',
    category: 'shoes',
    brand: 'Nike',
    colours: ['red', 'black'],
    usablePhoto: true,
  });
  let finish!: (estimate: typeof sampleEstimate) => void;
  mockEstimate.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  openCamera();
  await readyCamera();
  await act(async () => {
    fireEvent.press(screen.getByText('Take photo'));
  });
  await waitFor(() => expect(mockEstimate).toHaveBeenCalledTimes(1));
  expect(mockEstimate.mock.calls[0][2]).toEqual({
    text: ['NIKE', 'AIR JORDAN 1 RETRO HIGH OG'],
    codes: [],
    looksLike: { item: 'high top sneakers', category: 'shoes', colours: ['red', 'black'] },
  });
  // The brand is printed in the photo, so it's shown; the estimate replaces the first look.
  expect(screen.getByText('Looks like: high top sneakers · Nike')).toBeTruthy();
  await act(async () => finish(sampleEstimate));
  expect(screen.queryByText(/Looks like/)).toBeNull();
  expect(screen.getByText('Camera-tested jacket')).toBeTruthy();
});

it('forgets the last photo’s check on retake', async () => {
  mockMeasurePhoto.mockResolvedValueOnce({ ...goodPhoto, sharpness: 5 });
  openCamera();
  await readyCamera();
  await act(async () => {
    fireEvent.press(screen.getByText('Take photo'));
  });
  expect(await screen.findByText('A little blurry')).toBeTruthy();
  fireEvent.press(screen.getByText('Retake photo'));
  await readyCamera();
  await act(async () => {
    fireEvent.press(screen.getByText('Take photo'));
  });
  expect(screen.queryByText('A little blurry')).toBeNull();
  await waitFor(() => expect(mockEstimate).toHaveBeenCalledTimes(1));
});
