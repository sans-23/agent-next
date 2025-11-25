import { useState, useRef, useEffect } from 'react';
import { SendHorizonalIcon, LogOut } from 'lucide-react';
import MessageBubble from './components/MessageBubble';
import SideBar from './components/SideBar';
import ConfirmationModal from './components/ConfirmationModal';
import Login from './components/Login';
import Register from './components/Register';
import { AuthProvider, useAuth } from './context/AuthContext';
import api from './utils/api';
import './App.css';

function AuthenticatedApp() {
    type TextBlock = { block_type: "text"; text: string; };
    type ReactBlock = { block_type: "react"; description?: string; code: string; };
    type LLMOutputBlock = { blocks: (TextBlock | ReactBlock)[]; };

    type ApiMessageContent = TextBlock | LLMOutputBlock;

    type ApiMessage = {
        id: number;
        chat_session_id: string;
        role: 'user' | 'ai';
        content: ApiMessageContent;
        created_at: string;
    };

    type ChatSession = {
        id: string;
        user_id: number;
        title: string;
        created_at: string;
        updated_at: string | null;
        messages: ApiMessage[];
    };

    type ChatHistory = {
        [key: string]: ChatSession;
    };

    const [chatHistory, setChatHistory] = useState<ChatHistory>({});
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ApiMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [chatToDelete, setChatToDelete] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { user, logout } = useAuth();

    // Fetch chat sessions from the backend to populate the sidebar
    useEffect(() => {
        const fetchChatSessions = async () => {
            if (!user?.id) return;

            try {
                const response = await api.get(`/sessions/user/`);
                const sessions: ChatSession[] = response.data.sessions;

                console.log('Fetched sessions:', sessions);

                const formattedChatHistory: ChatHistory = {};
                // Sort sessions by updated_at (most recent first), falling back to created_at
                const sortedSessions = [...sessions].sort((a, b) => {
                    const dateA = new Date(a.updated_at || a.created_at).getTime();
                    const dateB = new Date(b.updated_at || b.created_at).getTime();
                    return dateB - dateA; // Newest first
                });

                sortedSessions.forEach((session: ChatSession) => {
                    // Initialize messages as empty, they will be fetched on selection
                    formattedChatHistory[session.id] = { ...session, messages: [] };
                });
                setChatHistory(formattedChatHistory);
                if (sortedSessions.length > 0) {
                    // Select the most recent chat (first in the sorted array)
                    setSelectedChatId(sortedSessions[0].id);
                }
            } catch (error) {
                console.error('Error fetching chat sessions:', error);
            }
        };

        fetchChatSessions();
    }, [user?.id]);

    // Fetch and display messages for the selected chat session
    useEffect(() => {
        const fetchAndDisplaySessionMessages = async () => {
            if (!selectedChatId) {
                setMessages([]);
                return;
            }

            setIsLoading(true);
            try {
                // Check if messages are already loaded in chatHistory for this session
                const currentSession = chatHistory[selectedChatId];
                if (currentSession && currentSession.messages && currentSession.messages.length > 0) {
                    setMessages(currentSession.messages);
                    setIsLoading(false);
                    return;
                }

                // If not loaded, fetch from /api/v1/sessions/{session_id}
                const response = await api.get(`/sessions/${selectedChatId}`);
                const sessionDetail: ChatSession = response.data;

                // Update chatHistory with the fetched messages for this specific session
                setChatHistory(prev => ({
                    ...prev,
                    [selectedChatId]: {
                        ...prev[selectedChatId],
                        messages: sessionDetail.messages,
                    } as ChatSession,
                }));

                setMessages(sessionDetail.messages);

            } catch (error) {
                console.error('Error fetching session messages:', error);
                setMessages([{
                    id: Date.now(),
                    chat_session_id: selectedChatId || '',
                    role: 'ai',
                    content: { block_type: "text", text: 'Error: Could not load messages for this session.' },
                    created_at: new Date().toISOString()
                }]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndDisplaySessionMessages();
    }, [selectedChatId]);

    // Update chat history in state on message send
    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !user?.id) return;

        setIsLoading(true);
        const currentInput = input;
        setInput('');

        if (!selectedChatId) {
            // This is a new chat. Optimistically update the UI with the user's message.
            const newUserApiMessage: ApiMessage = {
                id: Date.now(), // Temporary ID
                chat_session_id: 'temp-session-id', // Placeholder
                role: 'user',
                content: { block_type: "text", text: currentInput },
                created_at: new Date().toISOString()
            };
            setMessages([newUserApiMessage]);

            try {
                const payload = {
                    user_id: user.id,
                    initial_message: currentInput
                };

                const response = await api.post('/sessions/', payload);

                const newSession: ChatSession = response.data;
                // Replace the temporary message with the actual messages from the server
                setChatHistory(prev => ({ ...prev, [newSession.id]: newSession }));
                setSelectedChatId(newSession.id);
                setMessages(newSession.messages);
            } catch (error) {
                console.error('Error creating new chat session:', error);
                // Revert the optimistic update and show an error
                setMessages(prev => prev.map(msg =>
                    msg.id === newUserApiMessage.id
                        ? { ...msg, content: { block_type: "text", text: 'Error: Could not send message.' } }
                        : msg
                ));
            } finally {
                setIsLoading(false);
            }
        } else {
            // This is an existing chat
            const newUserApiMessage: ApiMessage = {
                id: Date.now(), // Temporary ID
                chat_session_id: selectedChatId,
                role: 'user',
                content: { block_type: "text", text: currentInput },
                created_at: new Date().toISOString()
            };

            const currentSession = chatHistory[selectedChatId];
            const updatedMessagesForSend = [...(currentSession?.messages || []), newUserApiMessage];

            setChatHistory(prev => ({
                ...prev,
                [selectedChatId]: {
                    ...currentSession,
                    messages: updatedMessagesForSend,
                } as ChatSession,
            }));
            setMessages(updatedMessagesForSend);

            try {
                const payload = { session_id: selectedChatId, user_id: user.id, content: currentInput };
                const response = await api.post('/sessions/chat', payload);

                const data = response.data;
                const userMessageFromServer: ApiMessage = data.user_message;
                const aiMessageFromServer: ApiMessage = data.ai_response;

                setChatHistory(prev => {
                    const updatedSession = { ...prev[selectedChatId] } as ChatSession;
                    const prevMsgs = updatedSession.messages ? [...updatedSession.messages] : [];
                    if (prevMsgs.length > 0) {
                        prevMsgs.pop();
                    }
                    const newMsgs = [...prevMsgs, userMessageFromServer, aiMessageFromServer];
                    updatedSession.messages = newMsgs;
                    return { ...prev, [selectedChatId]: updatedSession };
                });
                setMessages(prev => {
                    const prevMsgs = [...prev];
                    if (prevMsgs.length > 0) {
                        prevMsgs.pop();
                    }
                    return [...prevMsgs, userMessageFromServer, aiMessageFromServer];
                });
            } catch (error) {
                console.error('Error sending message:', error);
            } finally {
                setIsLoading(false);
            }
        }
    };

    // Auto-scroll to the latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleChatSelection = (chatId: string) => {
        setSelectedChatId(chatId);
    };

    const handleNewChat = () => {
        setSelectedChatId(null);
        setMessages([]);
        setIsSidebarOpen(false);
    };

    const handleDeleteChat = (chatId: string) => {
        setChatToDelete(chatId);
        setIsModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!chatToDelete) return;

        try {
            await api.delete(`/sessions/${chatToDelete}`);

            const newChatHistory = { ...chatHistory };
            delete newChatHistory[chatToDelete];
            setChatHistory(newChatHistory);

            if (selectedChatId === chatToDelete) {
                const remainingChats = Object.values(newChatHistory)
                    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());

                if (remainingChats.length > 0) {
                    setSelectedChatId(remainingChats[0].id);
                } else {
                    setSelectedChatId(null);
                    setMessages([]);
                }
            }
        } catch (error) {
            console.error('Error deleting chat session:', error);
        } finally {
            setIsModalOpen(false);
            setChatToDelete(null);
        }
    };

    return (
        <div className="app-wrapper">
            <SideBar
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                chatHistory={chatHistory}
                selectedChatId={selectedChatId}
                handleChatSelection={handleChatSelection}
                handleNewChat={handleNewChat}
                handleDeleteChat={handleDeleteChat}
            />
            <ConfirmationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={confirmDelete}
                message="Are you sure you want to delete this chat?"
            />

            {/* Main Chat Container */}
            <div className="chat-container-main">
                {/* Header */}
                <header className="chat-header">
                    <div className="header-title">
                        <span>Jarvis</span>
                    </div>
                    <button onClick={logout} className="logout-button" title="Sign Out">
                        <LogOut size={20} />
                    </button>
                </header>

                {/* Messages List */}
                <div className="messages-list">
                    {messages.length === 0 ? (
                        <div className="empty-chat-message">
                            <h2>Welcome back, {user?.username}</h2>
                            <p>This is your personal AI assistant. Feel free to ask me anything!</p>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <MessageBubble key={index} msg={msg} />
                        ))
                    )}
                    {isLoading && (
                        <div className="typing-row">
                            <div className="typing-indicator">
                                <div className="typing-dot"></div>
                                <div className="typing-dot"></div>
                                <div className="typing-dot"></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Message Input Form */}
                <form
                    className="input-form"
                    onSubmit={handleSendMessage}
                >
                    <div className="input-wrapper">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask me anything..."
                            disabled={isLoading}
                            className="input-field"
                        />
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="send-button"
                        >
                            <SendHorizonalIcon className="send-icon" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function AppContent() {
    const { isAuthenticated } = useAuth();
    const [isRegistering, setIsRegistering] = useState(false);

    if (isAuthenticated) {
        return <AuthenticatedApp />;
    }

    return isRegistering ? (
        <Register onSwitchToLogin={() => setIsRegistering(false)} />
    ) : (
        <Login onSwitchToRegister={() => setIsRegistering(true)} />
    );
}

export default function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}
