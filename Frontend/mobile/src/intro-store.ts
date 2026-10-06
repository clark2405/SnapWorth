import AsyncStorage from '@react-native-async-storage/async-storage';

const key = 'snapworth.introSeen';

/** Whether this device has been through the first-run introduction; storage failures replay it. */
export async function hasSeenIntro(): Promise<boolean> {
  return (await AsyncStorage.getItem(key).catch(() => null)) === '1';
}

export async function markIntroSeen(): Promise<void> {
  await AsyncStorage.setItem(key, '1').catch(() => undefined);
}
