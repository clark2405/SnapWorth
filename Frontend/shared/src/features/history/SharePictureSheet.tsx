import { Share2 } from 'lucide-react-native';
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { View } from 'react-native';

import { Button, Sheet, useToast } from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import { shareCardImage, type ShareOutcome } from './share-image';
import { shareCardSize } from './ShareTagCard';

const outcomeToast: Record<ShareOutcome, { title: string; body?: string } | null> = {
  opened: null,
  saved: { title: 'Picture saved', body: 'It’s in your downloads, ready to post.' },
  text: { title: 'Shared as text', body: 'This device couldn’t make the picture.' },
  failed: { title: 'Couldn’t share', body: 'Try again in a moment.' },
};

/**
 * Shows a card exactly as the picture that will be shared, then shares it. The card is drawn by
 * `renderCard` at the share size (`shareCardSize`), into the ref it's given; anything else, like
 * a switch for what goes on it, comes as children below.
 */
export function SharePictureSheet({
  visible,
  onClose,
  title,
  fallbackText,
  renderCard,
  children,
}: {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title: string;
  /** Shared instead when the picture can't be made. */
  readonly fallbackText: string;
  readonly renderCard: (ref: RefObject<View | null>) => ReactNode;
  readonly children?: ReactNode;
}) {
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const card = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const [room, setRoom] = useState<number>(shareCardSize.width);
  // A narrow phone sees the card smaller; the picture is still made at full size.
  const scale = Math.min(1, room / shareCardSize.width);

  const share = async () => {
    setSharing(true);
    const outcome = await shareCardImage(card, fallbackText);
    setSharing(false);
    const message = outcomeToast[outcome];
    if (message) toast.show(message);
    if (outcome !== 'failed') onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View
        style={styles.stage}
        onLayout={(event) => setRoom(Math.floor(event.nativeEvent.layout.width))}
      >
        <View style={{ width: shareCardSize.width * scale, height: shareCardSize.height * scale }}>
          <View
            style={[
              styles.scaler,
              { transform: [{ scale }] },
              // Scaled from its top-left corner, so it fills the box above.
              { transformOrigin: 'top left' },
            ]}
          >
            {renderCard(card)}
          </View>
        </View>
      </View>
      {children}
      <Button
        label={sharing ? 'Making your picture…' : 'Share'}
        icon={Share2}
        haptic="pop"
        disabled={sharing}
        onPress={() => void share()}
      />
    </Sheet>
  );
}

const stylesFor = themedStyles(() => ({
  stage: {
    alignItems: 'center',
  },
  scaler: {
    width: shareCardSize.width,
    height: shareCardSize.height,
    borderRadius: tokens.radius.medium,
    overflow: 'hidden',
  },
}));
