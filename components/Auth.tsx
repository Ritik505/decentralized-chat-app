import React, { useState } from 'react';
import { Typewriter } from './Typewriter';
import { checkUserExists, createUser } from '../services/gunService';
import { encryptPrivateKey, decryptPrivateKey, generateKeys, exportKey, importPrivKey, importPubKey } from '../services/cryptoService';
import { UserKeys } from '../types';
import { Eye, EyeOff } from 'lucide-react';
import { saveUserToCache, loadUserFromCache } from '../services/userCache';

type StoredUserRecord = {
  pubKey: JsonWebKey;
  encryptedPrivKey: string;
};

const normalizeGunUser = (user: any): StoredUserRecord | null => {
  if (!user || !user.pubKey || !user.privKey) return null;
  try {
    const pubKey = typeof user.pubKey === 'string' ? JSON.parse(user.pubKey) : user.pubKey;
    return { pubKey, encryptedPrivKey: user.privKey };
  } catch (error) {
    console.warn('Failed to parse stored public key', error);
    return null;
  }
};

interface AuthProps {
  onLogin: (username: string, keys: UserKeys) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<{ msg: string; error: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  // Validate and sanitize username
  const validateUsername = (username: string): { valid: boolean; error?: string } => {
    if (!username || username.trim().length === 0) {
      return { valid: false, error: "Username is required." };
    }
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      return { valid: false, error: "Username must be at least 3 characters." };
    }
    if (trimmed.length > 20) {
      return { valid: false, error: "Username must be 20 characters or less." };
    }
    // Allow alphanumeric, underscore, hyphen only
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return { valid: false, error: "Username can only contain letters, numbers, underscores, and hyphens." };
    }
    return { valid: true };
  };

  const validatePassword = (password: string): { valid: boolean; error?: string } => {
    if (!password || password.length === 0) {
      return { valid: false, error: "Password is required." };
    }
    if (password.length < 6) {
      return { valid: false, error: "Password must be at least 6 characters." };
    }
    return { valid: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      setStatus({ msg: usernameValidation.error || "Invalid username.", error: true });
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setStatus({ msg: passwordValidation.error || "Invalid password.", error: true });
      return;
    }

    const sanitizedUsername = username.trim();
    
    setStatus(null);
    setLoading(true);

    try {
      const userFromGun = await checkUserExists(sanitizedUsername);
      let normalizedUser = normalizeGunUser(userFromGun);

      if (isLogin) {
        // Login Logic
        if (!normalizedUser) {
          const cachedUser = loadUserFromCache(sanitizedUsername);
          if (cachedUser) {
            try {
              createUser(sanitizedUsername, cachedUser.pubKey, cachedUser.encryptedPrivKey);
              normalizedUser = cachedUser;
              setStatus({ msg: "Account restored from local backup.", error: false });
            } catch (restoreErr) {
              console.error("Failed to restore account from cache", restoreErr);
              setStatus({ msg: "Failed to restore account. Please try again.", error: true });
              setLoading(false);
              return;
            }
          }
        }

        if (!normalizedUser) {
          setStatus({ msg: "Invalid username or password.", error: true });
          setLoading(false);
          return;
        }

        const privJwk = decryptPrivateKey(normalizedUser.encryptedPrivKey, password);
        if (!privJwk) {
          setStatus({ msg: "Invalid username or password.", error: true });
          setLoading(false);
          return;
        }

        const pubJwk = normalizedUser.pubKey;
        
        const keys: UserKeys = {
          privateKey: await importPrivKey(privJwk),
          publicKey: await importPubKey(pubJwk)
        };

        try {
          saveUserToCache(sanitizedUsername, pubJwk, normalizedUser.encryptedPrivKey);
        } catch (cacheErr: any) {
          // Handle quota exceeded or other storage errors
          if (cacheErr?.name === 'QuotaExceededError') {
            console.warn('Storage quota exceeded, continuing without cache');
          } else {
            console.warn('Failed to cache user data', cacheErr);
          }
        }
        onLogin(sanitizedUsername, keys);

      } else {
        // Signup Logic
        if (normalizedUser && (normalizedUser.pubKey || normalizedUser.encryptedPrivKey)) {
          setStatus({ msg: "Username already taken.", error: true });
          setLoading(false);
          return;
        }

        setStatus({ msg: "Generating cryptographic keys...", error: false });
        const kp = await generateKeys();
        const pubJwk = await exportKey(kp.publicKey);
        const privJwk = await exportKey(kp.privateKey);
        const encryptedPriv = encryptPrivateKey(privJwk, password);

        try {
          createUser(sanitizedUsername, pubJwk, encryptedPriv);
        } catch (createErr) {
          console.error("Failed to create user", createErr);
          setStatus({ msg: "Failed to create account. Please check your connection and try again.", error: true });
          setLoading(false);
          return;
        }

        try {
          saveUserToCache(sanitizedUsername, pubJwk, encryptedPriv);
        } catch (cacheErr: any) {
          if (cacheErr?.name === 'QuotaExceededError') {
            console.warn('Storage quota exceeded, account created but not cached');
          } else {
            console.warn('Failed to cache user data', cacheErr);
          }
        }
        
        setStatus({ msg: "Signup successful! Please log in.", error: false });
        setIsLogin(true);
        setPassword('');
        setUsername('');
      }
    } catch (err) {
      console.error(err);
      setStatus({ msg: "An error occurred.", error: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full p-4 animate-in fade-in duration-500">
      <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8">
        <Typewriter />

        <p className="text-center text-gray-400 mb-6">Decentralized & Encrypted</p>
        <p className="text-center text-gray-500 text-xs italic mb-6">
          by Ritik Verma
        </p>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 mb-6">
          <button
            onClick={() => { setIsLogin(true); setStatus(null); }}
            className={`flex-1 py-2 font-semibold transition-colors ${isLogin ? 'text-white border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Login
          </button>
          <button
            onClick={() => { setIsLogin(false); setStatus(null); }}
            className={`flex-1 py-2 font-semibold transition-colors ${!isLogin ? 'text-white border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="block w-full px-4 py-3 bg-gray-850 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="Enter username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-3 bg-gray-850 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pr-12"
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-2 flex items-center px-2 text-gray-400 hover:text-white z-10 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition duration-200 shadow-lg hover:shadow-indigo-500/30 mt-2"
          >
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
          </button>
        </form>

        {isLogin && (
           <div className="text-center text-gray-500 text-sm mt-6">
             <p>© {new Date().getFullYear()} Ritik Verma. All rights reserved.</p>
           </div>
        )}


        {status && (
          <p className={`mt-4 text-center text-sm ${status.error ? 'text-red-400' : 'text-yellow-400'}`}>
            {status.msg}
          </p>
        )}
      </div>
    </div>
  );
};