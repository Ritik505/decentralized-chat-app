import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { Chat } from './components/Chat';
import { UserKeys } from './types';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userKeys, setUserKeys] = useState<UserKeys | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const savedUser = sessionStorage.getItem('currentUser');
      const privKeyStr = sessionStorage.getItem('privKey');
      const pubKeyStr = sessionStorage.getItem('pubKey');

      if (savedUser && privKeyStr && pubKeyStr) {
        try {
          // Use dynamic import for crypto service to avoid circular dependency issues if any
          const { importPrivKey, importPubKey } = await import('./services/cryptoService');
          
          const keys = {
            privateKey: await importPrivKey(JSON.parse(privKeyStr)),
            publicKey: await importPubKey(JSON.parse(pubKeyStr))
          };
          setCurrentUser(savedUser);
          setUserKeys(keys);
        } catch (e) {
          console.error("Session restore failed", e);
          sessionStorage.clear();
        }
      }
      setLoading(false);
    };
    restoreSession();
  }, []);

  const handleLogin = (username: string, keys: UserKeys) => {
    setCurrentUser(username);
    setUserKeys(keys);
    
    // Persist session securely (in memory/sessionStorage only)
    sessionStorage.setItem('currentUser', username);
    // We need to export keys back to JWK to store in session storage
    // Note: Storing keys in sessionStorage is convenience vs security tradeoff present in original app.
    // In a production app, you might want to keep keys only in memory or IndexedDB non-exportable.
    
    const saveKeys = async () => {
         const { exportKey } = await import('./services/cryptoService');
         const privJwk = await exportKey(keys.privateKey);
         const pubJwk = await exportKey(keys.publicKey);
         sessionStorage.setItem('privKey', JSON.stringify(privJwk));
         sessionStorage.setItem('pubKey', JSON.stringify(pubJwk));
    };
    saveKeys();
  };

  const handleLogout = () => {
    sessionStorage.clear();
    setCurrentUser(null);
    setUserKeys(null);
  };

  if (loading) {
      return (
          <div className="h-full w-full flex items-center justify-center bg-gray-900 text-white">
              <div className="animate-pulse flex flex-col items-center">
                  <div className="h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p>Loading D-Chat...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="h-full w-full bg-gray-900">
      {currentUser && userKeys ? (
        <Chat 
          currentUser={currentUser} 
          userKeys={userKeys} 
          onLogout={handleLogout} 
        />
      ) : (
        <Auth onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;