import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, SWText, Worthy, type CompanionMood } from '@snapworth/shared/components';
import { held, tokens, useTheme } from '@snapworth/shared/design';
import {
  CaptureResultScene,
  CaptureView,
  EstimateRange,
  EstimatingScene,
  coachFor,
  type FoundSticker,
  type CaptureFrame,
  type PhotoCoach,
} from '@snapworth/shared/features/capture';
import type { NewScan, SaveOutcome } from '@snapworth/shared/features/history/scan-history';
import type {
  CapturedItemImage,
  PhotoClues,
  PhotoEstimate,
  PhotoPricingService,
} from '@snapworth/shared/types';

import { measurePhoto, prepareItemReader, readItem } from '../snap-sense';
import { cropToFrame } from './frame-crop';
import {
  cluesFrom,
  confirmedBrand,
  photoProblem,
  photoProblemCopy,
  type PhotoProblem,
} from './photo-check';

export interface CameraCaptureProps {
  readonly active: boolean;
  readonly onClose: () => void;
  readonly onOpenHistory: () => void;
  readonly onPhotoCaptured?: () => void;
  readonly onEstimate: PhotoPricingService['estimate'];
  /** Saves a successful estimate to History, and says how that went. */
  readonly onSaveScan?: (scan: NewScan) => Promise<SaveOutcome>;
}

export function CameraCapture({
  active,
  onClose,
  onOpenHistory,
  onPhotoCaptured,
  onEstimate,
  onSaveScan,
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
  const [zoom, setZoom] = useState(0);
  /** Where the frame's corners are on screen: only what's inside them is priced. */
  const frame = useRef<CaptureFrame | null>(null);
  const [photoUri, setPhotoUri] = useState<string>();
  const [photoData, setPhotoData] = useState<CapturedItemImage>();
  const [estimate, setEstimate] = useState<PhotoEstimate>();
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string>();
  // Whether this photo's estimate made it into History.
  const [saved, setSaved] = useState<SaveOutcome | 'saving'>();
  // The phone's own look at the photo, before it's priced: a problem stops it being sent.
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<PhotoProblem>();
  const [looksLike, setLooksLike] = useState<string>();
  // The kind of item, from the on-device reader, for the photo coach. Unknown without Apple
  // Intelligence: the coach then gives general tips (the cloud AI will fill this in later).
  const [itemKind, setItemKind] = useState<string | null>(null);
  const [clues, setClues] = useState<PhotoClues>();
  const lookGeneration = useRef(0);
  const estimateGeneration = useRef(0);
  const estimateRequest = useRef<{
    controller: AbortController;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [error, setError] = useState<string>();
  const [cameraFailed, setCameraFailed] = useState(false);
  const [cameraVersion, setCameraVersion] = useState(0);
  const insets = useSafeAreaInsets();
  // The camera itself is always dark; the photo's review that follows takes the app's theme.
  const { colors } = useTheme();
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

  const estimatePhoto = async (
    image: CapturedItemImage,
    hints?: PhotoClues,
    uriForSave?: string,
  ) => {
    if (estimateRequest.current) return;
    const generation = ++estimateGeneration.current;
    const controller = new AbortController();
    setEstimate(undefined);
    setSaved(undefined);
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
    // A successful estimate is saved to History once the estimate itself is over.
    let toSave: NewScan | undefined;
    try {
      const result = await (hints
        ? onEstimate(image, controller.signal, hints)
        : onEstimate(image, controller.signal));
      if (generation === estimateGeneration.current && !controller.signal.aborted) {
        setEstimate(result);
        // Without Apple Intelligence the phone can't tell what kind of item this is; the
        // estimate says, so the tips beneath it name the shots for that kind.
        setItemKind((current) => current ?? result.itemKind ?? null);
        const resolvedUri = uriForSave || photoUri;
        if (result.status === 'estimated' && resolvedUri) {
          toSave = {
            title: result.itemName,
            estimate: result.amountPhp,
            lowPhp: result.lowPhp,
            highPhp: result.highPhp,
            explanation: result.explanation,
            assumptions: result.assumptions,
            photoUri: resolvedUri,
          };
        }
      }
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
    if (toSave && onSaveScan) {
      setSaved('saving');
      const outcome = await onSaveScan(toSave).catch((): SaveOutcome => 'failed');
      if (generation === estimateGeneration.current) setSaved(outcome);
    }
  };

  /**
   * Checks the photo on the phone before it's priced. A dark, blurred or empty photo is held
   * back with what to fix, since each estimate spends the day's small cloud allowance. A good
   * one is read for its printed text and, with Apple Intelligence, a first impression of the
   * item; both go to the cloud as clues.
   */
  const lookThenEstimate = async (uri: string, image: CapturedItemImage) => {
    const look = ++lookGeneration.current;
    setChecking(true);
    const measurement = await measurePhoto(uri);
    if (look !== lookGeneration.current) return;
    const found = measurement ? photoProblem(measurement) : null;
    if (found) {
      setChecking(false);
      setProblem(found);
      setClues(cluesFrom(measurement, null));
      return;
    }
    const impression = await readItem(uri);
    if (look !== lookGeneration.current) return;
    setChecking(false);
    setItemKind(impression?.category ?? null);
    if (impression?.item.trim()) {
      const brand = confirmedBrand(impression, measurement?.text ?? []);
      setLooksLike(brand ? `${impression.item} · ${brand}` : impression.item);
    }
    const hints = cluesFrom(measurement, impression);
    setClues(hints);
    void estimatePhoto(image, hints, uri);
  };

  const forgetLook = () => {
    lookGeneration.current += 1;
    setChecking(false);
    setProblem(undefined);
    setLooksLike(undefined);
    setItemKind(null);
    setClues(undefined);
  };

  useEffect(() => {
    if (running) prepareItemReader();
  }, [running]);

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
      const shot = await camera.current.takePictureAsync({ quality: 0.85 });
      if (captureSession !== session.current) return;
      if (!shot?.uri) throw new Error('No photo returned');
      // Only what's inside the frame is read, priced and kept: the rest of the scene is cut
      // away, so a lamp behind the item isn't what gets valued.
      const photo = await framedPhoto(shot, frame.current);
      if (captureSession !== session.current) return;
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
      void lookThenEstimate(photo.uri, image);
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
    const working = checking || estimating;
    const retake = () => {
      stopEstimate();
      forgetLook();
      setEstimating(false);
      setEstimate(undefined);
      setSaved(undefined);
      setEstimateError(undefined);
      setReady(false);
      setPhotoUri(undefined);
      setPhotoData(undefined);
    };
    const labelRead = clues?.text.find((text) => {
      const trimmed = text.trim();
      return trimmed.length >= 2 && trimmed.length <= 18;
    });
    const found: FoundSticker[] = [
      ...(labelRead ? [{ label: 'LABEL', value: `“${labelRead.trim()}”` }] : []),
      ...(looksLike ? [{ label: 'LOOKS LIKE', value: looksLike }] : []),
    ];
    const priced = estimate?.status === 'estimated' ? estimate : undefined;
    const kept = priced && (saved === 'saved' || saved === 'pending');
    return (
      <ScrollView
        style={[styles.root, { backgroundColor: colors.canvas }]}
        contentContainerStyle={[styles.review, { paddingBottom: insets.bottom + 24 }]}
      >
        {working ? (
          <EstimatingScene
            photoUri={photoUri}
            stage={checking ? 'looking' : 'estimating'}
            looksLike={looksLike}
            labelRead={labelRead?.trim()}
            topInset={insets.top}
            onClose={onClose}
          />
        ) : (
          <CaptureResultScene
            photoUri={photoUri}
            topInset={insets.top}
            onClose={onClose}
            eyebrow={
              priced
                ? 'PRICED BY WORTHY'
                : problem
                  ? 'CHECK THE PHOTO'
                  : estimate
                    ? 'COULDN’T PRICE IT'
                    : 'NOT PRICED YET'
            }
            title={
              priced
                ? priced.itemName || 'Estimated item'
                : problem
                  ? // Worthy's note below says what's wrong; the band doesn't repeat it.
                    'One thing first'
                  : estimate
                    ? estimate.itemName || 'Could not identify the item'
                    : estimateError
                      ? 'That didn’t work'
                      : 'Your photo'
            }
            amountPhp={priced?.amountPhp}
            formatPrice={priced ? formatPhp : undefined}
            found={priced ? found : []}
          />
        )}

        <View style={styles.body}>
          {problem ? (
            <WorthyNote
              mood="attentive"
              title={photoProblemCopy[problem].title}
              body={photoProblemCopy[problem].body}
            />
          ) : null}

          {priced ? (
            <EstimateRange
              lowPhp={priced.lowPhp}
              highPhp={priced.highPhp}
              amountPhp={priced.amountPhp}
              formatPrice={formatPhp}
            />
          ) : null}

          {estimate ? (
            <View
              style={[styles.card, { backgroundColor: colors.surface }, held(colors, 3)]}
              accessibilityLiveRegion="polite"
            >
              <SWText variant="stamp" color={colors.textMuted}>
                Worthy’s take
              </SWText>
              <SWText variant="bodyMedium" color={colors.textPrimary}>
                {estimate.explanation}
              </SWText>
              {estimate.assumptions.length > 0 ? (
                <View style={[styles.assumptions, { borderTopColor: colors.borderSubtle }]}>
                  <SWText variant="stamp" color={colors.textMuted}>
                    Assuming
                  </SWText>
                  {estimate.assumptions.map((assumption, index) => (
                    <SWText key={index} variant="caption" color={colors.textSecondary}>
                      {`•  ${assumption}`}
                    </SWText>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {estimateError ? (
            <WorthyNote mood="attentive" title="That didn’t work" body={estimateError} />
          ) : null}

          {/* Worth reading while it works: the shots that would sharpen the estimate. */}
          {!checking && !problem ? <CoachList coach={coachFor(itemKind)} /> : null}

          {estimate ? (
            <SWText variant="caption" color={colors.textSecondary} align="center">
              {kept
                ? saved === 'saved'
                  ? 'Saved to your History.'
                  : 'Saved to your History on this phone. It’ll sync when you’re back online.'
                : priced && saved === 'saving'
                  ? 'Saving to your History…'
                  : 'This photo and estimate have not been added to History.'}
            </SWText>
          ) : null}

          <View style={styles.actions}>
            {kept ? <Button label="View in History" onPress={onOpenHistory} /> : null}
            {(estimateError || estimate?.status === 'unable_to_estimate') && photoData ? (
              <Button
                label="Retry estimate"
                onPress={() => void estimatePhoto(photoData, clues, photoUri)}
              />
            ) : null}
            {problem && photoData ? (
              <Button
                label="Price it anyway"
                onPress={() => {
                  setProblem(undefined);
                  void estimatePhoto(photoData, clues, photoUri);
                }}
              />
            ) : null}
            <Button label="Retake photo" variant="secondary" onPress={retake} />
          </View>
        </View>
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
            zoom={zoom}
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
        zoom={zoom}
        onZoomChange={setZoom}
        onFrameLayout={(next) => {
          frame.current = next;
        }}
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

/** The camera is always dark, whatever the app's theme: its pieces take the dark palette. */
const darkColors = tokens.color.dark;

/** Worthy, with something to tell you about the photo: a problem, or an estimate that failed. */
function WorthyNote({
  mood,
  title,
  body,
}: {
  readonly mood: CompanionMood;
  readonly title: string;
  readonly body: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.note, { backgroundColor: colors.surfaceRaised }, held(colors, 3)]}
      accessibilityLiveRegion="polite"
    >
      <Worthy size={52} mood={mood} />
      <View style={styles.noteWords}>
        <SWText variant="headingSmall" color={colors.textPrimary}>
          {title}
        </SWText>
        <SWText variant="bodyMedium" color={colors.textSecondary}>
          {body}
        </SWText>
      </View>
    </View>
  );
}

/** The photo coach after a snap: the shots that would help buyers and the AI judge it. */
function CoachList({ coach }: { readonly coach: PhotoCoach }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.coach, { backgroundColor: colors.sand, borderColor: colors.borderStrong }]}
      accessible
      accessibilityLabel={`${coach.title}: ${coach.shots.join(', ')}`}
    >
      <SWText variant="stamp" color={colors.sandInk}>
        Sharper estimate tips
      </SWText>
      <SWText variant="label" color={colors.textPrimary}>
        {coach.title}
      </SWText>
      {coach.shots.map((shot) => (
        <SWText key={shot} variant="caption" color={colors.textSecondary}>
          {`•  ${shot}`}
        </SWText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  coach: {
    gap: tokens.spacing[1] + 2,
    padding: tokens.spacing[4],
    borderRadius: tokens.radius.large,
    borderWidth: 1,
  },
  root: { flex: 1, backgroundColor: darkColors.sunken },
  panel: {
    flex: 1,
    backgroundColor: darkColors.sunken,
    paddingHorizontal: tokens.spacing[6],
    gap: tokens.spacing[4],
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  review: { flexGrow: 1, gap: tokens.spacing[5] },
  body: { paddingHorizontal: tokens.spacing[5], gap: tokens.spacing[4] },
  card: {
    gap: tokens.spacing[2] + 2,
    padding: tokens.spacing[4],
    borderRadius: tokens.radius.large,
  },
  assumptions: {
    gap: tokens.spacing[1] + 2,
    marginTop: tokens.spacing[2],
    paddingTop: tokens.spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    padding: tokens.spacing[4],
    borderRadius: tokens.radius.large,
  },
  noteWords: { flex: 1, gap: tokens.spacing[1] },
  actions: { gap: tokens.spacing[3], marginTop: tokens.spacing[1] },
  error: {
    position: 'absolute',
    left: tokens.spacing[6],
    right: tokens.spacing[6],
    padding: tokens.spacing[4],
    backgroundColor: darkColors.sunken,
    gap: tokens.spacing[4],
  },
});

/** The longest side a photo is sent at: plenty for the AI, and well under the 4 MB limit. */
const longestSide = 1600;

/**
 * The photo cut down to the camera's frame (with a little room around it), shrunk to a sensible
 * size and encoded for the estimate. Without a frame to go by, the whole photo is used.
 */
async function framedPhoto(
  shot: { readonly uri: string; readonly width: number; readonly height: number },
  frame: CaptureFrame | null,
): Promise<{ readonly uri: string; readonly base64: string }> {
  const crop = frame
    ? cropToFrame(
        shot,
        { width: frame.screenWidth, height: frame.screenHeight },
        { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
      )
    : null;
  const context = ImageManipulator.manipulate(shot.uri);
  if (crop) context.crop(crop);
  const width = crop?.width ?? shot.width;
  const height = crop?.height ?? shot.height;
  if (Math.max(width, height) > longestSide) {
    context.resize(width >= height ? { width: longestSide } : { height: longestSide });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error('The photo could not be prepared.');
  return { uri: saved.uri, base64: saved.base64 };
}

function formatPhp(amount: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(amount);
}
