import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, SWText } from '@snapworth/shared/components';
import { tokens } from '@snapworth/shared/design';
import { CaptureView } from '@snapworth/shared/features/capture';
import type {
  CapturedItemImage,
  PhotoEstimate,
  PhotoPricingService,
} from '@snapworth/shared/types';

export interface CameraCaptureProps {
  readonly active: boolean;
  readonly onClose: () => void;
  readonly onOpenHistory: () => void;
  readonly onPhotoCaptured?: () => void;
  readonly onEstimate: PhotoPricingService['estimate'];
}

export function CameraCapture({
  active,
  onClose,
  onOpenHistory,
  onPhotoCaptured,
  onEstimate,
}: CameraCaptureProps) {
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const takingPhoto = useRef<number | null>(null);
  const session = useRef(0);
  const [foreground, setForeground] = useState(
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  );
  const [ready, setReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string>();
  const [flashOn, setFlashOn] = useState(false);
  const [photoUri, setPhotoUri] = useState<string>();
  const [photoData, setPhotoData] = useState<CapturedItemImage>();
  const [estimate, setEstimate] = useState<PhotoEstimate>();
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string>();
  const estimateGeneration = useRef(0);
  const estimateRequest = useRef<{
    controller: AbortController;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [error, setError] = useState<string>();
  const [cameraFailed, setCameraFailed] = useState(false);
  const [cameraVersion, setCameraVersion] = useState(0);
  const insets = useSafeAreaInsets();
  const running = active && foreground;

  const stopEstimate = () => {
    estimateGeneration.current += 1;
    if (estimateRequest.current) {
      clearTimeout(estimateRequest.current.timer);
      estimateRequest.current.controller.abort();
      estimateRequest.current = null;
    }
  };

  useEffect(
    () => () => {
      stopEstimate();
    },
    [],
  );

  const estimatePhoto = async (image: CapturedItemImage) => {
    if (estimateRequest.current) return;
    const generation = ++estimateGeneration.current;
    const controller = new AbortController();
    setEstimate(undefined);
    setEstimateError(undefined);
    setEstimating(true);
    const timer = setTimeout(() => {
      controller.abort();
      if (generation === estimateGeneration.current) {
        estimateRequest.current = null;
        setEstimating(false);
        setEstimateError('The estimate took too long. Please try again.');
      }
    }, 75_000);
    estimateRequest.current = { controller, timer };
    try {
      const result = await onEstimate(image, controller.signal);
      if (generation === estimateGeneration.current && !controller.signal.aborted)
        setEstimate(result);
    } catch (cause) {
      if (generation === estimateGeneration.current && !controller.signal.aborted) {
        setEstimateError(
          cause instanceof Error
            ? cause.message
            : 'Could not estimate this item. Please try again.',
        );
      }
    } finally {
      clearTimeout(timer);
      if (generation === estimateGeneration.current && !controller.signal.aborted) {
        estimateRequest.current = null;
        setEstimating(false);
      }
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      setReady(false);
      session.current += 1;
      if (state === 'active') {
        void refreshPermission().catch(() =>
          setError('Could not check camera permission. Please try again.'),
        );
      }
    });
    return () => subscription.remove();
  }, [refreshPermission]);

  useEffect(() => {
    setReady(false);
    return () => {
      session.current += 1;
    };
  }, [running]);

  const takePhoto = async () => {
    if (!running || !ready || !camera.current || takingPhoto.current === session.current) return;
    takingPhoto.current = session.current;
    setError(undefined);
    const captureSession = session.current;
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.6, base64: true });
      if (captureSession !== session.current) return;
      if (!photo?.uri || !photo.base64) throw new Error('No photo returned');
      const image: CapturedItemImage = { data: photo.base64, mimeType: 'image/jpeg' };
      setReady(false);
      setPhotoUri(photo.uri);
      setPhotoData(image);
      onPhotoCaptured?.();
      if (image.data.length > Math.ceil((4 * 1024 * 1024 * 4) / 3)) {
        setPhotoData(undefined);
        setEstimateError('This photo is too large to estimate. Please retake it.');
        return;
      }
      void estimatePhoto(image);
    } catch {
      if (captureSession === session.current)
        setError('Could not take the photo. Please try again.');
    } finally {
      // A canceled native request may never settle. Only the current session's
      // request blocks its shutter, and an old completion cannot unlock a new one.
      if (takingPhoto.current === captureSession) takingPhoto.current = null;
    }
  };

  const prepareCamera = async () => {
    if (pictureSize) {
      setReady(true);
      setCameraFailed(false);
      return;
    }
    const currentCamera = camera.current;
    const currentSession = session.current;
    if (!currentCamera) return;
    try {
      const sizes = await currentCamera.getAvailablePictureSizesAsync();
      if (currentSession !== session.current || currentCamera !== camera.current) return;
      const parsed = sizes
        .map((value) => {
          const match = /^(\d+)x(\d+)$/.exec(value);
          return { value, pixels: match ? Number(match[1]) * Number(match[2]) : 0 };
        })
        .filter((size) => size.pixels > 0)
        .sort((a, b) => a.pixels - b.pixels);
      const bounded = parsed.filter((size) => size.pixels <= 1_500_000);
      const selected = bounded.at(-1) ?? parsed[0];
      if (!selected) throw new Error('No capture size available');
      // Let the same native view reconfigure and report ready again. Replacing it
      // races Android's old-view cleanup (unbindAll) against the new preview.
      setPictureSize(selected.value);
      // iOS updates the session preset without another camera-ready event.
      // Android recreates its use cases and reports readiness again.
      if (Platform.OS !== 'android') {
        setReady(true);
        setCameraFailed(false);
      }
    } catch {
      if (currentSession === session.current && currentCamera === camera.current) {
        setReady(false);
        setCameraFailed(true);
        setError('Could not prepare the camera. Please try again.');
      }
    }
  };

  const askPermission = async () => {
    try {
      setError(undefined);
      if (permission?.canAskAgain === false) await Linking.openSettings();
      else await requestPermission();
    } catch {
      setError('Could not open camera access. Please try again.');
    }
  };

  if (!running) return null;

  const panelStyle = [
    styles.panel,
    { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
  ];

  if (!permission?.granted) {
    return (
      <View style={panelStyle}>
        <SWText variant="headingLarge" color={tokens.overlay.text}>
          Camera access
        </SWText>
        <SWText color={tokens.overlay.text} align="center">
          {permission
            ? 'Allow SnapWorth to use your camera to photograph an item.'
            : 'Checking camera permission…'}
        </SWText>
        {permission ? (
          <Button
            label={permission.canAskAgain ? 'Allow camera access' : 'Open settings'}
            onPress={() => void askPermission()}
          />
        ) : null}
        {error ? <SWText color={tokens.overlay.text}>{error}</SWText> : null}
        <Button label="Close camera" onPress={onClose} />
      </View>
    );
  }

  if (photoUri) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.review,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Image
          source={{ uri: photoUri }}
          accessibilityLabel="Your captured photo"
          resizeMode="contain"
          style={styles.photo}
        />
        {estimating ? (
          <SWText
            variant="headingLarge"
            color={tokens.overlay.text}
            accessibilityLiveRegion="polite"
          >
            Estimating your item…
          </SWText>
        ) : null}
        {estimate ? (
          <>
            <SWText variant="headingLarge" color={tokens.overlay.text}>
              {estimate.itemName || 'Could not identify the item'}
            </SWText>
            {estimate.status === 'estimated' ? (
              <>
                <SWText variant="priceLarge" color={tokens.overlay.text}>
                  {formatPhp(estimate.amountPhp)}
                </SWText>
                <SWText color={tokens.overlay.text}>
                  Likely {formatPhp(estimate.lowPhp)} – {formatPhp(estimate.highPhp)}
                </SWText>
                <SWText color={tokens.overlay.text}>
                  Rough AI estimate, not a confirmed sale price.
                </SWText>
              </>
            ) : null}
            <SWText color={tokens.overlay.text}>{estimate.explanation}</SWText>
            {estimate.assumptions.map((assumption, index) => (
              <SWText key={index} variant="caption" color={tokens.overlay.text}>
                {assumption}
              </SWText>
            ))}
          </>
        ) : null}
        {estimateError ? (
          <SWText color={tokens.overlay.text} accessibilityLiveRegion="polite">
            {estimateError}
          </SWText>
        ) : null}
        {(estimateError || estimate?.status === 'unable_to_estimate') && photoData ? (
          <Button label="Retry estimate" onPress={() => void estimatePhoto(photoData)} />
        ) : null}
        <SWText color={tokens.overlay.text} align="center">
          This photo and estimate have not been added to History.
        </SWText>
        <Button
          label="Retake photo"
          onPress={() => {
            stopEstimate();
            setEstimating(false);
            setEstimate(undefined);
            setEstimateError(undefined);
            setReady(false);
            setPhotoUri(undefined);
            setPhotoData(undefined);
          }}
        />
        <Button label="Close camera" onPress={onClose} />
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <CaptureView
        captureDisabled={!ready || cameraFailed}
        captureHint="Takes a photo and starts its AI price estimate"
        viewfinder={
          <CameraView
            key={cameraVersion}
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="picture"
            pictureSize={pictureSize}
            flash={flashOn ? 'on' : 'off'}
            onCameraReady={() => void prepareCamera()}
            onMountError={() => {
              setReady(false);
              setCameraFailed(true);
              setError('Could not start the camera. Please try again.');
            }}
          />
        }
        flashOn={flashOn}
        onToggleFlash={() => setFlashOn((value) => !value)}
        onCapture={takePhoto}
        onClose={onClose}
        onOpenHistory={onOpenHistory}
      />
      {error ? (
        <View style={[styles.error, { top: insets.top + 80 }]} accessibilityLiveRegion="polite">
          <SWText color={tokens.overlay.text} align="center">
            {error}
          </SWText>
          {cameraFailed ? (
            <Button
              label="Retry camera"
              onPress={() => {
                setError(undefined);
                setCameraVersion((value) => value + 1);
              }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.dark.sunken },
  panel: {
    flex: 1,
    backgroundColor: tokens.color.dark.sunken,
    paddingHorizontal: tokens.spacing[6],
    gap: tokens.spacing[4],
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  review: { flexGrow: 1, paddingHorizontal: tokens.spacing[6], gap: tokens.spacing[4] },
  photo: { height: 240, width: '100%' },
  error: {
    position: 'absolute',
    left: tokens.spacing[6],
    right: tokens.spacing[6],
    padding: tokens.spacing[4],
    backgroundColor: tokens.color.dark.sunken,
    gap: tokens.spacing[4],
  },
});

function formatPhp(amount: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(amount);
}
