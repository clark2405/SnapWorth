import type { SupabaseClient } from '@supabase/supabase-js';

import { createPhotoPricingService } from './pricing';

const image = { data: '/9j/4AAQSkZJRg==', mimeType: 'image/jpeg' as const };
const result = {
  status: 'estimated',
  itemName: 'Jacket',
  amountPhp: 1500,
  lowPhp: 900,
  highPhp: 2500,
  explanation: 'Approximate resale value.',
  assumptions: [],
};
function setup(signedIn = true) {
  const invoke = jest.fn().mockResolvedValue({ data: result, error: null });
  const anonymous = jest
    .fn()
    .mockResolvedValue({ data: { session: { access_token: 'session' } }, error: null });
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: signedIn ? { access_token: 'session' } : null },
        error: null,
      }),
      signInAnonymously: anonymous,
    },
    functions: { invoke },
  };
  return {
    service: createPhotoPricingService(client as unknown as SupabaseClient),
    invoke,
    anonymous,
  };
}
it('sends the captured image to the backend without creating a second session', async () => {
  const { service, invoke, anonymous } = setup();
  const signal = new AbortController().signal;
  expect(await service.estimate(image, signal)).toEqual(result);
  expect(invoke).toHaveBeenCalledWith('estimate-price', { body: { image }, signal });
  expect(anonymous).not.toHaveBeenCalled();
});
it('establishes a background anonymous session when no backend session exists', async () => {
  const { service, anonymous } = setup(false);
  await service.estimate(image);
  expect(anonymous).toHaveBeenCalledTimes(1);
});
it('keeps quota failure explicit instead of returning a sample estimate', async () => {
  const { service, invoke } = setup();
  invoke.mockResolvedValue({
    data: null,
    error: { context: Response.json({ code: 'rate_limited' }, { status: 429 }) },
  });
  await expect(service.estimate(image)).rejects.toThrow('free AI limit');
});
it('rejects malformed provider data at the app boundary', async () => {
  const { service, invoke } = setup();
  invoke.mockResolvedValue({ data: { ...result, highPhp: 10 }, error: null });
  await expect(service.estimate(image)).rejects.toThrow('valid estimate');
});
