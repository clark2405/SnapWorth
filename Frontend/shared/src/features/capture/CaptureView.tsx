import { LinearGradient } from 'expo-linear-gradient';
import { CircleX, GalleryHorizontal, History, Sparkles, Zap } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, PressableScale, Reveal, SWText } from '../../components';
import { tokens } from '../../design';

export interface CaptureViewProps {
  /**
   * The live camera preview. Camera access is not wired yet (capture task 5), so by default
   * the viewfinder is an empty dark surface.
   */
  readonly viewfinder?: ReactNode;
  readonly flashOn?: boolean;
  readonly onClose?: () => void;
  readonly onToggleFlash?: () => void;
  readonly onCapture?: () => void;
  readonly onOpenGallery?: () => void;
  readonly onOpenHistory?: () => void;
}

const bracketCorners = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;

export function CaptureView({
  viewfinder,
  flashOn = false,
  onClose,
  onToggleFlash,
  onCapture,
  onOpenGallery,
  onOpenHistory,
}: CaptureViewProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>{viewfinder}</View>

      <View style={[styles.column, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Reveal index={0} style={styles.topBar}>
          <IconButton
            icon={CircleX}
            label="Close camera"
            appearance="glass"
            onPress={onClose}
            size={20}
          />
          <IconButton
            icon={Zap}
            label={flashOn ? 'Turn flash off' : 'Turn flash on'}
            appearance="glass"
            tone={flashOn ? 'accent' : 'textPrimary'}
            onPress={onToggleFlash}
            size={20}
          />
        </Reveal>

        <View style={styles.frameArea} pointerEvents="none">
          <Reveal index={1} style={styles.frame}>
            {bracketCorners.map((corner) => (
              <View key={corner} style={[styles.bracket, styles[corner]]} />
            ))}
          </Reveal>
        </View>

        <Reveal index={2} style={styles.hint}>
          <Sparkles size={16} strokeWidth={2} color={tokens.color.dark.accent} />
          <SWText variant="labelMedium" accessibilityLiveRegion="polite">
            Position item clearly inside bounds
          </SWText>
        </Reveal>

        <Reveal index={3} style={styles.controls}>
          <IconButton
            icon={GalleryHorizontal}
            label="Choose a photo from your gallery"
            appearance="glass"
            onPress={onOpenGallery}
            size={20}
          />
          <PressableScale
            accessibilityLabel="Take photo"
            accessibilityHint="Saves the photo to your history and starts the AI estimate"
            onPress={onCapture}
            style={styles.shutterRing}
          >
            <LinearGradient
              colors={[tokens.glow.mintTop, tokens.glow.mintBottom]}
              style={styles.shutter}
            />
          </PressableScale>
          <IconButton
            icon={History}
            label="Open your history"
            appearance="glass"
            onPress={onOpenHistory}
            size={20}
          />
        </Reveal>
      </View>
    </View>
  );
}

const bracketSize = 44;
const bracketStroke = 3;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.color.dark.sunken,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: tokens.layout.phoneColumn,
    alignSelf: 'center',
    paddingHorizontal: tokens.spacing[5],
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: tokens.spacing[4],
  },
  frameArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '52%',
    aspectRatio: 0.88,
  },
  bracket: {
    position: 'absolute',
    width: bracketSize,
    height: bracketSize,
    borderColor: tokens.color.dark.accent,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: bracketStroke,
    borderLeftWidth: bracketStroke,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: bracketStroke,
    borderRightWidth: bracketStroke,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: bracketStroke,
    borderLeftWidth: bracketStroke,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: bracketStroke,
    borderRightWidth: bracketStroke,
  },
  hint: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[2],
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.glass.fillChrome,
    borderWidth: tokens.border.hairline,
    borderColor: tokens.glass.borderStrong,
    marginBottom: tokens.spacing[8],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: tokens.spacing[8],
  },
  shutterRing: {
    width: 84,
    height: 84,
    borderRadius: tokens.radius.full,
    padding: 5,
    borderWidth: 2,
    borderColor: tokens.glass.borderStrong,
    boxShadow: tokens.glow.capture,
  },
  shutter: {
    flex: 1,
    borderRadius: tokens.radius.full,
  },
});
