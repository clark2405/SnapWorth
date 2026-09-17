import type { AppError } from './errors';

export type AsyncState<T, RecoverableInput = unknown> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly previous?: T }
  | { readonly status: 'ready'; readonly data: T }
  | { readonly status: 'empty' }
  | {
      readonly status: 'offline';
      readonly previous?: T;
      readonly recoverableInput?: RecoverableInput;
    }
  | {
      readonly status: 'error';
      readonly error: AppError;
      readonly previous?: T;
      readonly recoverableInput?: RecoverableInput;
      readonly canRetry: boolean;
    };
