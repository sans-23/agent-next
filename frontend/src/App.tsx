import { useState, useRef, useEffect } from 'react';
import { SendHorizonalIcon } from 'lucide-react';
import MessageBubble from './components/MessageBubble';
import SideBar from './components/SideBar';
import ConfirmationModal from './components/ConfirmationModal';
import './App.css';

function App() {
    type TextBlock = { block_type: "text"; text: string; };
    type ReactBlock = { block_type: "react"; description?: string; code: string; };
    type LLMOutputBlock = { blocks: (TextBlock | ReactBlock)[]; };

    type ApiMessageContent = TextBlock | LLMOutputBlock; // Content can be a TextBlock or LLMOutputBlock

    type ApiMessage = {
        id: number;
        chat_session_id: string;
        role: 'user' | 'ai'; // Role can be 'user' or 'ai'
        content: ApiMessageContent;
        created_at: string;
    };

    type ChatSession = {
        id: string;
        user_id: number;
        title: string;
        created_at: string;
        updated_at: string | null;
        messages: ApiMessage[]; // Messages are now ApiMessage objects
    };

    type ChatHistory = {
        [key: string]: ChatSession;
    };
    
    const [chatHistory, setChatHistory] = useState<ChatHistory>({});
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ApiMessage[]>([]); // Use ApiMessage for display
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [chatToDelete, setChatToDelete] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch chat sessions from the backend to populate the sidebar
    useEffect(() => {
        const fetchChatSessions = async () => {
            try {
                const response = await fetch('http://localhost:8000/api/v1/sessions/user/2'); // Assuming user_id is 1
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                const sessions: ChatSession[] = data.sessions;

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
    }, []);

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
                const response = await fetch(`http://localhost:8000/api/v1/sessions/${selectedChatId}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const sessionDetail: ChatSession = await response.json(); // The response is now a ChatSession

                // Update chatHistory with the fetched messages for this specific session
                setChatHistory(prev => ({
                    ...prev,
                    [selectedChatId]: {
                        ...prev[selectedChatId],
                        messages: sessionDetail.messages, // Store the raw API messages
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
    }, [selectedChatId]); // Removed chatHistory from dependency array

    // Update chat history in state on message send
    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

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
                    user_id: 2, // Assuming user_id is 2
                    initial_message: currentInput
                };
    
                const response = await fetch('http://localhost:8000/api/v1/sessions/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
    
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
    
                const newSession: ChatSession = await response.json();
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
                const payload = { session_id: selectedChatId, user_id: 2, content: currentInput };
                const response = await fetch('http://localhost:8000/api/v1/sessions/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
    
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
    
                const data = await response.json();
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
                // Handle error for existing chat
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
            const response = await fetch(`http://localhost:8000/api/v1/sessions/${chatToDelete}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

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
                        <h1 className="header-title">Jarvis</h1>
                    </header>

                    {/* Messages List */}
                    <div className="messages-list">
                        {messages.length === 0 ? (
                            <div className="empty-chat-message">
                                <h2>Welcome to your Chatbot</h2>
                                <p>This is a minimalistic chat interface inspired by the Gemini UI. Feel free to ask me anything!</p>
                            </div>
                        ) : (
                            messages.map((msg, index) => (
                                <MessageBubble key={index} msg={msg} />
                            ))
                        )}
                        {isLoading && (
                            <div className="typing-row ai">
                                <div className="typing-bubble">
                                    <div className="typing">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
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

export default App;
