import { Platform, View } from 'react-native';

import { Button, Surface, SWText } from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import type { ViewerLocationStatus } from './viewer-location';

/** What the notice says, worded for where the app is running: a phone or a browser. */
export function nearMeCopy(status: ViewerLocationStatus, platform: string = Platform.OS) {
  const web = platform === 'web';
  if (status === 'idle' || status === 'locating') {
    return { title: 'Finding where you are…', body: null };
  }
  if (status === 'denied') {
    return web
      ? {
          title: 'Location is blocked for this site',
          body: 'Allow location for this site in your browser’s settings (the icon beside the address) to see what’s near you, then try again. Until then, every listing shows. Your position stays in this browser.',
        }
      : {
          title: 'Location is off for SnapWorth',
          body: 'Allow location for SnapWorth in Settings to see what’s near you. Until then, every listing shows. Your position stays on your phone.',
        };
  }
  return {
    title: 'Couldn’t find where you are',
    body: 'Check that location services are on. Until then, every listing shows.',
  };
}

/**
 * Why "Near me" isn't narrowing anything: still looking, or the viewer's position can't be had.
 * While it can't, every listing shows, and this says so with a way out. It shows in the Location
 * sheet as soon as the request fails, and again on the Market once the sheet is closed.
 */
export function NearMeNotice({
  status,
  onTryAgain,
  onClear,
}: {
  readonly status: ViewerLocationStatus;
  readonly onTryAgain: () => void;
  readonly onClear: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const { title, body } = nearMeCopy(status);
  // On the web a blocked site can be allowed again from the address bar without leaving the page,
  // so trying again is offered there too; on a phone it only helps once Settings has changed.
  return (
    <Surface padding={tokens.spacing[4]} contentStyle={styles.nearMe}>
      <SWText variant="label" accessibilityRole="header">
        {title}
      </SWText>
      {body === null ? null : (
        <>
          <SWText variant="bodySmall" tone="textSecondary">
            {body}
          </SWText>
          <View style={styles.actions}>
            {status === 'denied' && Platform.OS !== 'web' ? null : (
              <Button label="Try again" size="small" variant="secondary" onPress={onTryAgain} />
            )}
            <Button label="Clear Near me" size="small" variant="tertiary" onPress={onClear} />
          </View>
        </>
      )}
    </Surface>
  );
}

const stylesFor = themedStyles(() => ({
  nearMe: {
    gap: tokens.spacing[2],
  },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing[2],
  },
}));
