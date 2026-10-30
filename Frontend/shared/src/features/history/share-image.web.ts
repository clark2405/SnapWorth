import type { RefObject } from 'react';
import type { View } from 'react-native';

import { shareCardSize } from './ShareTagCard';

/**
 * `opened` once the share sheet has shown, `saved` when the picture was downloaded instead,
 * `text` when only words could be shared (copied).
 */
export type ShareOutcome = 'opened' | 'saved' | 'text' | 'failed';

/**
 * Draws the card into a picture and hands it to the browser's share sheet where it can take
 * files (phones, Safari); elsewhere the picture is downloaded, ready to post.
 */
export async function shareCardImage(
  card: RefObject<View | null>,
  fallbackText: string,
): Promise<ShareOutcome> {
  try {
    // On the web a view is an element.
    const element = card.current as unknown as HTMLElement | null;
    if (!element) throw new Error('No card to draw');
    const { default: html2canvas } = await import('html2canvas-pro');
    const canvas = await html2canvas(element, {
      useCORS: true,
      backgroundColor: null,
      scale: (shareCardSize.width * 3) / element.offsetWidth,
    });
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (made) => (made ? resolve(made) : reject(new Error('No picture'))),
        'image/png',
      ),
    );
    const file = new File([blob], 'snapworth-tag.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'My SnapWorth tag' });
        return 'opened';
      } catch (error) {
        // Closing the share sheet isn't a failure.
        if (error instanceof DOMException && error.name === 'AbortError') return 'opened';
        throw error;
      }
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'snapworth-tag.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    return 'saved';
  } catch {
    try {
      await navigator.clipboard.writeText(fallbackText);
      return 'text';
    } catch {
      return 'failed';
    }
  }
}
