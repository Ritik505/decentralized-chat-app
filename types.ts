export interface UserKeys {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

export interface ChatMessage {
  _key?: string;
  sender: string;
  text?: string;
  timestamp: number;
  ct?: string; // Cipher text
  iv?: string; // Initialization vector
  isFile?: boolean;
  name?: string; // File name
  type?: string; // MIME type
  size?: number;
  ctFile?: string; // Encrypted file content
  ivFile?: string; // File IV
}

export interface ChatSession {
  partner: string;
  id: string;
}

export interface Contact {
  username: string;
  chatId: string;
  lastActive?: number;
}

// Global augmentation for libraries loaded via CDN if imports fail
declare global {
  interface Window {
    Gun: any;
    CryptoJS: any;
  }
}