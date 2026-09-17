import { snapWorthNativeWindPreset } from './nativewind-preset';
import { nativeWindColorReferences } from './theme';
import { tokens } from './tokens';

describe('SnapWorth NativeWind preset', () => {
  it('derives semantic colors and accessible touch targets from tokens', () => {
    const extension = snapWorthNativeWindPreset.theme?.extend;

    expect(extension?.colors).toMatchObject({
      canvas: nativeWindColorReferences.canvas,
      surface: nativeWindColorReferences.surface,
      accent: {
        DEFAULT: nativeWindColorReferences.accent,
        on: nativeWindColorReferences.onAccent,
        pressed: nativeWindColorReferences.accentPressed,
      },
      estimate: {
        border: nativeWindColorReferences.estimateBorder,
        surface: nativeWindColorReferences.estimateSurface,
      },
    });
    expect(extension?.minHeight).toMatchObject({ touch: `${tokens.layout.controlMinimum}px` });
    expect(extension?.minWidth).toMatchObject({ touch: `${tokens.layout.controlMinimum}px` });
  });

  it('derives breakpoints, typography, radius, and motion from the immutable source', () => {
    const extension = snapWorthNativeWindPreset.theme?.extend;

    expect(extension?.screens).toMatchObject({
      compact: `${tokens.breakpoint.compactMin}px`,
      medium: `${tokens.breakpoint.medium}px`,
      expanded: `${tokens.breakpoint.expanded}px`,
    });
    expect(extension?.fontFamily).toMatchObject({
      display: [tokens.typography.family.displayMedium],
      body: [tokens.typography.family.bodyRegular],
    });
    expect(extension?.borderRadius).toMatchObject({
      sm: `${tokens.radius.small}px`,
      md: `${tokens.radius.medium}px`,
      lg: `${tokens.radius.large}px`,
    });
    expect(extension?.transitionDuration).toMatchObject({
      fast: `${tokens.motion.duration.fast}ms`,
      reveal: `${tokens.motion.duration.reveal}ms`,
      reduced: `${tokens.motion.duration.reducedCrossFade}ms`,
    });
  });
});
