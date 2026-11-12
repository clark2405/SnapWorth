import type { SupabaseClient } from '@supabase/supabase-js';

import {
  createSupabaseScanPhotos,
  photoTypeOf,
  readPhotoBytes,
  scanPhotoLinkSeconds,
  uploadAvatar,
} from './photo-storage';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]).buffer;
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]).buffer;
const text = new TextEncoder().encode('<svg onload=alert(1)>').buffer;

/** A stand-in Supabase Storage that records what each bucket was asked to do. */
function fakeStorage({ failUpload = false } = {}) {
  const calls: { bucket: string; action: string; args: unknown[] }[] = [];
  const client = {
    storage: {
      from: (bucket: string) => ({
        upload: (...args: unknown[]) => {
          calls.push({ bucket, action: 'upload', args });
          return Promise.resolve(
            failUpload ? { data: null, error: { message: 'denied' } } : { data: {}, error: null },
          );
        },
        remove: (...args: unknown[]) => {
          calls.push({ bucket, action: 'remove', args });
          return Promise.resolve({ data: [], error: null });
        },
        createSignedUrls: (paths: string[], seconds: number) => {
          calls.push({ bucket, action: 'sign', args: [paths, seconds] });
          return Promise.resolve({
            data: paths.map((path) =>
              path.includes('missing')
                ? { path, signedUrl: null, error: 'Object not found' }
                : { path, signedUrl: `https://project.test/sign/${path}?token=t`, error: null },
            ),
            error: null,
          });
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://project.test/storage/v1/object/public/${bucket}/${path}` },
        }),
      }),
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

it('tells pictures apart by their first bytes, and turns down anything else', () => {
  expect(photoTypeOf(jpeg)).toBe('image/jpeg');
  expect(photoTypeOf(png)).toBe('image/png');
  expect(photoTypeOf(webp)).toBe('image/webp');
  expect(photoTypeOf(text)).toBeNull();
  expect(photoTypeOf(new ArrayBuffer(0))).toBeNull();
});

it('reads a photo with fetch, as the web’s data URIs and the phone’s files are read', async () => {
  const bytes = await readPhotoBytes('data:image/jpeg;base64,/9j/4AAQ');
  expect(photoTypeOf(bytes)).toBe('image/jpeg');
});

describe('scan photos', () => {
  it('uploads the photo’s bytes into the owner’s folder, named after the scan', async () => {
    const { client, calls } = fakeStorage();
    const read = jest.fn(async () => jpeg);
    const photos = createSupabaseScanPhotos(client, read);

    expect(await photos.upload('user-1', 'scan-1', 'file:///photo.jpg')).toBe('user-1/scan-1.jpg');
    expect(read).toHaveBeenCalledWith('file:///photo.jpg');
    expect(calls).toEqual([
      {
        bucket: 'scan-photos',
        action: 'upload',
        args: ['user-1/scan-1.jpg', jpeg, { contentType: 'image/jpeg', upsert: true }],
      },
    ]);
  });

  it('reports a photo it couldn’t read, upload or recognise as not sent', async () => {
    const unreadable = createSupabaseScanPhotos(fakeStorage().client, () =>
      Promise.reject(new Error('gone')),
    );
    expect(await unreadable.upload('user-1', 'scan-1', 'file:///gone.jpg')).toBeNull();

    const refused = createSupabaseScanPhotos(fakeStorage({ failUpload: true }).client, () =>
      Promise.resolve(jpeg),
    );
    expect(await refused.upload('user-1', 'scan-1', 'file:///photo.jpg')).toBeNull();

    const { client, calls } = fakeStorage();
    const notJpeg = createSupabaseScanPhotos(client, () => Promise.resolve(text));
    expect(await notJpeg.upload('user-1', 'scan-1', 'file:///photo.jpg')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('asks for links in one go, for a limited time, and leaves out ones it couldn’t sign', async () => {
    const { client, calls } = fakeStorage();
    const photos = createSupabaseScanPhotos(client);

    expect(await photos.links(['user-1/a.jpg', 'user-1/missing.jpg'])).toEqual({
      'user-1/a.jpg': 'https://project.test/sign/user-1/a.jpg?token=t',
    });
    expect(calls).toEqual([
      {
        bucket: 'scan-photos',
        action: 'sign',
        args: [['user-1/a.jpg', 'user-1/missing.jpg'], scanPhotoLinkSeconds],
      },
    ]);
    expect(await photos.links([])).toEqual({});
  });
});

describe('profile photos', () => {
  it('replaces the owner’s one photo and gives a public URL that changes with each upload', async () => {
    const { client, calls } = fakeStorage();

    const url = await uploadAvatar(client, 'user-1', 'file:///me.png', {
      read: () => Promise.resolve(png),
      now: () => 1731240000000,
    });

    expect(url).toBe(
      'https://project.test/storage/v1/object/public/avatars/user-1/avatar.png?v=1731240000000',
    );
    expect(calls).toEqual([
      {
        bucket: 'avatars',
        action: 'upload',
        args: ['user-1/avatar.png', png, { contentType: 'image/png', upsert: true }],
      },
      // An older photo of another kind doesn't linger.
      { bucket: 'avatars', action: 'remove', args: [['user-1/avatar.jpg', 'user-1/avatar.webp']] },
    ]);
  });

  it('turns down a file that isn’t a picture, and says when the upload failed', async () => {
    await expect(
      uploadAvatar(fakeStorage().client, 'user-1', 'file:///x', {
        read: () => Promise.resolve(text),
      }),
    ).rejects.toThrow('JPEG, PNG or WebP');
    await expect(
      uploadAvatar(fakeStorage({ failUpload: true }).client, 'user-1', 'file:///me.jpg', {
        read: () => Promise.resolve(jpeg),
      }),
    ).rejects.toThrow('denied');
  });
});
