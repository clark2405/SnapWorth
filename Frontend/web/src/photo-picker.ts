import * as ImagePicker from 'expo-image-picker';

import type { ItemPhoto } from '@snapworth/shared/components';

/**
 * Opens the photo library for up to `room` more photos of an item, in the order they were
 * picked. Backing out picks nothing. The system picker needs no library permission.
 */
export async function pickItemPhotos(room: number): Promise<readonly ItemPhoto[]> {
  if (room <= 0) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: room > 1,
    selectionLimit: room,
    orderedSelection: true,
    quality: 0.85,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, room).map((asset, index) => ({
    source: { uri: asset.uri },
    label: `Your photo ${index + 1}`,
  }));
}
