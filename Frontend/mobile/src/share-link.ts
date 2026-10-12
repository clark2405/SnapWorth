import * as Linking from 'expo-linking';
import { useCallback } from 'react';
import { Platform, Share } from 'react-native';

import { useToast } from '@snapworth/shared/components';

/** The public web app, when one is configured, so a shared link opens for anyone, app or not. */
const webOrigin = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '');

/** A link to a page of the app: on the web when there is a public site, otherwise into the app. */
export function linkTo(path: string): string {
  return webOrigin ? `${webOrigin}${path}` : Linking.createURL(path);
}

/**
 * Shares a link to a page through the system share sheet. iOS carries the link as its own
 * attachment, so apps show a preview of it; Android sends text only, so the link goes in it.
 */
export function useShareLink(): (path: string, message: string) => void {
  const toast = useToast();
  return useCallback(
    (path: string, message: string) => {
      const url = linkTo(path);
      Share.share(Platform.OS === 'ios' ? { message, url } : { message: `${message} ${url}` })
        .then((result) => {
          if (result.action === Share.sharedAction) toast.show({ title: 'Link shared' });
        })
        .catch(() => toast.show({ title: 'Couldn’t open sharing', body: url }));
    },
    [toast],
  );
}
