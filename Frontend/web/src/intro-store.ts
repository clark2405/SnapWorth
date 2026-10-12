const key = 'snapworth.introSeen';

/** Whether this browser has been through the first-run introduction; blocked storage replays it. */
export function hasSeenIntro(): boolean {
  try {
    return globalThis.localStorage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function markIntroSeen(): void {
  try {
    globalThis.localStorage?.setItem(key, '1');
  } catch {
    // Private mode or blocked storage: the introduction plays again next visit.
  }
}
