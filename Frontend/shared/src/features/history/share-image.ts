import type { RefObject } from 'react';
import { Share, type View } from 'react-native';

import { shareCardSize } from './ShareTagCard';

/**
 * `opened` once the share sheet has shown, `saved` when the picture was downloaded instead (the
 * web), `text` when only words could be shared.
 */
export type ShareOutcome = 'opened' | 'saved' | 'text' | 'failed';

/**
 * Photographs the card and opens the phone's share sheet with the picture, so it can go to
 * Instagram Stories, Messenger or anywhere else. An app built before the picture libraries were
 * added (or anything else going wrong) shares the words instead.
 */
export async function shareCardImage(
  card: RefObject<View | null>,
  fallbackText: string,
): Promise<ShareOutcome> {
  try {
    const [{ captureRef }, Sharing] = await Promise.all([
      import('react-native-view-shot'),
      import('expo-sharing'),
    ]);
    if (!card.current || !(await Sharing.isAvailableAsync())) throw new Error('No share sheet');
    const uri = await captureRef(card, {
      format: 'png',
      result: 'tmpfile',
      width: shareCardSize.width * 3,
      height: shareCardSize.height * 3,
    });
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      UTI: 'public.png',
      dialogTitle: 'Share your tag',
    });
    return 'opened';
  } catch {
    return shareText(fallbackText);
  }
}

async function shareText(message: string): Promise<ShareOutcome> {
  try {
    await Share.share({ message });
    return 'text';
  } catch {
    return 'failed';
  }
}
