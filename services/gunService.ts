
import { Message } from '../types';

// This is a workaround for using Gun in a module-based environment.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Gun = (window as any).Gun;

const GUN_PEERS = ['https://gun-peer-server.onrender.com/gun'];
const gun = Gun({ peers: GUN_PEERS });

export const gunService = {
    getUserNode: (username: string) => {
        return gun.get('users').get(username);
    },
    getChatNode: (chatId: string) => {
        return gun.get('chat').get(chatId);
    },

    fetchUserRaw: (username: string): Promise<any> => {
        return new Promise(resolve => {
             gun.get('users').get(username).once(resolve, { wait: 2000 });
        });
    },

    fetchPartnerPubKey: async (partnerUsername: string): Promise<JsonWebKey | null> => {
        return new Promise((resolve) => {
            gun.get('users').get(partnerUsername).get('pubKey').once((data: string | object) => {
                if (data) {
                    try {
                        resolve(typeof data === 'string' ? JSON.parse(data) : data);
                    } catch {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            }, { wait: 2500 });
        });
    },

    listenForContacts: (username: string, callback: (contact: { username: string; chatId: string }) => void) => {
        const userChats = gun.get('users').get(username).get('chats');
        userChats.map().on((chatId: string) => {
            if (chatId) {
                const partner = chatId.split(':').find(name => name !== username);
                if(partner) {
                    callback({ username: partner, chatId });
                }
            }
        });

        return () => userChats.map().off();
    },

    listenForMessages: (chatId: string, callback: (message: Message, id: string) => void) => {
        const chatNode = gun.get('chat').get(chatId);
        chatNode.map().on((msg: any, id: string) => {
            // Gun can sometimes return null or incomplete data initially
            if (msg && msg.sender && msg.timestamp) {
                callback({...msg, id: id}, id);
            }
        });
        return () => chatNode.map().off();
    },

    sendMessage: async (chatId: string, message: Omit<Message, 'id'>) => {
        // Gun's .set() creates a new node with a random key in the map.
        gun.get('chat').get(chatId).set(message);
    },

    createChat: (currentUser: string, partnerUser: string) => {
        const chatId = [currentUser, partnerUser].sort().join(':');
        gun.get('users').get(currentUser).get('chats').set({ [partnerUser]: chatId });
        gun.get('users').get(partnerUser).get('chats').set({ [currentUser]: chatId });
        return chatId;
    }
};
