
import React, { useState, FormEvent } from 'react';
import { UserCredentials } from '../types';
import { authService } from '../services/authService';
import { Loader2 } from 'lucide-react';

interface AuthPageProps {
    onLoginSuccess: (user: UserCredentials) => void;
}

type AuthTab = 'login' | 'signup';

const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
    const [activeTab, setActiveTab] = useState<AuthTab>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!username || !password) {
            setStatus('Username and password are required.');
            return;
        }
        setIsLoading(true);
        setStatus('');

        try {
            if (activeTab === 'login') {
                const user = await authService.login(username, password);
                onLoginSuccess(user);
            } else {
                await authService.signup(username, password);
                setStatus('Signup successful! Please log in.');
                setActiveTab('login');
                // Don't clear password so user can log in
            }
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const renderTabButton = (tab: AuthTab, label: string) => (
        <button
            onClick={() => { setActiveTab(tab); setStatus(''); }}
            className={`flex-1 py-3 font-semibold transition-colors duration-200 focus:outline-none ${
                activeTab === tab
                    ? 'text-white border-b-2 border-indigo-500'
                    : 'text-gray-400 hover:text-white'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="flex items-center justify-center h-full p-4 bg-gray-900">
            <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
                <h1 className="text-3xl font-bold text-center text-white mb-2">D-Chat</h1>
                <p className="text-center text-gray-400 mb-8">Decentralized & Encrypted</p>

                <div className="flex border-b border-gray-700 mb-6">
                    {renderTabButton('login', 'Login')}
                    {renderTabButton('signup', 'Sign Up')}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-300">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="mt-1 block w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="mt-1 block w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex justify-center py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 rounded-lg text-white font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                    >
                        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (activeTab === 'login' ? 'Login' : 'Sign Up')}
                    </button>
                </form>

                {status && <p className="mt-4 text-center text-sm text-yellow-400">{status}</p>}
            </div>
        </div>
    );
};

export default AuthPage;
