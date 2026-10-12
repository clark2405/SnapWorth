import * as ImagePicker from 'expo-image-picker';

import type { ItemPhoto } from '@snapworth/shared/components';

/**
 * Opens the photo library for one photo. Backing out picks nothing. The system picker needs no
 * library permission.
 */
export async function pickPhoto(): Promise<ItemPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 0.85,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset ? { source: { uri: asset.uri }, label: 'Your photo' } : null;
}
