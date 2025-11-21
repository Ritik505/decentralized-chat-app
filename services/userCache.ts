const STORAGE_KEY_PREFIX = 'dchat_user_';

interface CachedUserRecord {
  username: string;
  pubKey: JsonWebKey;
  encryptedPrivKey: string;
  updatedAt: number;
}

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
};

const buildKey = (username: string) => `${STORAGE_KEY_PREFIX}${username}`;

export const saveUserToCache = (username: string, pubKey: JsonWebKey, encryptedPrivKey: string) => {
  const storage = getStorage();
  if (!storage) return;

  const record: CachedUserRecord = {
    username,
    pubKey,
    encryptedPrivKey,
    updatedAt: Date.now(),
  };

  try {
    storage.setItem(buildKey(username), JSON.stringify(record));
  } catch (e) {
    console.warn('Failed to persist user cache', e);
  }
};

export const loadUserFromCache = (
  username: string
): { pubKey: JsonWebKey; encryptedPrivKey: string } | null => {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(buildKey(username));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedUserRecord;
    if (!parsed?.pubKey || !parsed?.encryptedPrivKey) return null;
    return { pubKey: parsed.pubKey, encryptedPrivKey: parsed.encryptedPrivKey };
  } catch (e) {
    console.warn('Failed to read user cache', e);
    return null;
  }
};

export const clearUserCache = (username: string) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(buildKey(username));
  } catch (e) {
    console.warn('Failed to clear user cache', e);
  }
};

