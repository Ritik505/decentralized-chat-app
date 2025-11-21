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

export const createChatLink = (currentUser: string, partnerUsername: string) => {
    if(!gun) return;
    const chatId = [currentUser, partnerUsername].sort().join(':');
    gun.get('users').get(currentUser).get('chats').set(chatId);
    gun.get('users').get(partnerUsername).get('chats').set(chatId);
    return chatId;
}