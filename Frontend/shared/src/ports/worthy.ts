import type { AppError } from '../types/errors';
import type { Result } from '../types/result';

/** What a question to Worthy is about (see features/companion/worthy-replies.ts). */
export type WorthyCloudIntent = 'chat' | 'price' | 'trend' | 'collection' | 'listing';

/**
 * What Worthy is told about the person's own things, so its words are about them and not a
 * sample. Amounts here are the app's own (AI estimates, asking prices, typical prices).
 */
export interface WorthyContext {
  readonly scans: readonly {
    readonly title: string;
    readonly estimatePhp: number;
    readonly lowPhp: number;
    readonly highPhp: number;
    readonly note: string;
    readonly status: string;
    /** The item the question is about, when there is one. */
    readonly subject?: boolean;
  }[];
  readonly listing?: {
    readonly title: string;
    readonly askingPhp: number;
    readonly estimatePhp: number | null;
    readonly lowPhp: number | null;
    readonly highPhp: number | null;
    readonly condition: string;
    readonly mine: boolean;
  };
  readonly trends: readonly {
    readonly category: string;
    readonly typicalAskingPhp: number;
    readonly listedThisMonth: number;
    readonly change: string | null;
  }[];
}

export interface WorthyTurn {
  readonly role: 'user' | 'worthy';
  readonly text: string;
}

export interface WorthyCloudReply {
  readonly intent: WorthyCloudIntent;
  readonly reply: string;
  /** A listing draft, for a "write my listing" question about a real item. */
  readonly draft: { readonly title: string; readonly description: string } | null;
}

/** Worthy's chat in the cloud (the `worthy-chat` Edge Function). */
export interface WorthyCloud {
  ask(
    question: string,
    history: readonly WorthyTurn[],
    context: WorthyContext,
    signal?: AbortSignal,
  ): Promise<Result<WorthyCloudReply, AppError>>;
}
