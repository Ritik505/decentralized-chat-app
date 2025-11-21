import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserKeys, ChatSession, Contact, ChatMessage } from '../types';
import { gun, createChatLink, fetchPartnerPubKey, restoreChatLinks } from '../services/gunService';
import { deriveSharedKey, encryptMessage, decryptMessage, encryptFile, decryptFile } from '../services/cryptoService';
import { saveContactsToCache, loadContactsFromCache, saveMessagesToCache, loadMessagesFromCache } from '../services/userCache';
import { LogOut, Plus, Smile, Paperclip, Send, Moon, Sun, MessageSquare, Menu, X, ArrowLeft, FileText, Image as ImageIcon } from 'lucide-react';

interface ChatProps {
  currentUser: string;
  userKeys: UserKeys;
  onLogout: () => void;
}

const EMOJIS = ['😀','😁','😂','🤣','🙂','🙃','😉','😍','😘','😅','🤔','🤞','👍','👎','🙏','🎉','🔥','🌟','💯','❤️','😎','🤗','😴','🤖','😇','😬','😜','😢','😭','😡','🥳'];

export const Chat: React.FC<ChatProps> = ({ currentUser, userKeys, onLogout }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currentChat, setCurrentChat] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatUsername, setNewChatUsername] = useState('');
  const [newChatStatus, setNewChatStatus] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Initialize theme from localStorage or default to true (Dark)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : true;
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Cache for shared keys
  const sharedKeysRef = useRef<{[key: string]: CryptoKey}>({});
  // Track rendered keys to prevent duplicates
  const renderedMessageKeys = useRef<Set<string>>(new Set());

  // Helper to get or derive shared key
  const getSharedKey = useCallback(async (partnerUsername: string) => {
    if (sharedKeysRef.current[partnerUsername]) return sharedKeysRef.current[partnerUsername];
    
    const partnerPubJwk = await fetchPartnerPubKey(partnerUsername);
    if (!partnerPubJwk) throw new Error("Could not fetch partner's public key");
    
    // Import raw JWK to CryptoKey
    const partnerPub = await window.crypto.subtle.importKey(
        'jwk', partnerPubJwk, {name:'ECDH', namedCurve:'P-256'}, true, []
    );

    const sharedKey = await deriveSharedKey(userKeys.privateKey, partnerPub);
    sharedKeysRef.current[partnerUsername] = sharedKey;
    return sharedKey;
  }, [userKeys.privateKey]);

  // Load Contacts - with cache restoration
  useEffect(() => {
    if (!gun) return;
    
    // First, try to restore contacts from cache immediately
    const cachedContacts = loadContactsFromCache(currentUser);
    if (cachedContacts && cachedContacts.length > 0) {
      // Restore chat links to Gun (this ensures they persist on network)
      restoreChatLinks(currentUser, cachedContacts);
      // Add to state immediately so user sees their contacts right away
      setContacts(cachedContacts);
    }
    
    const contactsRef = gun.get('users').get(currentUser).get('chats');
    
    const handleContact = (val: any) => {
        if (!val) return;
        let chatId: string | null = null;
        if (typeof val === 'string') chatId = val;
        else if (val['#']) chatId = val['#'];
        
        if (!chatId) return;
        
        const partner = chatId.split(':').find(n => n !== currentUser);
        if (partner) {
            setContacts(prev => {
                if (prev.find(c => c.username === partner || c.chatId === chatId)) return prev;
                const newContact = { username: partner, chatId: chatId! };
                const updated = [newContact, ...prev];
                // Save to cache whenever a new contact is discovered
                saveContactsToCache(currentUser, updated);
                return updated;
            });
        }
    };

    // Listen to Gun for any contacts that come from network
    // This will merge with cached contacts (duplicates are prevented)
    contactsRef.map().on(handleContact);
    
    return () => {
        contactsRef.map().off();
    }
  }, [currentUser]);
  
  // Save contacts to cache whenever contacts change
  useEffect(() => {
    if (contacts.length > 0) {
      saveContactsToCache(currentUser, contacts);
    }
  }, [contacts, currentUser]);

  // Listen to Messages - with cache restoration
  useEffect(() => {
    if (!currentChat || !gun) return;
    
    setMessages([]);
    renderedMessageKeys.current.clear();

    // First, load cached messages immediately
    const cachedMessages = loadMessagesFromCache(currentChat.id);
    if (cachedMessages && cachedMessages.length > 0) {
      // Add cached messages to state immediately
      setMessages(cachedMessages);
      // Mark their keys as rendered to avoid duplicates
      cachedMessages.forEach(msg => {
        if (msg._key) renderedMessageKeys.current.add(msg._key);
      });
    }

    const chatNode = gun.get('chat').get(currentChat.id);
    
    const handleMessage = (msg: any, key: string) => {
        if (!msg || !key || renderedMessageKeys.current.has(key)) return;
        renderedMessageKeys.current.add(key);
        
        const fullMsg: ChatMessage = { ...msg, _key: key };
        setMessages(prev => {
            const exists = prev.some(m => m._key === key);
            if (exists) return prev;
            const newState = [...prev, fullMsg].sort((a, b) => a.timestamp - b.timestamp);
            // Save to cache whenever messages update
            saveMessagesToCache(currentChat.id, newState);
            return newState;
        });
    };

    // Listen to Gun for new messages
    chatNode.map().on(handleMessage);
    
    return () => {
        chatNode.map().off();
    };
  }, [currentChat]);
  
  // Save messages to cache whenever they change
  useEffect(() => {
    if (currentChat && messages.length > 0) {
      saveMessagesToCache(currentChat.id, messages);
    }
  }, [messages, currentChat]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMsg.trim() || !currentChat) return;
    
    try {
        const sharedKey = await getSharedKey(currentChat.partner);
        const { ct, iv } = await encryptMessage(sharedKey, inputMsg.trim());
        
        const msgPayload = {
            sender: currentUser,
            ct,
            iv,
            timestamp: Date.now(),
            text: inputMsg.trim() // Fallback for self
        };
        
        gun.get('chat').get(currentChat.id).set(msgPayload);
        // Message will be added to state via Gun listener, which will trigger cache save
        setInputMsg('');
        setShowEmoji(false);
    } catch (error) {
        console.error("Failed to send", error);
        // Show user-friendly error
        const errorMsg = error instanceof Error ? error.message : "Failed to send message. Please try again.";
        setErrorMessage(errorMsg);
        setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentChat) return;
    
    // File size validation (5MB max)
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
        setErrorMessage('File too large. Please choose a file under 5MB.');
        setTimeout(() => setErrorMessage(null), 3000);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    // Basic file type validation - allow common safe types
    // Allow any file type but warn for executables
    const dangerousExtensions = ['.exe', '.bat', '.sh', '.scr', '.vbs', '.js', '.jar'];
    const fileName = file.name.toLowerCase();
    if (dangerousExtensions.some(ext => fileName.endsWith(ext))) {
        setErrorMessage('Warning: Executable files are not recommended for security reasons.');
        setTimeout(() => setErrorMessage(null), 4000);
    }
    
    try {
        const sharedKey = await getSharedKey(currentChat.partner);
        const { ct, iv } = await encryptFile(sharedKey, file);
        
        const fileMsg = {
            sender: currentUser,
            name: file.name,
            type: file.type,
            size: file.size,
            ivFile: iv,
            ctFile: ct,
            timestamp: Date.now(),
            isFile: true
        };
        
        gun.get('chat').get(currentChat.id).set(fileMsg);
        // File message will be added to state via Gun listener, which will trigger cache save
        if(fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
        console.error("Upload failed", err);
        const errorMsg = err instanceof Error ? err.message : "Failed to upload file. Please try again.";
        setErrorMessage(errorMsg);
        setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleNewChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = newChatUsername.trim();
    if (!trimmedUsername) {
        setNewChatStatus("Please enter a username.");
        return;
    }
    if (trimmedUsername === currentUser) {
        setNewChatStatus("You can't chat with yourself.");
        return;
    }
    // Basic username validation
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
        setNewChatStatus("Invalid username format.");
        return;
    }
    
    setNewChatStatus("Searching...");
    try {
        const pubKey = await fetchPartnerPubKey(trimmedUsername);
        if (!pubKey) {
            setNewChatStatus("User not found. Please check the username and try again.");
            return;
        }
    
        const chatId = createChatLink(currentUser, trimmedUsername);
        if (chatId) {
            setContacts(prev => {
                 if (prev.find(c => c.username === trimmedUsername)) return prev;
                 const updated = [{ username: trimmedUsername, chatId }, ...prev];
                 // Save to cache immediately when creating new chat
                 saveContactsToCache(currentUser, updated);
                 return updated;
            });
            setCurrentChat({ partner: trimmedUsername, id: chatId });
            setShowNewChatModal(false);
            setNewChatUsername('');
            setNewChatStatus('');
            setMobileSidebarOpen(false);
        } else {
            setNewChatStatus("Failed to create chat. Please try again.");
        }
    } catch (err) {
        console.error("Failed to create chat", err);
        setNewChatStatus("An error occurred. Please try again.");
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  // Sync theme state with actual DOM class for Tailwind
  useEffect(() => {
    const html = document.documentElement;
    if (isDarkMode) {
        html.classList.remove('light');
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    } else {
        html.classList.remove('dark');
        html.classList.add('light');
        localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  return (
    <div className={`flex h-full ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
      
      {/* Sidebar */}
      <div className={`${mobileSidebarOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-1/3 lg:w-1/4 h-full bg-gray-850 border-r border-gray-700 z-20`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 h-16 shrink-0">
            <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg">
                    {currentUser.charAt(0).toUpperCase()}
                </div>
                <span className="font-semibold truncate max-w-[120px]">{currentUser}</span>
            </div>
            <div className="flex items-center space-x-1">
                <button onClick={toggleTheme} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition" aria-label="Toggle Theme">
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-400 rounded-full hover:bg-gray-700 transition" title="Logout">
                    <LogOut size={20} />
                </button>
            </div>
        </div>
        
        {/* New Chat Btn */}
        <div className="p-4">
            <button 
                onClick={() => setShowNewChatModal(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition shadow-md hover:shadow-indigo-500/20"
            >
                <Plus size={20} />
                <span>New Chat</span>
            </button>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {contacts.length === 0 ? (
                <p className="text-gray-500 text-center p-4 text-sm">No active chats.</p>
            ) : (
                contacts.map(c => (
                    <div 
                        key={c.chatId}
                        onClick={() => {
                            setCurrentChat({ partner: c.username, id: c.chatId });
                            setMobileSidebarOpen(false);
                        }}
                        className={`flex items-center p-4 cursor-pointer border-b border-gray-700/50 transition-colors ${currentChat?.id === c.chatId ? 'bg-gray-800 border-l-4 border-l-indigo-500 pl-[13px]' : 'hover:bg-gray-800'}`}
                    >
                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-gray-300 shrink-0">
                            {c.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3 flex-1 min-w-0">
                            <p className="font-medium truncate">{c.username}</p>
                            <p className="text-xs text-gray-500 truncate">Tap to chat</p>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col h-full bg-gray-900 relative ${!mobileSidebarOpen ? 'flex' : 'hidden md:flex'}`}>
        
        {currentChat ? (
            <>
                {/* Chat Header */}
                <div className="flex items-center p-4 border-b border-gray-700 h-16 bg-gray-850 shrink-0 shadow-sm z-10">
                    <button 
                        onClick={() => setMobileSidebarOpen(true)} 
                        className="md:hidden mr-3 text-gray-400 hover:text-white"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div className="w-9 h-9 rounded-full bg-gray-600 flex items-center justify-center font-bold text-white">
                        {currentChat.partner.charAt(0).toUpperCase()}
                    </div>
                    <span className="ml-3 font-semibold">{currentChat.partner}</span>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {messages.map((msg) => (
                        <MessageItem 
                            key={msg._key || `${msg.timestamp}-${msg.sender}`} 
                            msg={msg} 
                            currentUser={currentUser} 
                            getSharedKey={getSharedKey}
                            partner={currentChat.partner}
                            isDarkMode={isDarkMode}
                        />
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Error Message */}
                {errorMessage && (
                    <div className="mx-4 mt-2 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
                        {errorMessage}
                    </div>
                )}

                {/* Input Area */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700 bg-gray-850 relative z-20">
                    {showEmoji && (
                        <div className="absolute bottom-20 left-4 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-2 grid grid-cols-8 gap-1 w-72 h-48 overflow-y-auto z-30">
                            {EMOJIS.map(e => (
                                <button 
                                    key={e} 
                                    type="button"
                                    onClick={() => setInputMsg(prev => prev + e)}
                                    className="text-xl hover:bg-gray-700 rounded p-1"
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center space-x-3 bg-gray-900 rounded-xl border border-gray-700 p-2 focus-within:border-indigo-500 transition-colors">
                        <button 
                            type="button" 
                            onClick={() => setShowEmoji(!showEmoji)}
                            className="p-2 text-gray-400 hover:text-yellow-400 transition"
                        >
                            <Smile size={24} />
                        </button>
                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()} 
                            className="p-2 text-gray-400 hover:text-indigo-400 transition"
                        >
                            <Paperclip size={22} />
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileUpload}
                        />
                        <input 
                            type="text" 
                            value={inputMsg}
                            onChange={(e) => setInputMsg(e.target.value)}
                            placeholder="Type a secure message..."
                            className="flex-1 bg-transparent border-none focus:ring-0 text-gray-200 placeholder-gray-600 px-2"
                        />
                        <button 
                            type="submit" 
                            disabled={!inputMsg.trim()}
                            className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition shadow-md"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </form>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 text-center">
                <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-6">
                     <MessageSquare size={48} className="text-gray-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-300 mb-2">Welcome to D-Chat</h2>
                <p className="text-gray-500">Select a contact from the sidebar or start a new encrypted chat.</p>
            </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-200">
                <h2 className="text-2xl font-bold text-white mb-6">Start New Conversation</h2>
                <form onSubmit={handleNewChatSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                        <input 
                            type="text" 
                            value={newChatUsername}
                            onChange={(e) => setNewChatUsername(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            placeholder="Enter exact username"
                            autoFocus
                        />
                    </div>
                    {newChatStatus && <p className="text-yellow-400 text-sm">{newChatStatus}</p>}
                    <div className="flex justify-end space-x-3 mt-6">
                        <button 
                            type="button"
                            onClick={() => { setShowNewChatModal(false); setNewChatStatus(''); }}
                            className="px-5 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-5 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-semibold transition shadow-lg shadow-indigo-500/30"
                        >
                            Start Chat
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for rendering individual messages
const MessageItem: React.FC<{
    msg: ChatMessage, 
    currentUser: string, 
    getSharedKey: (u: string) => Promise<CryptoKey>,
    partner: string,
    isDarkMode: boolean
}> = ({ msg, currentUser, getSharedKey, partner, isDarkMode }) => {
    const [decryptedText, setDecryptedText] = useState<string | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const isMe = msg.sender === currentUser;

    useEffect(() => {
        let mounted = true;
        
        const process = async () => {
            try {
                if (msg.isFile) {
                     // Decrypt File
                     const partnerForKey = isMe ? partner : msg.sender;
                     const sharedKey = await getSharedKey(partnerForKey);
                     // Handle legacy naming convention from original code (ct vs ctFile)
                     const ct = msg.ctFile || msg.ct;
                     const iv = msg.ivFile || msg.iv;
                     
                     if(ct && iv) {
                        const blob = await decryptFile(sharedKey, ct, iv, msg.type || 'application/octet-stream');
                        if(mounted) setFileUrl(URL.createObjectURL(blob));
                     }
                } else {
                    // Decrypt Text
                    if (isMe && msg.text) {
                        if(mounted) setDecryptedText(msg.text);
                    } else {
                        // For received messages OR self messages without plaintext stored
                        const partnerForKey = isMe ? partner : msg.sender;
                        const sharedKey = await getSharedKey(partnerForKey);
                        if (msg.ct && msg.iv) {
                            const text = await decryptMessage(sharedKey, msg.ct, msg.iv);
                            if(mounted) setDecryptedText(text);
                        }
                    }
                }
            } catch (e) {
                console.error("Decryption failed for msg", msg._key, e);
                if(mounted) setDecryptedText("🔒 [Decryption Failed]");
            }
        };
        
        process();
        
        return () => { 
            mounted = false;
            if(fileUrl) URL.revokeObjectURL(fileUrl);
        }
    }, [msg, isMe, partner, getSharedKey]);

    const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    const bubbleThemeClasses = isMe
        ? isDarkMode
            ? 'bg-indigo-600 text-white'
            : 'bg-indigo-500 text-white'
        : isDarkMode
            ? 'bg-gray-800 text-gray-100 border border-gray-700'
            : 'bg-white text-gray-900 border border-gray-200';

    return (
        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] md:max-w-[65%] rounded-2xl px-4 py-3 shadow-sm relative group chat-bubble ${isMe ? 'rounded-br-none chat-bubble-sent' : 'rounded-bl-none chat-bubble-received'} ${bubbleThemeClasses}`}>
                {msg.isFile ? (
                     <div className="flex flex-col space-y-2">
                         <div className="flex items-center space-x-2 font-semibold border-b border-white/20 pb-2 mb-1">
                            {msg.type?.startsWith('image/') ? <ImageIcon size={16}/> : <FileText size={16}/>}
                            <span className="truncate max-w-[150px] text-sm">{msg.name}</span>
                         </div>
                         {msg.type?.startsWith('image/') && fileUrl ? (
                             <img src={fileUrl} alt={msg.name} className="rounded-lg max-h-60 object-cover bg-black/20" />
                         ) : fileUrl ? (
                             <a href={fileUrl} download={msg.name} className="text-sm underline hover:text-indigo-200">
                                 Download File ({Math.round((msg.size || 0) / 1024)} KB)
                             </a>
                         ) : (
                             <p className="text-xs opacity-70">
                                 Encrypted file – cannot be opened with current keys.
                             </p>
                         )}
                     </div>
                ) : (
                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                        {decryptedText || <span className="animate-pulse opacity-50">Decrypting...</span>}
                    </p>
                )}
                <span className={`text-[10px] opacity-60 block text-right mt-1 ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {time}
                </span>
            </div>
        </div>
    );
};