/**
 * Where History's own notes are kept until History is stored in Supabase: AsyncStorage on
 * devices, the browser's storage on the web. The composition root supplies it.
 */
export interface DeviceStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
