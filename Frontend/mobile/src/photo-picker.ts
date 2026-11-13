import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
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

/** Profile photos are shown at most a few hundred points wide; this is plenty, and small. */
const profilePhotoSize = 512;

/**
 * Opens the photo library for a profile photo, cropped square and shrunk to a small JPEG. A
 * photo straight from the library is several megabytes, more than profile photos may be.
 */
export async function pickProfilePhoto(): Promise<ItemPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const side = Math.min(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);
  if (side > 0 && asset.width !== asset.height) {
    context.crop({
      originX: Math.round((asset.width - side) / 2),
      originY: Math.round((asset.height - side) / 2),
      width: side,
      height: side,
    });
  }
  context.resize({ width: profilePhotoSize, height: profilePhotoSize });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
  return { source: { uri: saved.uri }, label: 'Your photo' };
}
