import { requireOptionalNativeModule } from 'expo';

/**
 * The phone's own look at a snapped photo (`modules/snap-sense`): Vision on any iPhone, and
 * Apple Intelligence's image reading on iOS 27 devices that have it. Pricing never happens
 * here; this decides whether a photo is worth sending and what to tell the cloud about it.
 *
 * Android, Expo Go and the tests have no native module, so every call here resolves to
 * nothing and the camera prices the photo exactly as before.
 */
export interface PhotoMeasurement {
  /** Mean brightness, 0 (black) to 1 (white). */
  readonly brightness: number;
  /** Edge spread at 512px across: a sharp photo is in the hundreds, a blurred one near 0. */
  readonly sharpness: number;
  /** Share of the frame the main subject fills, or null when there's no clear subject. */
  readonly subject: number | null;
  /** Whether Vision could look for a subject (it can't in the simulator). */
  readonly looked: boolean;
  readonly text: readonly string[];
  readonly codes: readonly string[];
}

export interface ItemImpression {
  readonly item: string;
  readonly category: string;
  /** A guess: trust it only when the same name is printed in the photo. */
  readonly brand: string;
  readonly colours: readonly string[];
  readonly usablePhoto: boolean;
}

export type ItemReaderStatus =
  | 'available'
  | 'deviceNotEligible'
  | 'appleIntelligenceNotEnabled'
  | 'modelNotReady'
  | 'noVision'
  | 'unsupportedOS'
  | 'unavailable';

interface SnapSenseModule {
  measurePhoto(uri: string): Promise<PhotoMeasurement>;
  itemReaderStatus(): ItemReaderStatus;
  prepareItemReader(): void;
  readItem(uri: string): Promise<ItemImpression | null>;
}

const native = requireOptionalNativeModule<SnapSenseModule>('SnapSense');

/**
 * How long a read may hold up the estimate. A loaded model answers in under two seconds; a
 * cold one takes longer, which is why the camera prepares it as it opens.
 */
const readTimeoutMs = 4000;

export async function measurePhoto(uri: string): Promise<PhotoMeasurement | null> {
  if (!native) return null;
  try {
    return await native.measurePhoto(uri);
  } catch {
    return null;
  }
}

export function itemReaderStatus(): ItemReaderStatus {
  return native?.itemReaderStatus() ?? 'unsupportedOS';
}

/** Loads the on-device model while the camera is open, so the first read doesn't wait for it. */
export function prepareItemReader(): void {
  native?.prepareItemReader();
}

/** The on-device first impression, or null when it's unavailable or too slow to wait for. */
export async function readItem(uri: string): Promise<ItemImpression | null> {
  if (!native || itemReaderStatus() !== 'available') return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), readTimeoutMs);
  });
  try {
    return await Promise.race([native.readItem(uri).catch(() => null), late]);
  } finally {
    clearTimeout(timer);
  }
}
