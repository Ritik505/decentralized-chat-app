const STORAGE_KEY_PREFIX = 'dchat_user_';
const CHATS_KEY_PREFIX = 'dchat_chats_';
const MESSAGES_KEY_PREFIX = 'dchat_messages_';

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

// Message caching functions
export const saveMessagesToCache = (chatId: string, messages: Array<{ _key?: string; sender: string; text?: string; timestamp: number; ct?: string; iv?: string; isFile?: boolean; name?: string; type?: string; size?: number; ctFile?: string; ivFile?: string }>) => {
  const storage = getStorage();
  if (!storage) return;

  const cacheKey = `${MESSAGES_KEY_PREFIX}${chatId}`;
  try {
    // Store messages with timestamp for cleanup
    storage.setItem(cacheKey, JSON.stringify({ 
      messages, 
      updatedAt: Date.now() 
    }));
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError') {
      // Try to clean up old message caches
      try {
        const allKeys = Object.keys(storage);
        const messageKeys = allKeys.filter(k => k.startsWith(MESSAGES_KEY_PREFIX));
        if (messageKeys.length > 10) {
          // Remove oldest message caches
          const keyTimes = messageKeys.map(k => {
            try {
              const data = storage.getItem(k);
              if (data) {
                const parsed = JSON.parse(data);
                return { key: k, time: parsed.updatedAt || 0 };
              }
            } catch {}
            return { key: k, time: 0 };
          }).sort((a, b) => a.time - b.time);
          
          // Remove oldest 20% of message caches
          const toRemove = Math.max(1, Math.floor(keyTimes.length * 0.2));
          for (let i = 0; i < toRemove; i++) {
            storage.removeItem(keyTimes[i].key);
          }
          
          // Retry saving
          storage.setItem(cacheKey, JSON.stringify({ messages, updatedAt: Date.now() }));
        }
      } catch (cleanupErr) {
        console.warn('Failed to cleanup message cache', cleanupErr);
      }
    } else {
      console.warn('Failed to persist messages cache', e);
    }
  }
};

export const loadMessagesFromCache = (chatId: string): Array<{ _key?: string; sender: string; text?: string; timestamp: number; ct?: string; iv?: string; isFile?: boolean; name?: string; type?: string; size?: number; ctFile?: string; ivFile?: string }> | null => {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const key = `${MESSAGES_KEY_PREFIX}${chatId}`;
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.messages || !Array.isArray(parsed.messages)) return null;
    return parsed.messages;
  } catch (e) {
    console.warn('Failed to read messages cache', e);
    return null;
  }
};

export const clearMessagesCache = (chatId: string) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(`${MESSAGES_KEY_PREFIX}${chatId}`);
  } catch (e) {
    console.warn('Failed to clear messages cache', e);
  }
};

