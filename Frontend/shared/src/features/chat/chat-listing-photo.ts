import type { ImageSourcePropType } from 'react-native';

import type { ChatListing } from '../../types/entities';
import { previewPhotoByListingKey } from '../preview/sample-data';
import type { BackendMode } from '../session/backend-mode';

/**
 * The photo shown beside a chat's listing: the listing's own, or, in a build with no Supabase
 * project, the bundled photo of the sample listing. With a project a listing without a photo
 * (or one the person can no longer see) has none, and the chat shows a placeholder.
 */
export function chatListingPhoto(
  listing: Pick<ChatListing, 'key' | 'photoUrl'>,
  mode: BackendMode,
): ImageSourcePropType | null {
  if (listing.photoUrl) return { uri: listing.photoUrl };
  return mode === 'device' ? (previewPhotoByListingKey[listing.key] ?? null) : null;
}
