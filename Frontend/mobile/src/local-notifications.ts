// Expo SDK 57's package entry also loads DevicePushTokenAutoRegistration.fx,
// which throws in Android Expo Go. Import only the local APIs we use so local
// notifications remain available in Expo Go and in installed builds alike.
// These paths are covered by our pinned expo-notifications dependency and tests.
export { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
export {
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications/build/NotificationPermissions';
export { IosAuthorizationStatus } from 'expo-notifications/build/NotificationPermissions.types';
export { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
export { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
export { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
export { useLastNotificationResponse } from 'expo-notifications/build/useLastNotificationResponse';
