
// A service for cryptographic operations

const b64ToArrayBuffer = (b64: string): ArrayBuffer => {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = bin.charCodeAt(i);
    }
    return bytes.buffer;
};

const arrayBufferToB64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

const textToArrayBuffer = (str: string): ArrayBuffer => {
    return new TextEncoder().encode(str);
};

const arrayBufferToText = (buffer: ArrayBuffer): string => {
    return new TextDecoder().decode(buffer);
};

export const cryptoService = {
    generateKeys: async (): Promise<CryptoKeyPair> => {
        return await crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey']
        );
    },

    importPubKey: async (jwk: JsonWebKey): Promise<CryptoKey> => {
        return await crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            []
        );
    },

    importPrivKey: async (jwk: JsonWebKey): Promise<CryptoKey> => {
        return await crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey']
        );
    },

    deriveSharedKey: async (myPrivateKey: CryptoKey, partnerPublicKey: CryptoKey): Promise<CryptoKey> => {
        return await crypto.subtle.deriveKey(
            { name: 'ECDH', public: partnerPublicKey },
            myPrivateKey,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    },

    encryptMessage: async (sharedKey: CryptoKey, plaintext: string): Promise<{ ct: string; iv: string }> => {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedText = textToArrayBuffer(plaintext);
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            sharedKey,
            encodedText
        );
        return { ct: arrayBufferToB64(ciphertext), iv: arrayBufferToB64(iv) };
    },

    decryptMessage: async (sharedKey: CryptoKey, ct_b64: string, iv_b64: string): Promise<string> => {
        try {
            const iv = b64ToArrayBuffer(iv_b64);
            const ciphertext = b64ToArrayBuffer(ct_b64);
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                sharedKey,
                ciphertext
            );
            return arrayBufferToText(decrypted);
        } catch (e) {
            console.error('Decryption failed', e);
            throw new Error('Failed to decrypt message');
        }
    },
    
    exportKey: async (key: CryptoKey): Promise<JsonWebKey> => {
        return await crypto.subtle.exportKey('jwk', key);
    }
};
