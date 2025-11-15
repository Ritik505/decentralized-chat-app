
import React, { useState, useEffect } from 'react';
import { UserCredentials, Contact } from '../types';
import { gunService } from '../services/gunService';
import { LogOut, Plus, User, Search } from 'lucide-react';
import NewChatModal from './NewChatModal';

interface SidebarProps {
    user: UserCredentials;
    onLogout: () => void;
    onSelectContact: (contact: Contact) => void;
    selectedContact: Contact | null;
    onNewChat: (partnerUsername: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout, onSelectContact, selectedContact, onNewChat }) => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    useEffect(() => {
        const uniqueContacts = new Map<string, Contact>();
        
        const cleanup = gunService.listenForContacts(user.username, (contact) => {
            if (!uniqueContacts.has(contact.username)) {
                uniqueContacts.set(contact.username, contact);
                setContacts(Array.from(uniqueContacts.values()));
            }
        });

        return () => {
            cleanup();
        };
    }, [user.username]);

    const filteredContacts = contacts.filter(contact => 
        contact.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700 h-16 flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-lg">
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-white truncate">{user.username}</span>
                    </div>
                    <button onClick={onLogout} className="text-gray-400 hover:text-white transition-colors" title="Logout">
                        <LogOut className="w-6 h-6" />
                    </button>
                </div>

                {/* New Chat & Search */}
                <div className="p-4 space-y-4 border-b border-gray-700">
                     <button 
                        onClick={() => setIsModalOpen(true)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors">
                        <Plus className="w-5 h-5" />
                        <span>New Chat</span>
                    </button>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>
                        <input
                            type="text"
                            placeholder="Search contacts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                {/* Contacts List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredContacts.length > 0 ? (
                        filteredContacts.map((contact) => (
                            <div
                                key={contact.username}
                                onClick={() => onSelectContact(contact)}
                                className={`flex items-center p-4 cursor-pointer border-l-4 transition-colors duration-200 ${
                                    selectedContact?.username === contact.username
                                        ? 'bg-gray-700 border-indigo-500'
                                        : 'border-transparent hover:bg-gray-700/50'
                                }`}
                            >
                                <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center font-bold text-white flex-shrink-0">
                                    {contact.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="ml-3 flex-1 min-w-0">
                                    <p className="font-semibold text-white truncate">{contact.username}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                         <div className="text-center text-gray-500 p-8">
                            <User className="mx-auto w-12 h-12 mb-2" />
                            <p>No contacts yet.</p>
                            <p className="text-sm">Start a new chat to begin.</p>
                        </div>
                    )}
                </div>
            </div>
            <NewChatModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)}
                currentUser={user.username}
                onStartChat={(partner) => {
                    onNewChat(partner);
                    setIsModalOpen(false);
                }}
            />
        </>
    );
};

export default Sidebar;
