import { Share, Share2, type LucideIcon } from 'lucide-react-native';
import { Platform } from 'react-native';

import { IconButton } from './IconButton';

/**
 * Share looks different on each platform, and people look for their own: a box with an arrow
 * on Apple platforms, three linked dots on Android and the web. The style can be ours; the
 * pattern stays theirs.
 */
export const shareIcon: LucideIcon = Platform.OS === 'ios' ? Share : Share2;

/** The share control for a screen's header, in the platform's own shape. */
export function ShareButton({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress?: () => void;
}) {
  return <IconButton icon={shareIcon} label={label} appearance="glass" onPress={onPress} />;
}
