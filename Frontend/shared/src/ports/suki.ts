import type { AppError } from '../types/errors';
import type { Result } from '../types/result';

/** The discounts a seller can give a suki, in percent. */
export const sukiDiscounts = [5, 10, 15, 20] as const;

/**
 * Suki: a seller's regular buyer, with a standing discount. Only the seller sets it, and only the
 * two of them see it.
 */
export interface SukiRepository {
  /**
   * The discount between the viewer and the other person in a chat: the one the viewer gives
   * them when the viewer is the seller, or the one the viewer gets when they're the buyer.
   */
  discountWith(otherUserId: string, iAmSeller: boolean): Promise<Result<number | null, AppError>>;
  /** Sets the discount the viewer, as seller, gives this buyer; `null` ends it. */
  set(buyerId: string, discountPct: number | null): Promise<Result<void, AppError>>;
}
