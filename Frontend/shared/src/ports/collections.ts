import type { AppError } from '../types/errors';
import type { Result } from '../types/result';

/** A set of the owner's things, like "Film cameras" or "Ukay jackets". */
export interface Collection {
  readonly id: string;
  readonly name: string;
  /** History item ids, in the order they were added. */
  readonly itemIds: readonly string[];
}

/**
 * Where an account's collections are kept: Supabase, or this device without a project. Only the
 * owner ever sees them.
 */
export interface CollectionRepository {
  list(): Promise<Result<readonly Collection[], AppError>>;
  /** Saves a new collection under the id the app gave it. */
  create(collection: Collection): Promise<Result<void, AppError>>;
  rename(id: string, name: string): Promise<Result<void, AppError>>;
  /** Makes these the things in the collection. */
  setItems(id: string, itemIds: readonly string[]): Promise<Result<void, AppError>>;
  /** Deletes the collection; its things stay in History. */
  remove(id: string): Promise<Result<void, AppError>>;
}
