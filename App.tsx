
import React, { useState, useEffect, useCallback } from 'react';
import AuthPage from './components/AuthPage';
import ChatPage from './components/ChatPage';
import { UserCredentials } from './types';
import { authService } from './services/authService';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
    const [user, setUser] = useState<UserCredentials | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const handleLoginSuccess = useCallback((credentials: UserCredentials) => {
        setUser(credentials);
    }, []);

    const handleLogout = useCallback(() => {
        authService.logout();
        setUser(null);
    }, []);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const sessionUser = await authService.checkSession();
                if (sessionUser) {
                    setUser(sessionUser);
                }
            } catch (error) {
                console.error("Session check failed:", error);
            } finally {
                setIsLoading(false);
            }
        };
        checkSession();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-900 text-white">
                <Loader2 className="w-12 h-12 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-hidden">
            {user ? (
                <ChatPage user={user} onLogout={handleLogout} />
            ) : (
                <AuthPage onLoginSuccess={handleLoginSuccess} />
            )}
        </div>
    );
};

export default App;
