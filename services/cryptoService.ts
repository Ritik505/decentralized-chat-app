import { UserKeys } from '../types';

// Utility for base64 conversion
export function arrayBufferToB64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function textToArrayBuffer(s: string): ArrayBuffer {
  return new TextEncoder().encode(s);
}

function arrayBufferToText(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf);
}

// Key Generation & Management
export async function generateKeys(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
}

export async function exportKey(key: CryptoKey): Promise<JsonWebKey> {
    return await window.crypto.subtle.exportKey('jwk', key);
}

export async function importPubKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

export async function importPrivKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
}

// Shared Secret Derivation
export async function deriveSharedKey(myPrivateKey: CryptoKey, partnerPublicKey: CryptoKey): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: partnerPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encryption / Decryption
export async function encryptMessage(sharedKey: CryptoKey, plaintext: string) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ct = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    textToArrayBuffer(plaintext)
  );
  return { ct: arrayBufferToB64(ct), iv: arrayBufferToB64(iv) };
}

export async function decryptMessage(sharedKey: CryptoKey, ct_b64: string, iv_b64: string): Promise<string> {
  const iv = new Uint8Array(b64ToArrayBuffer(iv_b64));
  const ciphertext = b64ToArrayBuffer(ct_b64);
  const plain = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    ciphertext
  );
  return arrayBufferToText(plain);
}

export async function encryptFile(sharedKey: CryptoKey, file: File) {
    const buffer = await file.arrayBuffer();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        sharedKey,
        buffer
    );
    return {
        ct: arrayBufferToB64(encryptedBuffer),
        iv: arrayBufferToB64(iv)
    };
}

export async function decryptFile(sharedKey: CryptoKey, ct_b64: string, iv_b64: string, type: string): Promise<Blob> {
    const iv = new Uint8Array(b64ToArrayBuffer(iv_b64));
    const ciphertext = b64ToArrayBuffer(ct_b64);
    const plain = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        sharedKey,
        ciphertext
    );
    return new Blob([plain], { type: type || 'application/octet-stream' });
}

// Storage Encryption (using CryptoJS for symmetry with legacy code)
export function encryptPrivateKey(privJwk: JsonWebKey, password: string): string {
    return window.CryptoJS.AES.encrypt(JSON.stringify(privJwk), password).toString();
}

export function decryptPrivateKey(encryptedPrivKey: string, password: string): JsonWebKey | null {
    try {
        const bytes = window.CryptoJS.AES.decrypt(encryptedPrivKey, password);
        const decrypted = bytes.toString(window.CryptoJS.enc.Utf8);
        return JSON.parse(decrypted);
    } catch (e) {
        return null;
    }
}