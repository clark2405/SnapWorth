import { beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useCameraPermissions, type PermissionResponse } from 'expo-camera';
import type * as ReactApi from 'react';
import { AppState, Platform } from 'react-native';
import type * as ReactNativeApi from 'react-native';

import type { NewScan, SaveOutcome } from '@snapworth/shared/features/history/scan-history';
import type { PhotoEstimate, PhotoPricingService } from '@snapworth/shared/types';

import { CameraCapture } from './CameraCapture';

const mockTakePicture =
  jest.fn<() => Promise<{ uri: string; base64?: string; width?: number; height?: number }>>();
const mockRequestPermission = jest.fn<() => Promise<PermissionResponse>>();
const mockGetPermission = jest.fn<() => Promise<PermissionResponse>>();
const mockEstimate = jest.fn<PhotoPricingService['estimate']>();
const mockCameraMount = jest.fn();
const sampleEstimate: PhotoEstimate = {
  status: 'estimated',
  itemName: 'Camera-tested jacket',
  amountPhp: 1500,
  lowPhp: 900,
  highPhp: 2500,
  explanation: 'A rough estimate based on the visible item.',
  assumptions: ['Condition is based on the photo.'],
};

// The native photo check: absent by default, as on Android, so pricing runs as it always did.
const mockMeasurePhoto = jest.fn<(uri: string) => Promise<unknown>>();
const mockReadItem = jest.fn<(uri: string) => Promise<unknown>>();
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

// Cutting the photo down to the frame: the stand-in hands back what the camera took, so the
// tests see the photo and its data as they were.
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (uri: string) => {
      const context = {
        crop: () => context,
        resize: () => context,
        renderAsync: async () => ({
          saveAsync: async () => {
            const shot = (await mockTakePicture.mock.results.at(-1)?.value) as
              { base64?: string } | undefined;
            return { uri, base64: shot?.base64 ?? '' };
          },
        }),
      };
      return context;
    },
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-camera', () => {
  const React = jest.requireActual<typeof ReactApi>('react');
  const { View } = jest.requireActual<typeof ReactNativeApi>('react-native');
  return {
    useCameraPermissions: jest.fn(),
    CameraView: React.forwardRef((props: object, ref: ReactApi.ForwardedRef<unknown>) => {
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
  const { View, Button, Image, Text } = jest.requireActual<typeof ReactNativeApi>('react-native');
  // The photo coach is plain data, so the real one is used.
  const { coachFor } = jest.requireActual<{ coachFor: unknown }>(
    '@snapworth/shared/features/capture/photo-coach',
  );
  return {
    coachFor,
    CaptureResultScene: (props: {
      photoUri: string;
      title: string;
      amountPhp?: number;
      formatPrice?: (amount: number) => string;
    }) =>
      React.createElement(
        View,
        null,
        React.createElement(Image, {
          source: { uri: props.photoUri },
          accessibilityLabel: 'Your captured photo',
        }),
        React.createElement(Text, null, props.title),
        props.amountPhp !== undefined && props.formatPrice
          ? React.createElement(Text, null, props.formatPrice(props.amountPhp))
          : null,
      ),
    EstimateRange: (props: {
      lowPhp: number;
      highPhp: number;
      formatPrice: (amount: number) => string;
    }) =>
      React.createElement(
        Text,
        null,
        `Likely ${props.formatPrice(props.lowPhp)} – ${props.formatPrice(props.highPhp)}`,
      ),
    EstimatingScene: (props: { stage: string; looksLike?: string }) =>
      React.createElement(
        View,
        null,
        React.createElement(
          Text,
          null,
          props.stage === 'looking' ? 'Looking at your photo' : 'Pricing your item',
        ),
        props.looksLike ? React.createElement(Text, null, `Looks like: ${props.looksLike}`) : null,
      ),
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
    Worthy: () => null,
  };
});

jest.mock('@snapworth/shared/design', () => ({
  // The photo's review takes the app's theme; these are stand-in colours.
  useTheme: () => ({
    isDark: false,
    colors: {
      canvas: '#fffbf5',
      surface: '#fff',
      surfaceRaised: '#fff7ec',
      sand: '#f0e6d6',
      sandInk: '#6f5f45',
      borderSubtle: '#ece3d6',
      borderStrong: '#ddd1c0',
      textPrimary: '#1a1714',
      textSecondary: '#5f564c',
      textMuted: '#6a6055',
    },
  }),
  held: () => ({}),
  tokens: {
    color: {
      dark: {
        sunken: '#000',
        surface: '#111',
        surfaceRaised: '#1c1814',
        borderSubtle: '#2a241e',
        borderStrong: '#3d342b',
        textPrimary: '#f5eee3',
        textSecondary: '#aaa',
        textMuted: '#777',
        kraft: '#cdae7c',
        success: '#4c9',
        marigold: '#fb0',
        accent: '#f53',
      },
    },
    overlay: { text: '#fff', chrome: '#0008', border: '#fff3' },
    radius: { small: 12, medium: 16, large: 20, full: 999 },
    spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24 },
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
      mockGetPermission,
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
      mockGetPermission,
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
      mockGetPermission,
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
  await screen.findByText('Pricing your item');
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
  expect(mockEstimate.mock.calls[0]?.[2]).toEqual({
    text: ['NIKE', 'AIR JORDAN 1 RETRO HIGH OG'],
    codes: [],
    looksLike: { item: 'high top sneakers', category: 'shoes', colours: ['red', 'black'] },
  });
  // The brand is printed in the photo, so it's shown; the estimate replaces the first look.
  expect(screen.getByText('Looks like: high top sneakers · Nike')).toBeTruthy();
  // The phone knows it's shoes, so the coach asks for the shots that matter for shoes.
  expect(screen.getByText('For shoes, also snap')).toBeTruthy();
  expect(screen.getByText('•  The size tag inside the tongue')).toBeTruthy();
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

it('saves a successful estimate and provides a View in History button', async () => {
  const onSaveScan = jest.fn<(scan: NewScan) => Promise<SaveOutcome>>().mockResolvedValue('saved');
  const onOpenHistory = jest.fn();
  render(
    <CameraCapture
      active={true}
      onClose={jest.fn()}
      onOpenHistory={onOpenHistory}
      onEstimate={mockEstimate}
      onSaveScan={onSaveScan}
    />,
  );
  await readyCamera();
  fireEvent.press(screen.getByText('Take photo'));
  await screen.findByText('Saved to your History.');
  expect(onSaveScan).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Camera-tested jacket',
      estimate: 1500,
      photoUri: 'file:///photo.jpg',
    }),
  );

  fireEvent.press(screen.getByText('View in History'));
  expect(onOpenHistory).toHaveBeenCalledTimes(1);
});

it('does not save to history if the estimate fails', async () => {
  const onSaveScan = jest.fn<(scan: NewScan) => Promise<SaveOutcome>>();
  mockEstimate.mockRejectedValueOnce(new Error('AI failed'));
  render(
    <CameraCapture
      active={true}
      onClose={jest.fn()}
      onOpenHistory={jest.fn()}
      onEstimate={mockEstimate}
      onSaveScan={onSaveScan}
    />,
  );
  await readyCamera();
  fireEvent.press(screen.getByText('Take photo'));
  await screen.findByText('AI failed');
  expect(onSaveScan).not.toHaveBeenCalled();
  expect(screen.queryByText('Saved to your History.')).toBeNull();
  expect(screen.queryByText('View in History')).toBeNull();
});

it('says when a scan is kept on the phone to sync later', async () => {
  const onSaveScan = jest
    .fn<(scan: NewScan) => Promise<SaveOutcome>>()
    .mockResolvedValue('pending');
  render(
    <CameraCapture
      active={true}
      onClose={jest.fn()}
      onOpenHistory={jest.fn()}
      onEstimate={mockEstimate}
      onSaveScan={onSaveScan}
    />,
  );
  await readyCamera();
  fireEvent.press(screen.getByText('Take photo'));
  await screen.findByText(
    'Saved to your History on this phone. It’ll sync when you’re back online.',
  );
  expect(screen.getByText('View in History')).toBeTruthy();
});

it('doesn’t claim a scan was saved when saving failed', async () => {
  const onSaveScan = jest.fn<(scan: NewScan) => Promise<SaveOutcome>>().mockResolvedValue('failed');
  render(
    <CameraCapture
      active={true}
      onClose={jest.fn()}
      onOpenHistory={jest.fn()}
      onEstimate={mockEstimate}
      onSaveScan={onSaveScan}
    />,
  );
  await readyCamera();
  fireEvent.press(screen.getByText('Take photo'));
  await screen.findByText('This photo and estimate have not been added to History.');
  expect(screen.queryByText('Saved to your History.')).toBeNull();
  expect(screen.queryByText('View in History')).toBeNull();
});
