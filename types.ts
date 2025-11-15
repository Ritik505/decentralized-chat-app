
export interface UserCredentials {
    username: string;
    keys: CryptoKeyPair;
}

export interface Contact {
    username: string;
    chatId: string;
}

export interface Message {
    id: string;
    sender: string;
    ct?: string; // encrypted text content
    iv?: string; // initialization vector for text
    timestamp: number;
    text?: string; // Plaintext for own messages for optimistic UI
}
