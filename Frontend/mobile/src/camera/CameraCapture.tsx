import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, SWText } from '@snapworth/shared/components';
import { tokens } from '@snapworth/shared/design';
import { CaptureView } from '@snapworth/shared/features/capture';

export interface CameraCaptureProps {
  readonly active: boolean;
  readonly onClose: () => void;
  readonly onOpenHistory: () => void;
}

export function CameraCapture({ active, onClose, onOpenHistory }: CameraCaptureProps) {
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const takingPhoto = useRef<number | null>(null);
  const session = useRef(0);
  const [foreground, setForeground] = useState(
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  );
  const [ready, setReady] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [photoUri, setPhotoUri] = useState<string>();
  const [error, setError] = useState<string>();
  const [cameraFailed, setCameraFailed] = useState(false);
  const [cameraVersion, setCameraVersion] = useState(0);
  const insets = useSafeAreaInsets();
  const running = active && foreground;

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
      const photo = await camera.current.takePictureAsync({ quality: 0.85 });
      if (captureSession !== session.current) return;
      if (!photo?.uri) throw new Error('No photo returned');
      setReady(false);
      setPhotoUri(photo.uri);
    } catch {
      if (captureSession === session.current)
        setError('Could not take the photo. Please try again.');
    } finally {
      // A canceled native request may never settle. Only the current session's
      // request blocks its shutter, and an old completion cannot unlock a new one.
      if (takingPhoto.current === captureSession) takingPhoto.current = null;
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
    { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 88 },
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
      <View style={panelStyle}>
        <Image
          source={{ uri: photoUri }}
          accessibilityLabel="Your captured photo"
          resizeMode="contain"
          style={styles.photo}
        />
        <SWText variant="headingLarge" color={tokens.overlay.text}>
          Photo captured
        </SWText>
        <SWText color={tokens.overlay.text}>AI estimation is not connected yet.</SWText>
        <SWText color={tokens.overlay.text} align="center">
          This is a temporary preview. Your photo has not been added to History.
        </SWText>
        <Button
          label="Retake photo"
          onPress={() => {
            setReady(false);
            setPhotoUri(undefined);
          }}
        />
        <Button label="Close camera" onPress={onClose} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CaptureView
        captureDisabled={!ready || cameraFailed}
        captureHint="Takes a photo and opens a preview"
        viewfinder={
          <CameraView
            key={cameraVersion}
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="picture"
            flash={flashOn ? 'on' : 'off'}
            onCameraReady={() => {
              setReady(true);
              setCameraFailed(false);
            }}
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
        bottomInset={64}
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
  photo: { flex: 1, width: '100%' },
  error: {
    position: 'absolute',
    left: tokens.spacing[6],
    right: tokens.spacing[6],
    padding: tokens.spacing[4],
    backgroundColor: tokens.color.dark.sunken,
    gap: tokens.spacing[4],
  },
});
