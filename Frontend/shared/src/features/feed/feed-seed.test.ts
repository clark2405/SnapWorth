import { isDevicePost, sampleAvatarFor, sampleFeedPhoto } from './feed-seed';

describe('sample feed content', () => {
  it('only treats posts made on the device as sample ones', () => {
    expect(isDevicePost({ id: 'retro-windbreaker' })).toBe(true);
    expect(isDevicePost({ id: 'local-post-0001' })).toBe(true);
    expect(isDevicePost({ id: '00000000-0000-4000-ff00-000000000001' })).toBe(false);
  });

  it('has a bundled photo for a sample post and for the sample listing it reposts', () => {
    expect(sampleFeedPhoto({ id: 'retro-windbreaker' })).toBeTruthy();
    expect(
      sampleFeedPhoto({ id: 'local-post-1', listing: { slug: 'air-jordan-1-bred' } }),
    ).toBeTruthy();
  });

  it('knows sample people by handle, and nobody else', () => {
    expect(sampleAvatarFor('@Retro_Curator')).toBeTruthy();
    expect(sampleAvatarFor('someone_real')).toBeNull();
  });
});
