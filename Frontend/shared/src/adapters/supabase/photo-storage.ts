import type { SupabaseClient } from '@supabase/supabase-js';

/** The private bucket for scan photos, and the public one for profile photos (see the migration). */
export const scanPhotoBucket = 'scan-photos';
export const avatarBucket = 'avatars';

/** How long a link to a scan photo works: a day's use of the app, then History asks again. */
export const scanPhotoLinkSeconds = 12 * 60 * 60;

/** Reads a photo on this device (`file://`, `content://`, `blob:` or `data:`) into bytes. */
export type ReadPhoto = (uri: string) => Promise<ArrayBuffer>;

/**
 * Reads a photo with `fetch`, which React Native and browsers both answer for a local file, a
 * blob and a data URI. The bytes go to Storage as an `ArrayBuffer`: what supabase-js uploads
 * from React Native, where a `Blob` is known to arrive empty, so no file-system package is
 * needed.
 */
export const readPhotoBytes: ReadPhoto = async (uri) => {
  try {
    const response = await fetch(uri);
    // A local file answers 0 on some platforms and 200 on others.
    if (response.status < 400) {
      return await response.arrayBuffer();
    }
  } catch {
    // Fall back to XMLHttpRequest for local file:// URIs where fetch fails
  }

  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => {
        if (xhr.response instanceof ArrayBuffer) {
          resolve(xhr.response);
        } else if (xhr.response) {
          resolve(xhr.response as ArrayBuffer);
        } else {
          reject(new Error("The photo couldn't be read."));
        }
      };
      xhr.onerror = () => reject(new Error("The photo couldn't be read."));
      xhr.responseType = 'arraybuffer';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  }

  throw new Error("The photo couldn't be read.");
};

export type PhotoType = 'image/jpeg' | 'image/png' | 'image/webp';

/** What kind of picture the bytes are, from their first few, or null when they aren't one. */
export function photoTypeOf(bytes: ArrayBuffer): PhotoType | null {
  const head = new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength));
  const at = (offset: number, ...expected: number[]) =>
    expected.every((value, index) => head[offset + index] === value);
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  // RIFF....WEBP
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
  return null;
}

const extensionOf: Readonly<Record<PhotoType, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Where a scan's photo goes: the owner's folder, named after the scan. */
export const scanPhotoPath = (owner: string, scanId: string) => `${owner}/${scanId}.jpg`;

/**
 * Scan photos in Storage. Each call reports failure as `null` / `false` / no link rather than
 * throwing: the photo on the phone stands in until a later try works.
 */
export interface ScanPhotoStore {
  /** Uploads (or replaces) a scan's photo and resolves with its path, or null if it didn't go. */
  upload(owner: string, scanId: string, uri: string): Promise<string | null>;
  /** Links that show each photo for a while, by path. Paths it couldn't sign are left out. */
  links(paths: readonly string[]): Promise<Readonly<Record<string, string>>>;
  remove(path: string): Promise<boolean>;
}

export function createSupabaseScanPhotos(
  client: SupabaseClient,
  read: ReadPhoto = readPhotoBytes,
): ScanPhotoStore {
  return {
    async upload(owner, scanId, uri) {
      try {
        const bytes = await read(uri);
        // The bucket takes the camera's JPEGs only.
        if (photoTypeOf(bytes) !== 'image/jpeg') return null;
        const path = scanPhotoPath(owner, scanId);
        const { error } = await client.storage
          .from(scanPhotoBucket)
          .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
        return error ? null : path;
      } catch {
        return null;
      }
    },

    async links(paths) {
      if (paths.length === 0) return {};
      try {
        const { data, error } = await client.storage
          .from(scanPhotoBucket)
          .createSignedUrls([...paths], scanPhotoLinkSeconds);
        if (error || !data) return {};
        return Object.fromEntries(
          data.flatMap((entry) =>
            entry.path && entry.signedUrl && !entry.error ? [[entry.path, entry.signedUrl]] : [],
          ),
        );
      } catch {
        return {};
      }
    },

    async remove(path) {
      try {
        const { error } = await client.storage.from(scanPhotoBucket).remove([path]);
        return !error;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Uploads someone's profile photo to their avatar folder, replacing the last one, and resolves
 * with the public URL their profile can point at. The `?v=` changes with each upload, so nobody
 * keeps seeing a cached old photo. Throws if it couldn't be uploaded.
 */
export async function uploadAvatar(
  client: SupabaseClient,
  owner: string,
  uri: string,
  { read = readPhotoBytes, now = Date.now }: { read?: ReadPhoto; now?: () => number } = {},
): Promise<string> {
  const bytes = await read(uri);
  const type = photoTypeOf(bytes);
  if (!type) throw new Error('That photo isn’t a JPEG, PNG or WebP picture.');
  const bucket = client.storage.from(avatarBucket);
  const path = `${owner}/avatar.${extensionOf[type]}`;
  const { error } = await bucket.upload(path, bytes, { contentType: type, upsert: true });
  if (error) throw new Error(error.message);
  // One photo each: an older one of another kind goes.
  const others = Object.values(extensionOf)
    .filter((extension) => extension !== extensionOf[type])
    .map((extension) => `${owner}/avatar.${extension}`);
  await bucket.remove(others).catch(() => undefined);
  return `${bucket.getPublicUrl(path).data.publicUrl}?v=${now()}`;
}
