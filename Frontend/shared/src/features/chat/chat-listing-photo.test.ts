import { chatListingPhoto } from './chat-listing-photo';

describe('chatListingPhoto', () => {
  it('uses the listing’s own photo whatever the mode', () => {
    expect(
      chatListingPhoto({ key: 'x', photoUrl: 'https://signed.test/x.jpg' }, 'supabase'),
    ).toEqual({ uri: 'https://signed.test/x.jpg' });
  });

  it('shows the bundled sample photo only on a device with no Supabase project', () => {
    expect(chatListingPhoto({ key: 'polaroid-sun-600' }, 'device')).not.toBeNull();
    expect(chatListingPhoto({ key: 'polaroid-sun-600' }, 'supabase')).toBeNull();
  });

  it('has no photo for a listing it knows nothing about', () => {
    expect(chatListingPhoto({ key: '00000000-0000-4000-fc00-000000000001' }, 'device')).toBeNull();
  });
});
