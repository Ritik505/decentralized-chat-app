const STORAGE_KEY_PREFIX = 'dchat_user_';
const CHATS_KEY_PREFIX = 'dchat_chats_';

interface CachedUserRecord {
  username: string;
  pubKey: JsonWebKey;
  encryptedPrivKey: string;
  updatedAt: number;
}

export interface CachedContact {
  username: string;
  chatId: string;
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
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError') {
      // Try to clear old cache entries if quota exceeded
      try {
        const keys = Object.keys(storage);
        const userKeys = keys.filter(k => k.startsWith(STORAGE_KEY_PREFIX));
        if (userKeys.length > 0) {
          // Remove oldest entry
          let oldestKey = userKeys[0];
          let oldestTime = Infinity;
          for (const key of userKeys) {
            try {
              const data = storage.getItem(key);
              if (data) {
                const parsed = JSON.parse(data);
                if (parsed.updatedAt < oldestTime) {
                  oldestTime = parsed.updatedAt;
                  oldestKey = key;
                }
              }
            } catch {}
          }
          storage.removeItem(oldestKey);
          // Retry
          storage.setItem(buildKey(username), JSON.stringify(record));
          return;
        }
      } catch (cleanupErr) {
        console.warn('Failed to cleanup storage', cleanupErr);
      }
      throw e; // Re-throw if cleanup didn't help
    }
    console.warn('Failed to persist user cache', e);
    throw e;
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
    storage.removeItem(`${CHATS_KEY_PREFIX}${username}`);
  } catch (e) {
    console.warn('Failed to clear user cache', e);
  }
};

export const saveContactsToCache = (username: string, contacts: CachedContact[]) => {
  const storage = getStorage();
  if (!storage) return;

  try {
    const key = `${CHATS_KEY_PREFIX}${username}`;
    storage.setItem(key, JSON.stringify({ contacts, updatedAt: Date.now() }));
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError') {
      console.warn('Storage quota exceeded for contacts cache');
      // Don't throw - contacts cache is less critical than user keys
    } else {
      console.warn('Failed to persist contacts cache', e);
    }
  }
};

export const loadContactsFromCache = (username: string): CachedContact[] | null => {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const key = `${CHATS_KEY_PREFIX}${username}`;
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.contacts || !Array.isArray(parsed.contacts)) return null;
    return parsed.contacts;
  } catch (e) {
    console.warn('Failed to read contacts cache', e);
    return null;
  }
};

