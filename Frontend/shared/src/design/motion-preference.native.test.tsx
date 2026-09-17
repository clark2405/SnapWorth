import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AccessibilityInfo } from 'react-native';

import { useMotionPreference, type MotionPreference } from './motion';
import { tokens } from './tokens';

type ReduceMotionListener = (isEnabled: boolean) => void;

const isReduceMotionEnabled = jest.mocked(AccessibilityInfo.isReduceMotionEnabled);
const addEventListener = jest.mocked(AccessibilityInfo.addEventListener);

let currentPreference: MotionPreference | undefined;
let reduceMotionListener: ReduceMotionListener | undefined;
let removeSubscription: jest.Mock;

function MotionPreferenceProbe() {
  currentPreference = useMotionPreference();
  return null;
}

async function renderPreferenceProbe(): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div');
  const root = createRoot(container);
  document.body.append(container);

  await act(async () => {
    root.render(<MotionPreferenceProbe />);
    await Promise.resolve();
  });

  return { container, root };
}

function readPreference(): MotionPreference {
  if (!currentPreference) {
    throw new Error('Motion preference was not captured.');
  }

  return currentPreference;
}

describe('useMotionPreference', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  });

  beforeEach(() => {
    currentPreference = undefined;
    reduceMotionListener = undefined;
    removeSubscription = jest.fn();
    isReduceMotionEnabled.mockReset().mockResolvedValue(false);
    addEventListener.mockReset().mockImplementation((event, listener) => {
      expect(event).toBe('reduceMotionChanged');
      reduceMotionListener = listener;
      return { remove: removeSubscription };
    });
  });

  it('tracks preference changes, selects matching recipes, and removes its listener', async () => {
    const { container, root } = await renderPreferenceProbe();

    expect(readPreference().preferenceResolved).toBe(true);
    expect(readPreference().reduceMotion).toBe(false);
    expect(readPreference().resolveRecipe('estimateReveal')).toEqual({
      name: 'estimateReveal',
      ...tokens.motion.recipe.estimateReveal,
    });

    await act(async () => {
      reduceMotionListener?.(true);
    });

    const reducedRecipe = readPreference().resolveRecipe('estimateReveal');
    expect(readPreference().reduceMotion).toBe(true);
    expect(reducedRecipe).toEqual({
      name: 'estimateReveal',
      ...tokens.motion.recipe.reducedCrossFade,
    });
    expect(reducedRecipe.properties).toEqual(['opacity']);
    expect(reducedRecipe.repeats).toBe(false);
    expect(reducedRecipe.delayMs).toBeUndefined();
    expect(reducedRecipe.restMs).toBeUndefined();

    await act(async () => {
      reduceMotionListener?.(false);
    });

    expect(readPreference().resolveRecipe('dataShift')).toEqual({
      name: 'dataShift',
      ...tokens.motion.recipe.dataShift,
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();

    expect(removeSubscription).toHaveBeenCalledTimes(1);
  });
});
