import { Contact } from '../types';

const GUN_PEERS = [
  'https://gun-peer-server.onrender.com/gun',
  'https://gun-manhattan.herokuapp.com/gun',
  'https://relay.peer.estate/gun'
];

// Initialize Gun. Prefer window.Gun if loaded via CDN to avoid build issues with certain bundlers
// interacting with the Gun npm package which can be finicky in strict ESM.
const getGunInstance = () => {
  if (typeof window !== 'undefined' && window.Gun) {
    // Disable localStorage to avoid quota issues in the browser; data still lives on peers.
    return window.Gun({ peers: GUN_PEERS, localStorage: false });
  }
  // Fallback if npm package was installed
  try {
    // @ts-ignore
    const Gun = require('gun/gun'); 
    return Gun({ peers: GUN_PEERS, localStorage: false });
  } catch (e) {
    console.error("Gun not found");
    return null;
  }
};

export const gun = getGunInstance();

export const fetchPartnerPubKey = async (partnerUsername: string, retries = 5, delayMs = 700): Promise<JsonWebKey | null> => {
  if (!gun) return null;
  
  const tryOnce = () => new Promise<any>(resolve => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; resolve(undefined); }
    }, Math.max(900, Math.floor(delayMs / 2)));

    try {
      gun.get('users').get(partnerUsername).get('pubKey').once((res: any) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(res);
      });
    } catch (e) {
      if (!done) { done = true; clearTimeout(timer); resolve(undefined); }
    }
  });

  for (let i = 0; i < retries; i++) {
    try {
      const res = await tryOnce();
      if (res !== undefined && res !== null && res !== '') {
        try { return (typeof res === 'string') ? JSON.parse(res) : res; } catch (e) { return res; }
      }
    } catch (e) {
      console.warn('fetchPartnerPubKey try failed', e);
    }
    await new Promise(r => setTimeout(r, delayMs));
    delayMs = Math.min(2000, Math.round(delayMs * 1.2));
  }
  return null;
};

export const createUser = (username: string, pubKey: JsonWebKey, encryptedPrivKey: string) => {
    if(!gun) throw new Error("Gun not initialized");
    const node = gun.get('users').get(username);
    node.put({ pubKey: JSON.stringify(pubKey), privKey: encryptedPrivKey });
    node.get('chats').put(null); // Initialize chats
};

export const checkUserExists = (username: string): Promise<any> => {
    if(!gun) return Promise.resolve(null);
    return new Promise(resolve => gun.get('users').get(username).once(resolve, {wait: 1500}));
}

// Sanitize username for safe chatId generation
const sanitizeForChatId = (username: string): string => {
  // Remove any characters that could break chatId format
  return username.replace(/[^a-zA-Z0-9_-]/g, '');
};

export const createChatLink = (currentUser: string, partnerUsername: string) => {
    if(!gun) return;
    // Sanitize usernames to prevent injection issues
    const safeCurrent = sanitizeForChatId(currentUser);
    const safePartner = sanitizeForChatId(partnerUsername);
    if (!safeCurrent || !safePartner) {
      console.error('Invalid usernames for chat link creation');
      return undefined;
    }
    const chatId = [safeCurrent, safePartner].sort().join(':');
    gun.get('users').get(currentUser).get('chats').set(chatId);
    gun.get('users').get(partnerUsername).get('chats').set(chatId);
    return chatId;
}

export const restoreChatLinks = (username: string, contacts: Array<{ username: string; chatId: string }>) => {
    if(!gun || !contacts || contacts.length === 0) return;
    const userChatsNode = gun.get('users').get(username).get('chats');
    contacts.forEach(contact => {
        userChatsNode.set(contact.chatId);
        // Also ensure the partner has the link (in case they're restoring too)
        const partnerChatsNode = gun.get('users').get(contact.username).get('chats');
        partnerChatsNode.set(contact.chatId);
    });
}