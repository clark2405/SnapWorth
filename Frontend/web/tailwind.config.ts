// NativeWind exposes this runtime preset, but its declaration file has no module export.
// @ts-expect-error -- Tailwind loads the CommonJS preset correctly through its config loader.
import nativeWindPreset from 'nativewind/preset';
import type { Config } from 'tailwindcss';

import { snapWorthNativeWindPreset } from '../shared/src/design/nativewind-preset';

export default {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    '../shared/src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [nativeWindPreset, snapWorthNativeWindPreset],
} satisfies Config;
