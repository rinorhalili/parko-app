export function readStorage<T>(key: string, fallback: T, storage: Storage = localStorage): T {
  try {
    const value = storage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T, storage: Storage = localStorage) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string, storage: Storage = localStorage) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
