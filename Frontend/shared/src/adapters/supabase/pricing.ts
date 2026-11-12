import type { SupabaseClient } from '@supabase/supabase-js';

import { isPhotoEstimate, type PhotoPricingService } from '../../types/photo-estimate';

const messages: Record<string, string> = {
  rate_limited: 'The free AI limit has been reached. Keep this photo and try again later.',
  timeout: 'The estimate took too long. Please try again.',
  image_too_large: 'This photo is too large to estimate. Please retake it.',
  invalid_image: 'This photo could not be read. Please retake it.',
  unable_to_estimate: 'The AI could not identify this item. Try a clearer photo.',
  invalid_response: 'The AI did not return a valid estimate. Please try again.',
  authentication_required: 'Your estimation session expired. Please try again.',
  not_configured: 'Price estimation is not available yet. Please try again later.',
};

export function createPhotoPricingService(client: SupabaseClient): PhotoPricingService {
  return {
    async estimate(image, signal, clues) {
      if (signal?.aborted) throw new Error('The estimate was canceled.');
      const { data, error } = await client.auth.getSession();
      if (error) throw new Error('Could not check your account. Please try again.');
      // An estimate is for an account (the screens gate Snap, and each account has a daily
      // limit): never sign a device in anonymously to get one. An old anonymous session left by
      // an earlier build counts as signed out.
      if (!data.session || data.session.user?.is_anonymous) {
        throw new Error('Sign in to get a price estimate.');
      }
      if (signal?.aborted) throw new Error('The estimate was canceled.');
      const response = await client.functions.invoke<unknown>('estimate-price', {
        // Clues are optional: a function deployed before them ignores the field.
        body: clues ? { image, clues } : { image },
        signal,
      });
      if (response.error) {
        let code = '';
        try {
          const context = response.error.context;
          if (context instanceof Response) {
            const body = await context.json();
            code = typeof body?.code === 'string' ? body.code : '';
          }
        } catch {
          /* An offline or undeployed function may not return JSON. */
        }
        throw new Error(
          messages[code] ?? 'Could not get a price estimate. Check your connection and try again.',
        );
      }
      if (!isPhotoEstimate(response.data)) throw new Error(messages.invalid_response);
      return response.data;
    },
  };
}
