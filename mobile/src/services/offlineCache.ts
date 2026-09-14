import AsyncStorage from "@react-native-async-storage/async-storage";

export async function readCache<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeCache<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeCache(key: string) {
  await AsyncStorage.removeItem(key);
}
