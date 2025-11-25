import React from 'react';
import { MenuIcon, MessageSquare, Plus, Trash2, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface TextBlock { block_type: "text"; text: string; }
interface ReactBlock { block_type: "react"; description?: string; code: string; }
interface LLMOutputBlock { blocks: (TextBlock | ReactBlock)[]; }

type ApiMessageContent = TextBlock | LLMOutputBlock;

interface ApiMessage {
    id: number;
    chat_session_id: string;
    role: 'user' | 'ai';
    content: ApiMessageContent;
    created_at: string;
}

interface ChatSession {
    id: string;
    user_id: number;
    title: string;
    created_at: string;
    updated_at: string | null;
    messages: ApiMessage[];
}

interface SideBarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    chatHistory: { [key: string]: ChatSession };
    selectedChatId: string | null;
    handleChatSelection: (chatId: string) => void;
    handleNewChat: () => void;
    handleDeleteChat: (chatId: string) => void;
}

const SideBar: React.FC<SideBarProps> = ({ isSidebarOpen, setIsSidebarOpen, chatHistory, selectedChatId, handleChatSelection, handleNewChat, handleDeleteChat }) => {
    const { user } = useAuth();

    const getChatTitle = (chatId: string) => {
        const session = chatHistory[chatId];
        if (session && session.title) {
            const title = session.title;
            return title.length > 24 ? title.substring(0, 24) + '...' : title;
        }
        return 'New Chat';
    };

    return (
        <aside className={`sidebar ${isSidebarOpen ? '' : 'closed'}`}>
            <div className="sidebar-header">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}>
                    <MenuIcon size={20} />
                </button>
                {isSidebarOpen && (
                    <button className="new-chat-button" onClick={handleNewChat} title="New Chat">
                        <Plus size={18} />
                    </button>
                )}
            </div>

            <div className="chat-history-list">
                {isSidebarOpen && Object.entries(chatHistory)
                    .sort(([, a], [, b]) => {
                        const dateA = new Date(a.updated_at || a.created_at).getTime();
                        const dateB = new Date(b.updated_at || b.created_at).getTime();
                        return dateB - dateA;
                    })
                    .map(([chatId]) => (
                        <div
                            key={chatId}
                            className={`chat-history-item ${selectedChatId === chatId ? 'selected' : ''}`}
                            onClick={() => handleChatSelection(chatId)}
                        >
                            <MessageSquare size={16} style={{ flexShrink: 0, marginRight: '8px' }} />
                            <span className="chat-history-item-text">{getChatTitle(chatId)}</span>
                            <button
                                className="delete-chat-button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteChat(chatId);
                                }}
                                title="Delete Chat"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
            </div>

            <div className="sidebar-footer">
                <div className="user-profile">
                    <div className="avatar">
                        {user?.username?.charAt(0).toUpperCase() || <User size={16} />}
                    </div>
                    {isSidebarOpen && <span className="username">{user?.username || 'Guest'}</span>}
                </div>
            </div>
        </aside>
    );
};

export default SideBar;