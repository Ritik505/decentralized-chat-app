
import React, { useState, FormEvent, useEffect } from 'react';
import { gunService } from '../services/gunService';
import { Loader2, X } from 'lucide-react';

interface NewChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: string;
    onStartChat: (partnerUsername: string) => void;
}

const NewChatModal: React.FC<NewChatModalProps> = ({ isOpen, onClose, currentUser, onStartChat }) => {
    const [partnerUsername, setPartnerUsername] = useState('');
    const [status, setStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setPartnerUsername('');
            setStatus('');
            setIsLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const trimmedUsername = partnerUsername.trim();
        if (!trimmedUsername) {
            setStatus('Please enter a username.');
            return;
        }
        if (trimmedUsername === currentUser) {
            setStatus("You can't chat with yourself.");
            return;
        }

        setIsLoading(true);
        setStatus('Searching for user...');

        const userExists = await gunService.fetchPartnerPubKey(trimmedUsername);

        if (userExists) {
            onStartChat(trimmedUsername);
        } else {
            setStatus(`User "${trimmedUsername}" not found.`);
        }
        setIsLoading(false);
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity"
            onClick={onClose}
        >
            <div 
                className="bg-gray-800 rounded-2xl shadow-lg p-8 w-full max-w-md border border-gray-700"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Start a New Chat</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="new-chat-username" className="block text-sm font-medium text-gray-300">
                                Enter username
                            </label>
                            <input
                                type="text"
                                id="new-chat-username"
                                value={partnerUsername}
                                onChange={(e) => setPartnerUsername(e.target.value)}
                                required
                                autoFocus
                                className="mt-1 block w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        {status && <p className="text-sm text-yellow-400">{status}</p>}
                        <div className="flex justify-end space-x-4 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-white font-semibold transition duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 rounded-lg text-white font-semibold transition duration-200 flex items-center justify-center"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : "Start Chat"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewChatModal;
