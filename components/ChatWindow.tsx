
import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { UserCredentials, Contact, Message } from '../types';
import { gunService } from '../services/gunService';
import { cryptoService } from '../services/cryptoService';
import { ArrowLeft, Send, MessageSquare, Smile, Paperclip } from 'lucide-react';
import { EMOJIS } from '../constants';

interface ChatWindowProps {
    user: UserCredentials;
    contact: Contact | null;
    onBack: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ user, contact, onBack }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isEmojiPickerOpen, setEmojiPickerOpen] = useState(false);

    useEffect(() => {
        if (!contact) return;

        let isMounted = true;
        const deriveKey = async () => {
            const partnerPubKeyJWK = await gunService.fetchPartnerPubKey(contact.username);
            if (partnerPubKeyJWK && user.keys.privateKey) {
                const partnerPubKey = await cryptoService.importPubKey(partnerPubKeyJWK);
                const key = await cryptoService.deriveSharedKey(user.keys.privateKey, partnerPubKey);
                if (isMounted) setSharedKey(key);
            } else {
                console.error("Could not get partner's public key.");
            }
        };

        deriveKey();
        return () => { isMounted = false; };
    }, [contact, user.keys.privateKey]);
    
    useEffect(() => {
        if (!contact || !sharedKey) {
            setMessages([]);
            return;
        };

        const messageMap = new Map<string, Message>();
        
        const cleanup = gunService.listenForMessages(contact.chatId, async (msgData, id) => {
            if (messageMap.has(id)) return;

            let decryptedText = '';
            if (msgData.ct && msgData.iv) {
                try {
                    decryptedText = await cryptoService.decryptMessage(sharedKey, msgData.ct, msgData.iv);
                } catch (e) {
                    console.error("Decryption failed for message:", id);
                    decryptedText = '[Failed to decrypt]';
                }
            } else if (msgData.text && msgData.sender === user.username) {
                // This is an optimistic update for the sender
                decryptedText = msgData.text;
            }

            const finalMessage: Message = {
                ...msgData,
                text: decryptedText
            };
            messageMap.set(id, finalMessage);
            const sortedMessages = Array.from(messageMap.values()).sort((a, b) => a.timestamp - b.timestamp);
            setMessages(sortedMessages);
        });

        return () => {
            cleanup();
        };
    }, [contact, sharedKey, user.username]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !contact || !sharedKey) return;

        const text = newMessage;
        setNewMessage('');
        const { ct, iv } = await cryptoService.encryptMessage(sharedKey, text);

        const message: Omit<Message, 'id'> = {
            sender: user.username,
            ct,
            iv,
            timestamp: Date.now(),
            text, // For optimistic update
        };
        gunService.sendMessage(contact.chatId, message);
    };

    if (!contact) {
        return (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-gray-500 p-8 text-center bg-gray-900">
                <MessageSquare className="w-24 h-24 mb-4" />
                <h2 className="text-2xl font-semibold text-gray-400">Welcome to D-Chat</h2>
                <p>Select a chat on the left to start messaging.</p>
                <p className="text-sm mt-2">All messages are end-to-end encrypted.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-900">
            {/* Chat Header */}
            <div className="flex items-center p-4 border-b border-gray-700 h-16 flex-shrink-0 bg-gray-800">
                <button onClick={onBack} className="md:hidden mr-4 text-gray-300 hover:text-white">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center font-bold text-white text-lg">
                    {contact.username.charAt(0).toUpperCase()}
                </div>
                <span className="ml-3 font-semibold text-white">{contact.username}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg, index) => {
                    const isMe = msg.sender === user.username;
                    return (
                        <div key={`${msg.id}-${index}`} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                             <div className={`max-w-xs md:max-w-md lg:max-w-xl px-4 py-2.5 rounded-2xl ${isMe ? 'bg-indigo-600 text-white rounded-br-lg' : 'bg-gray-700 text-gray-200 rounded-bl-lg'}`}>
                                <p className="break-words">{msg.text}</p>
                             </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-700 bg-gray-800 relative">
                {isEmojiPickerOpen && (
                    <div className="absolute bottom-full mb-2 right-4 bg-gray-700 border border-gray-600 rounded-lg p-2 shadow-lg">
                        <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                            {EMOJIS.map(emoji => (
                                <button key={emoji} onClick={() => { setNewMessage(prev => prev + emoji); setEmojiPickerOpen(false); }} className="text-2xl p-1 rounded-md hover:bg-gray-600">
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                    <button type="button" onClick={() => setEmojiPickerOpen(o => !o)} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700">
                        <Smile className="w-6 h-6" />
                    </button>
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        autoComplete="off"
                        className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-3 transition-colors">
                        <Send className="w-6 h-6" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatWindow;
