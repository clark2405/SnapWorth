import { authParamsFromUrl } from './authApi';

describe('authParamsFromUrl', () => {
  it('reads a PKCE code from a custom-scheme query', () => {
    const params = authParamsFromUrl('snapworth://?code=abc123');
    expect(params.get('code')).toBe('abc123');
  });

  it('reads implicit tokens from the hash', () => {
    const params = authParamsFromUrl(
      'snapworth://#access_token=tok&refresh_token=ref&token_type=bearer',
    );
    expect(params.get('access_token')).toBe('tok');
    expect(params.get('refresh_token')).toBe('ref');
  });

  it('prefers hash values when both query and hash are present', () => {
    const params = authParamsFromUrl('exp://192.168.1.5:8081/--/?code=from-query#code=from-hash');
    expect(params.get('code')).toBe('from-hash');
  });
});
