
import React, { useState } from 'react';
import { UserCredentials, Contact } from '../types';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import { gunService } from '../services/gunService';

interface ChatPageProps {
    user: UserCredentials;
    onLogout: () => void;
}

const ChatPage: React.FC<ChatPageProps> = ({ user, onLogout }) => {
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

    const handleSelectContact = (contact: Contact) => {
        setSelectedContact(contact);
    };

    const handleBack = () => {
        setSelectedContact(null);
    }
    
    const handleNewChat = (partnerUsername: string) => {
      const chatId = gunService.createChat(user.username, partnerUsername);
      setSelectedContact({ username: partnerUsername, chatId });
    };

    return (
        <div className="flex h-full bg-gray-900">
            {/* Sidebar for medium screens and up, or when no chat is selected on mobile */}
            <div className={`
                ${selectedContact ? 'hidden' : 'flex'} 
                md:flex flex-col w-full md:w-1/3 lg:w-1/4 h-full bg-gray-800 border-r border-gray-700 transition-all duration-300
            `}>
                <Sidebar user={user} onLogout={onLogout} onSelectContact={handleSelectContact} selectedContact={selectedContact} onNewChat={handleNewChat} />
            </div>
            
            {/* Chat Window for medium screens and up, or when a chat is selected on mobile */}
            <div className={`
                ${!selectedContact ? 'hidden' : 'flex'} 
                md:flex flex-1 flex-col h-full
            `}>
                 <ChatWindow user={user} contact={selectedContact} onBack={handleBack} />
            </div>
        </div>
    );
};

export default ChatPage;
