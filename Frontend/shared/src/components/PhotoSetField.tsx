import { ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { haptic, themedStyles, tokens, useTheme, useThemedStyles } from '../design';
import { Photo } from './Photo';
import { PhotoViewer, type ItemPhoto } from './PhotoViewer';
import { PressableScale } from './PressableScale';
import { SWText } from './SWText';

export interface PhotoSetFieldProps {
  /** The item's photos so far, cover first. */
  readonly photos: readonly ItemPhoto[];
  readonly onChange: (photos: readonly ItemPhoto[]) => void;
  /**
   * Lets the person pick more photos, at most `room` of them; resolves with what they chose
   * (nothing if they backed out). The shell supplies it; without it there is no Add tile.
   */
  readonly onAddPhotos?: (room: number) => Promise<readonly ItemPhoto[]>;
  /** The most photos an item can carry. */
  readonly max?: number;
}

const columns = 4;
const gap = tokens.spacing[2];

/**
 * An item's photos, up to four: the cover, then the angles a buyer asks about (the back, a
 * label, any wear). One row of square tiles; tap one to see it full screen, add more while
 * there is room, and take any but the last one away.
 */
export function PhotoSetField({ photos, onChange, onAddPhotos, max = 4 }: PhotoSetFieldProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const [width, setWidth] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const room = max - photos.length;
  const tile = width > 0 ? (width - gap * (columns - 1)) / columns : 0;

  const add = async () => {
    if (!onAddPhotos || room <= 0 || adding) return;
    setAdding(true);
    try {
      const picked = await onAddPhotos(room);
      if (picked.length > 0) {
        haptic('success');
        onChange([...photos, ...picked].slice(0, max));
      }
    } catch {
      // Backing out of the picker or a denied permission leaves the photos as they were.
    } finally {
      setAdding(false);
    }
  };

  const remove = (index: number) => {
    haptic('select');
    onChange(photos.filter((_, at) => at !== index));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.heading}>
        <SWText variant="overline" tone="textMuted">
          Photos
        </SWText>
        <SWText variant="caption" tone="textMuted">
          {photos.length} of {max}
        </SWText>
      </View>
      <View
        style={styles.row}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      >
        {tile > 0
          ? photos.map((photo, index) => (
              <Animated.View
                key={`${index}-${photo.label}`}
                entering={FadeIn.duration(tokens.motion.duration.base)}
                exiting={FadeOut.duration(tokens.motion.duration.fast)}
                layout={LinearTransition.springify().damping(20)}
                style={{ width: tile, height: tile }}
              >
                <Pressable
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`${index === 0 ? 'Cover photo' : `Photo ${index + 1}`}: ${photo.label}`}
                  accessibilityHint="Opens the photo full screen"
                  onPress={() => setViewing(index)}
                  style={styles.fill}
                >
                  <Photo
                    source={photo.source}
                    label={photo.label}
                    radius={tokens.radius.medium}
                    style={styles.fill}
                  />
                </Pressable>
                {index === 0 ? (
                  <View style={styles.cover} pointerEvents="none">
                    <SWText variant="caption" color={tokens.overlay.text}>
                      Cover
                    </SWText>
                  </View>
                ) : null}
                {photos.length > 1 ? (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${index === 0 ? 'cover photo' : `photo ${index + 1}`}`}
                    haptic="none"
                    hitSlop={tokens.spacing[2]}
                    onPress={() => remove(index)}
                    containerStyle={styles.removeSpot}
                    style={styles.remove}
                  >
                    <X size={12} strokeWidth={2.6} color={tokens.overlay.text} />
                  </PressableScale>
                ) : null}
              </Animated.View>
            ))
          : null}
        {tile > 0 && room > 0 && onAddPhotos ? (
          <Animated.View layout={LinearTransition.springify().damping(20)}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Add photos, ${room} more allowed`}
              haptic="select"
              disabled={adding}
              onPress={() => void add()}
              style={[styles.add, { width: tile, height: tile }]}
            >
              <ImagePlus size={20} strokeWidth={2} color={colors.textSecondary} />
              <SWText variant="caption" tone="textSecondary">
                Add
              </SWText>
            </PressableScale>
          </Animated.View>
        ) : null}
      </View>
      <SWText variant="caption" tone="textMuted">
        {room > 0
          ? `Add up to ${max} photos: the front, the back, a label, any wear.`
          : `That's ${max}, the most an item can have. Remove one to swap it.`}
      </SWText>

      <PhotoViewer
        photos={photos}
        index={viewing ?? 0}
        visible={viewing !== null}
        onClose={() => setViewing(null)}
      />
    </View>
  );
}

const stylesFor = themedStyles((colors) => ({
  wrap: {
    gap: tokens.spacing[2],
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    gap,
  },
  fill: {
    flex: 1,
  },
  cover: {
    position: 'absolute',
    left: tokens.spacing[1],
    bottom: tokens.spacing[1],
    paddingHorizontal: tokens.spacing[2],
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.overlay.chrome,
  },
  // The pressable's outer layer is what sits in the layout, so it carries the position.
  removeSpot: {
    position: 'absolute',
    top: tokens.spacing[1],
    right: tokens.spacing[1],
  },
  remove: {
    width: 22,
    height: 22,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.overlay.chrome,
  },
  add: {
    borderRadius: tokens.radius.medium,
    // Dashed: a place a photo can go, not one yet (the system's provisional style).
    borderWidth: tokens.border.focus,
    borderStyle: tokens.border.provisionalStyle,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[1],
    backgroundColor: colors.sunken,
  },
}));
