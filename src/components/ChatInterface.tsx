// Mohammad Shafay Joyo @ 2025

"use client"

import React, { useState, useRef, useEffect } from "react"
import type { Message } from "@/types/chat"
import { ArrowUp, MoreVertical, Trash2, Settings, X } from "lucide-react"

interface Conversation {
  id: string;
  createdAt: string;
  status: string;
  metadata: string;
}

// BotMessage component handles the typing animation effect for bot responses
const BotMessage = React.memo(({ 
  content, 
  isDarkTheme, 
  isNewMessage = false  // Controls whether to show typing effect
}: { 
  content: string; 
  isDarkTheme: boolean;
  isNewMessage?: boolean;
}) => {
  // State for managing displayed content and typing status
  const [displayedContent, setDisplayedContent] = useState('');
  const [hasTyped, setHasTyped] = useState(!isNewMessage);

  useEffect(() => {
    // Show content instantly for old messages
    if (!isNewMessage) {
      setDisplayedContent(content);
      return;
    }

    // Skip if already typed
    if (hasTyped) return;
    
    // Implement typing effect for new messages
    let index = 0;
    setDisplayedContent('');
    
    const timer = setInterval(() => {
      if (index < content.length) {
        const nextChar = content[index];
        setDisplayedContent(prev => prev + nextChar);
        index++;
      } else {
        clearInterval(timer);
        setHasTyped(true);
      }
    }, 11);  // Increased from 10 to 35ms to slow down typing speed

    // Cleanup timer on unmount
    return () => clearInterval(timer);
  }, [content, hasTyped, isNewMessage]);

  return (
    <div className="flex items-start gap-3">
      <img 
        src="/Purplehire.png"
        alt="Purplehire"
        className="w-6 h-6 rounded-full mt-3"
      />
      <div className={`inline-block p-3 rounded-[14px] max-w-[85%] transition-colors duration-300 break-words ${
        isDarkTheme 
          ? 'bg-dark-light text-white'
          : 'bg-gray-100 text-black'
      }`}>
        {displayedContent}
      </div>
    </div>
  );
});

BotMessage.displayName = 'BotMessage';

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showInitialMessage, setShowInitialMessage] = useState(true);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInputCentered, setIsInputCentered] = useState(true);
  const [typewriterKey, setTypewriterKey] = useState(Date.now());
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editedSessionName, setEditedSessionName] = useState<string>('');
  const [hasStartedConversation, setHasStartedConversation] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isInterviewFinished, setIsInterviewFinished] = useState(false);
  const [showSwitchWarning, setShowSwitchWarning] = useState(false);
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [isLatestSession, setIsLatestSession] = useState(true);
  const [showNewInterviewConfirm, setShowNewInterviewConfirm] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, messagesEndRef]) // Added messagesEndRef to dependencies

  useEffect(() => {
    // Only fetch existing conversations on mount
    fetchConversations();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuOpen) {
        setMenuOpen(null);
      }
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [menuOpen, isSettingsOpen]);

  const handleInitialMessage = async () => {
    try {
      setIsInitializing(true);
      setShowInitialMessage(true);  // Show only the typewriter message
      setIsInputCentered(true);
      setMessages([]);  // Clear any existing messages
      setInput('');
      setIsInterviewFinished(false);
      setIsLatestSession(true);
      
      setTypewriterKey(Date.now());

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "",
          isInitial: true,
        }),
      });

      const data = await response.json();
      if (data.messages?.[0]) {
        await fetchConversations();
        setConversationId(data.conversationId);
        setHasStartedConversation(true);
        // Don't add the initial message to messages array
      }

      setTimeout(() => {
        scrollToBottom();
      }, 100);

    } catch (error) {
      console.error("Error starting conversation:", error);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    setHasStartedConversation(true);
    setShowInitialMessage(false);
    setIsInputCentered(false);
    
    try {
      const userMessage: Message = {
        id: Date.now().toString(),
        content: input,
        role: "user",
        createdAt: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      setInput("")
      setIsLoading(true)
      setIsTyping(true)

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = '56px';
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          conversationId,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Only add the bot's response, not the user's message again
      if (data.messages) {
        const botMessages = data.messages.filter((msg: Message) => msg.role === 'assistant');
        const updatedBotMessages = botMessages.map((msg: Message) => ({
          ...msg,
          id: `new-${msg.id}`
        }));
        setMessages(prev => [...prev, ...updatedBotMessages]);
      }

      // Check the status from the backend to determine if the interview is finished
      if (data.status === "completed") {
        setIsInterviewFinished(true);
        setIsLatestSession(true); // Ensure we're in the latest session when it finishes
      }

      // Update conversation ID if not set
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId)
      }

    } catch (error) {
      console.error("Error sending message:", error)
      // Add error message to chat
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        content: "Sorry, there was an error processing your message. Please try again.",
        role: "assistant",
        createdAt: new Date(),
      }])
    } finally {
      setIsLoading(false)
      setIsTyping(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (e.target.value === '' && messages.length === 0) {
      setIsInputCentered(true);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      const data = await response.json();
      
      // Sort conversations by date
      const sortedConversations = data.conversations.sort((a: Conversation, b: Conversation) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      setConversations(sortedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const handleConversationClick = (id: string) => {
    // Check if current conversation is the latest one
    const isCurrentLatest = conversations[0]?.id === conversationId;
    
    if (hasStartedConversation && id !== conversationId && isCurrentLatest) {
      setPendingConversationId(id);
      setShowSwitchWarning(true);
    } else {
      switchToConversation(id);
    }
  };

  const switchToConversation = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/conversations/${id}`);
      const data = await response.json();
      
      // Mark all messages as history when loading past conversation
      const historicalMessages = data.messages.map((msg: Message) => ({
        ...msg,
        id: `history-${msg.id}`
      }));
      
      setMessages(historicalMessages);
      setConversationId(id);
      setShowInitialMessage(false);
      setIsInputCentered(false);
      setShowSwitchWarning(false);
      setPendingConversationId(null);
      setHasStartedConversation(true);
      
      // Check if this is the latest conversation
      const isLatest = conversations[0]?.id === id;
      setIsLatestSession(isLatest);
      
      // Set interview as finished based on the conversation status
      setIsInterviewFinished(data.status === "completed");

      // Scroll to bottom after a short delay to ensure messages are rendered
      setTimeout(() => {
        scrollToBottom();
      }, 100);

    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the conversation load
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setConversations(prev => prev.filter(conv => conv.id !== id));
        if (id === conversationId) {
          setMessages([]);
          setConversationId(null);
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
    setMenuOpen(null);
  };

  const handleDeleteAll = async () => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setConversations([]);
        setMessages([]);
        setConversationId(null);

        // Reset state to reflect the initial state before any conversation starts
        setShowInitialMessage(true);
        setIsInputCentered(true);
        setHasStartedConversation(false);
        setIsInterviewFinished(false); // Ensure interview finished state is false
        setIsLatestSession(true); // Assume we are in the latest (non-existent) session state

        // Close confirmation dialog and settings
        setShowDeleteConfirm(false);
        setIsSettingsOpen(false);
      }
    } catch (error) {
      console.error('Error deleting all conversations:', error);
    }
  };

  const handleSessionNameUpdate = async (id: string, newName: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      });
      
      if (response.ok) {
        setConversations(prev => prev.map(conv => 
          conv.id === id 
            ? { ...conv, metadata: JSON.stringify({ ...JSON.parse(conv.metadata || '{}'), name: newName }) }
            : conv
        ));
      }
    } catch (error) {
      console.error('Error updating session name:', error);
    }
    setEditingSessionId(null);
  };

  const handleNewInterviewClick = () => {
    if (messages.length > 0) {
      setShowNewInterviewConfirm(true);
    }
  };

  // Update the sidebar conversation display
  const renderConversationName = (conversation: Conversation) => {
    try {
      const metadata = JSON.parse(conversation.metadata || '{}');
      // Return name if available, otherwise return session number
      return metadata.name 
        ? `${metadata.name}`
        : `Session ${conversations.length - conversations.indexOf(conversation)}`;
    } catch (error) {
      return `Session ${conversations.length - conversations.indexOf(conversation)}`;
    }
  };

  return (
    <div className={`flex h-screen transition-all duration-200 ${isDarkTheme ? 'bg-black text-white' : 'bg-white text-black'}`}>
      {/* Sidebar with chat history */}
      <div className={`${
        isSidebarOpen ? 'w-64' : 'w-0'
      } ${isDarkTheme ? 'bg-dark-lighter' : 'bg-gray-100'} overflow-hidden transition-all duration-200`}>
        <div className={`${
          isSidebarOpen 
            ? 'opacity-100 translate-x-0 w-64 p-4 h-full flex flex-col'
            : 'opacity-0 -translate-x-full w-0 p-0'
        } transition-all duration-50`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <button
                onClick={handleNewInterviewClick}
                disabled={messages.length === 0}
                className={`w-full px-4 py-2 text-left flex items-center gap-2 group relative ${
                  messages.length === 0 
                    ? 'opacity-50 cursor-not-allowed' 
                    : isDarkTheme 
                      ? 'hover:bg-dark-light' 
                      : 'hover:bg-gray-200'
                }`}
              >
                <svg
                  stroke="currentColor"
                  fill="none"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  height="16"
                  width="16"
                  className={`${isDarkTheme ? 'text-current' : 'text-black'}`}
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span className={`text-sm ${isDarkTheme ? 'text-[#dcdcdc]' : 'text-black'}`}>New Interview</span>
                
                {/* Updated Tooltip Position */}
                <span className={`absolute left-0 top-full mt-2 scale-0 transition-all rounded p-2 text-xs whitespace-nowrap group-hover:scale-100 z-50 ${
                  isDarkTheme ? 'bg-gray-800 text-white' : 'bg-white text-black border border-gray-200'
                }`}>
                  {messages.length === 0 
                    ? 'Start the interview first'
                    : 'New Interview'
                  }
                </span>
              </button>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className={`p-2 rounded transition-none group relative ${
                isDarkTheme ? 'hover:bg-dark-light' : 'hover:bg-gray-200'
              }`}
            >
              <svg
                stroke="currentColor"
                fill="none"
                strokeWidth="2"
                viewBox="0 0 24 24"
                strokeLinecap="round"
                strokeLinejoin="round"
                height="20"
                width="20"
                className={`${isDarkTheme ? 'text-current' : 'text-black'}`}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
                <path d="M13 8l-4 4 4 4"></path>
              </svg>
              <span className={`absolute right-full mr-2 scale-0 transition-all rounded p-2 text-xs whitespace-nowrap group-hover:scale-100 ${
                isDarkTheme ? 'bg-gray-800 text-white' : 'bg-white text-black border border-gray-200'
              }`}>
                Hide sidebar
              </span>
            </button>
          </div>
          
          {/* Sessions List */}
          <div className="space-y-2 mt-6 flex-1 overflow-y-auto">
            {conversations.map((conv, index) => (
              <div
                key={conv.id}
                onClick={() => handleConversationClick(conv.id)}
                onDoubleClick={() => {
                  setEditingSessionId(conv.id);
                  setEditedSessionName(JSON.parse(conv.metadata || '{}').name || `Session ${conversations.length - index}`);
                }}
                className={`group relative p-3 rounded cursor-pointer transition-smooth hover:scale-[1.02] ${
                  conversationId === conv.id 
                    ? `${isDarkTheme 
                        ? 'bg-dark-light border-l-4 border-dark-lighter'
                        : 'bg-gray-100 border-l-4 border-gray-100'}`
                    : `${isDarkTheme 
                        ? 'hover:bg-dark-light' 
                        : 'hover:bg-gray-100'}`
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    {editingSessionId === conv.id ? (
                      <input
                        type="text"
                        value={editedSessionName}
                        onChange={(e) => setEditedSessionName(e.target.value)}
                        onBlur={() => handleSessionNameUpdate(conv.id, editedSessionName)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSessionNameUpdate(conv.id, editedSessionName);
                          } else if (e.key === 'Escape') {
                            setEditingSessionId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className={`font-medium text-base px-2 py-1 rounded ${
                          isDarkTheme 
                            ? 'bg-dark-lighter text-[#dcdcdc]' 
                            : 'bg-white text-black'
                        } outline-none`}
                      />
                    ) : (
                      <div className={`font-medium text-base ${
                        isDarkTheme ? 'text-[#dcdcdc]' : 'text-black'
                      }`}>
                        {renderConversationName(conv)}
                      </div>
                    )}
                    <div className={`text-[15px] ${
                      isDarkTheme ? 'text-[rgb(185,185,185)]' : 'text-black'
                    }`}>
                      {new Date(conv.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  
                  {/* Three dots menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === conv.id ? null : conv.id);
                      }}
                      className={`p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
                        isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                      }`}
                    >
                      <MoreVertical size={16} />
                    </button>
                    
                    {/* Dropdown menu */}
                    {menuOpen === conv.id && (
                      <div 
                        className={`absolute right-0 mt-1 w-32 py-2 rounded-md shadow-lg z-10 ${
                          isDarkTheme ? 'bg-dark-light' : 'bg-white border border-gray-200'
                        }`}
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeleteId(conv.id); // Set the ID of the conversation to be deleted
                            setShowDeleteConfirm(true); // Show the confirmation dialog
                          }}
                          className={`w-full px-4 py-2 text-left text-sm text-red-400 flex items-center whitespace-nowrap ${
                            isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-700/10'
                          }`}
                        >
                          <Trash2 size={5} />
                          Delete Session
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col transition-colors duration-10 ${isDarkTheme ? 'bg-black' : 'bg-white'}`}>
        {/* Header with settings and title */}
        <div className={`p-4 border-b ${isDarkTheme ? 'border-dark-light' : 'border-gray-200'} flex justify-between items-center`}>
          <div className="w-8"></div>
          <div className={`text-lg font-medium ${isDarkTheme ? 'text-[#dcdcdc]' : 'text-[rgb(147,0,255)]'}`}>
            {conversationId ? (
              conversations.find(conv => conv.id === conversationId)?.metadata 
                ? JSON.parse(conversations.find(conv => conv.id === conversationId)?.metadata || '{}').name || 
                  `Session ${conversations.length - conversations.findIndex(conv => conv.id === conversationId)}`
                : `Session ${conversations.length - conversations.findIndex(conv => conv.id === conversationId)}`
            ) : (
              'New Chat'
            )}
          </div>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSettingsOpen(!isSettingsOpen);
              }}
              className={`p-2 rounded-full transition-none group relative ${
                isDarkTheme ? 'hover:bg-dark-light' : 'hover:bg-gray-200'
              }`}
            >
              <Settings size={20} />
              <span className={`absolute right-full mr-2 scale-0 transition-all rounded p-2 text-xs whitespace-nowrap group-hover:scale-100 ${
                isDarkTheme ? 'bg-gray-800 text-white' : 'bg-white text-black border border-gray-200'
              }`}>
                Settings
              </span>
            </button>

            {/* Settings dropdown menu */}
            {isSettingsOpen && (
              <div 
                onClick={e => e.stopPropagation()}
                className={`absolute right-0 mt-2 w-48 py-2 ${
                  isDarkTheme ? 'bg-dark-light' : 'bg-white border border-gray-200'
                } rounded-md shadow-lg z-10`}
              >
                <button
                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                    isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setIsDarkTheme(!isDarkTheme);
                    setIsSettingsOpen(false);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                  Toggle Theme
                </button>
                
                {/* Add FAQ button */}
                <button
                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                    isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setShowFAQ(true);
                    setIsSettingsOpen(false);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  FAQ
                </button>
                
                <button
                  onClick={() => {
                    setShowDeleteConfirm(true);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm text-red-400 flex items-center gap-2 ${
                    isDarkTheme ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <Trash2 size={16} />
                  Delete All Chats
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className={`flex-1 overflow-y-auto p-4 ${
          !isSidebarOpen ? 'pl-[150px]' : ''  // Add extra padding-left when sidebar is closed
        }`}>
          {showInitialMessage ? (
            <div className="flex justify-center items-center h-full relative">
              <div 
                className="typewriter-message absolute top-[-10%] pointer-events-none" 
                key={typewriterKey}
                style={{
                  left: isSidebarOpen ? '0px' : '-29px'
                }}
              >
                Hi! Are you interested in discussing a Full Stack role?
              </div>
            </div>
          ) : (
            <div className={`max-w-3xl mx-auto mb-24 ${
              !isSidebarOpen ? 'ml-[240px]' : ''  // Add margin-left when sidebar is closed
            }`}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-6 ${
                    message.role === 'user' ? 'text-right' : 'text-left'
                  }`}
                >
                  {message.role === 'user' ? (
                    <div
                      className={`inline-block p-3 rounded-[14px] max-w-[85%] transition-colors duration-300 break-words text-right ${
                        isDarkTheme 
                          ? 'bg-dark-light text-white' 
                          : 'bg-gray-100 text-black'
                      }`}
                      style={{ textAlign: 'left' }}
                    >
                      {message.content}
                    </div>
                  ) : (
                    <BotMessage 
                      content={message.content || ''} 
                      isDarkTheme={isDarkTheme}
                      isNewMessage={isLatestSession && !message.id.startsWith('history-')}  // Only show typing effect for new messages in current session
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          {isTyping && (
            <div className="max-w-3xl mx-auto mb-6 text-left">
              <div className={`inline-block p-2 rounded-[14px] ${
                isDarkTheme 
                  ? 'bg-dark-light text-white' 
                  : 'bg-gray-100 text-black'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`typing-dot ${isDarkTheme ? 'bg-white' : 'bg-black'}`}></div>
                  <div className={`typing-dot ${isDarkTheme ? 'bg-white' : 'bg-black'}`}></div>
                  <div className={`typing-dot ${isDarkTheme ? 'bg-white' : 'bg-black'}`}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area - hide when interview is finished or viewing past conversation */}
        {!isInterviewFinished && isLatestSession && (
          <form onSubmit={handleSubmit} className={`${
            isInputCentered && showInitialMessage 
              ? 'absolute top-[50%] left-0 right-0 z-20'
              : 'sticky bottom-0 p-4 bg-inherit'
            } ${isDarkTheme ? 'border-dark-light' : 'border-gray-200'} transition-all duration-200`}
            style={{
              marginLeft: !isSidebarOpen ? '32px' : '0px'
            }}
          >
            <div className={`relative ${
              isInputCentered && showInitialMessage 
                ? 'flex justify-center' 
                : ''
            }`}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (e.target.value === '' && messages.length === 0) {
                    setIsInputCentered(true);
                  }
                  // Auto-adjust height while typing
                  e.target.style.height = '56px';  // Reset first
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                className={`${
                  isInputCentered && showInitialMessage
                    ? isSidebarOpen
                      ? 'w-[490px] ml-[280px]'
                      : 'w-[490px] ml-[40px]'  // Adjusted margin when sidebar is closed
                    : isSidebarOpen 
                      ? 'w-[65%] ml-[200px]'
                      : 'w-[56%] ml-[330px]'
                } rounded-[20px] transition-all duration-300 ${
                  isDarkTheme 
                    ? 'bg-dark-light text-white placeholder-gray-400' 
                    : 'bg-gray-100 text-black placeholder-gray-500'
                } p-4 pr-16 outline-none resize-none min-h-[56px] max-h-[200px] overflow-y-auto`}
                placeholder="Type your message..."
                disabled={isLoading || isInterviewFinished}
                rows={1}
              />
              <button
                type="submit"
                disabled={isLoading || isInterviewFinished}
                className={`absolute top-1/2 -translate-y-1/2 p-1.5 hover-effect rounded-full bg-[rgb(111,12,240)] ${
                  isInputCentered && showInitialMessage
                    ? isSidebarOpen
                      ? 'translate-x-[350px]'
                      : 'translate-x-[230px]'
                    : isSidebarOpen
                      ? 'ml-[-50px]'
                      : 'ml-[-50px]'
                } transition-smooth ${isLoading || isInterviewFinished ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[rgb(111,12,240]'}`}
              >
                <ArrowUp size={20} className={`text-white ${isLoading ? 'animate-pulse' : ''}`} />
              </button>
              {isLoading && (
                <div className={`absolute top-1/2 -translate-y-1/2 ${
                  isInputCentered && showInitialMessage
                    ? 'ml-[890px]'
                    : isSidebarOpen
                      ? 'ml-[890px]'
                      : 'ml-[1040px]'  // Adjusted to stay closer to send button when sidebar is closed
                }`}>
                  <div className={`animate-spin rounded-full h-4 w-4 border-2 border-t-transparent ${
                    isDarkTheme 
                      ? 'border-purple-600' 
                      : 'border-purple-600'
                  }`}></div>
                </div>
              )}
            </div>
          </form>
        )}

        {/* Message for ended or past conversations */}
        {(isInterviewFinished || !isLatestSession) && (
          <div className={`sticky bottom-0 p-4 text-center ${
            isDarkTheme ? 'bg-black' : 'bg-white'
          }`}>
            <p className={`text-sm ${
              isDarkTheme ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {isInterviewFinished 
                ? 'This interview has ended. Start a new interview to continue chatting.'
                : 'You are viewing a past conversation. Start a new interview to continue chatting.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${
            isDarkTheme
              ? 'bg-dark-light text-white'
              : 'bg-white text-black'
          } rounded-lg p-6 max-w-sm w-full mx-4`}>
            {/* Modified title */}
            <h3 className="text-lg font-medium mb-4">
              {pendingDeleteId ? 'Delete Conversation?' : 'Delete All Conversations?'}
            </h3>
            {/* Modified paragraph text */}
            <p className={`mb-6 ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
              {pendingDeleteId
                ? 'Are you sure you want to delete this conversation? This action cannot be undone.'
                : 'Are you sure you want to delete all conversations? This action cannot be undone.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={(e) => {
                  if (pendingDeleteId) {
                    handleDelete(pendingDeleteId, e); // Call single delete
                  } else {
                    handleDeleteAll(); // Call delete all
                  }
                  setShowDeleteConfirm(false); // Hide the confirmation dialog
                  setPendingDeleteId(null); // Clear the pending delete ID
                }}
                className="px-4 py-2 bg-red-500 rounded hover:opacity-90 transition-colors text-white"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false); // Hide the confirmation dialog
                  setPendingDeleteId(null); // Clear the pending delete ID
                }}
                className={`px-4 py-2 rounded transition-colors ${
                  isDarkTheme
                    ? 'hover:bg-gray-700'
                    : 'hover:bg-gray-100'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add toggle button in chat area when sidebar is closed */}
      {!isSidebarOpen && (
        <div className={`absolute left-0 top-0 h-full w-[52px] ${
          isDarkTheme ? 'bg-dark-lighter' : 'bg-gray-100'
        } transition-colors`}>
          <div className="pt-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className={`p-4 rounded transition-none group relative ${
                isDarkTheme ? 'hover:bg-dark-light' : 'hover:bg-gray-200'
              }`}
            >
              <svg
                stroke="currentColor"
                fill="none"
                strokeWidth="2"
                viewBox="0 0 24 24"
                strokeLinecap="round"
                strokeLinejoin="round"
                height="20"
                width="20"
                className={`${isDarkTheme ? 'text-current' : 'text-black'}`}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
                <path d="M13 8l4 4-4 4"></path>
              </svg>
              <span className={`absolute left-full ml-2 scale-0 transition-all rounded p-2 text-xs whitespace-nowrap group-hover:scale-100 ${
                isDarkTheme ? 'bg-gray-800 text-white' : 'bg-white text-black border border-gray-200'
              }`}>
                Show sidebar
              </span>
            </button>

            {/* New Interview button with adjusted margin */}
            <button
              onClick={handleNewInterviewClick}
              disabled={messages.length === 0}
              className={`mt-10 p-4 rounded transition-none group relative ${
                messages.length === 0 
                  ? 'opacity-50 cursor-not-allowed' 
                  : isDarkTheme 
                    ? 'hover:bg-dark-light' 
                    : 'hover:bg-gray-200'
              }`}
            >
              <svg
                stroke="currentColor"
                fill="none"
                strokeWidth="2"
                viewBox="0 0 24 24"
                strokeLinecap="round"
                strokeLinejoin="round"
                height="16"
                width="16"
                className={`${isDarkTheme ? 'text-current' : 'text-black'}`}
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span className={`absolute left-full ml-2 scale-0 transition-all rounded p-2 text-xs whitespace-nowrap group-hover:scale-100 ${
                isDarkTheme ? 'bg-gray-800 text-white' : 'bg-white text-black border border-gray-200'
              }`}>
                {messages.length === 0 
                  ? 'Start the interview first'
                  : 'New Interview'
                }
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Add FAQ Modal */}
      {showFAQ && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${
            isDarkTheme 
              ? 'bg-dark-light text-white' 
              : 'bg-white text-[rgb(147,0,255)]'
          } rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto translate-x-20`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium">Frequently Asked Questions</h3>
              <button
                onClick={() => setShowFAQ(false)}
                className="p-1 hover:opacity-70"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className={`font-medium mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-[rgb(147,0,255)]'}`}>1. How do I start the interview?</h4>
                <p className={`${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
                  To begin the interview, simply type hi on the chat interface. The chatbot will introduce you to the role and ask you if you're interested in continuing with the interview.
                </p>
              </div>
              
              <div>
                <h4 className={`font-medium mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-[rgb(147,0,255)]'}`}>2. What happens if I don't know the answer to a question?</h4>
                <p className={`${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
                  If you're unsure about a question, feel free to let the chatbot know. For instance, you can respond with "I'm not sure" or provide a vague answer. The chatbot will follow up with clarifying questions or move the conversation in a different direction to help guide you through.
                </p>
              </div>
              
              <div>
                <h4 className={`font-medium mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-[rgb(147,0,255)]'}`}>3. Can I skip or end the interview early?</h4>
                <p className={`${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
                  Yes! At any point during the interview, you can choose to end the conversation early. If you're not interested in continuing, simply reply with "No," and the chatbot will thank you and end the interview politely.
                </p>
              </div>
              
              <div>
                <h4 className={`font-medium mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-[rgb(147,0,255)]'}`}>4. What happens if my answer doesn't match the requirements?</h4>
                <p className={`${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
                  The chatbot may ask you to clarify your response if it doesn't meet the requirements. For example, if your desired salary is too high for the role, it will let you know and ask if you're still interested. If the role doesn't fit your preferences, it will end the conversation with a polite message.
                </p>
              </div>
              
              <div>
                <h4 className={`font-medium mb-2 ${isDarkTheme ? 'text-gray-300' : 'text-[rgb(147,0,255)]'}`}>5. Can I view or revisit past interview sessions?</h4>
                <p className={`${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
                  Absolutely! You can go back to view any past interview sessions by selecting "Past Conversations" from the sidebar. This will allow you to review your previous responses and reflect on the interview process.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Switch conversation warning */}
      {showSwitchWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${
            isDarkTheme 
              ? 'bg-dark-light text-white' 
              : 'bg-white text-black'
          } rounded-lg p-6 max-w-sm w-full mx-4`}>
            <h3 className="text-lg font-medium mb-4">Switch Conversation?</h3>
            <p className={`mb-6 ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
              Your current interview session will be paused while you review past conversations. You can return anytime to continue.
            </p>
            <div className="flex justify-end gap-3">
            <button
                onClick={() => {
                  if (pendingConversationId) {
                    switchToConversation(pendingConversationId);
                  }
                }}
                className="px-4 py-2 bg-[rgb(147,0,255)] rounded hover:opacity-90 transition-colors text-white"
              >
                Switch
              </button>
              <button
                onClick={() => {
                  setShowSwitchWarning(false);
                  setPendingConversationId(null);
                }}
                className={`px-4 py-2 rounded transition-colors ${
                  isDarkTheme 
                    ? 'hover:bg-gray-700' 
                    : 'hover:bg-gray-100'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New interview confirmation */}
      {showNewInterviewConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${
            isDarkTheme 
              ? 'bg-dark-light text-white' 
              : 'bg-white text-black'
          } rounded-lg p-6 max-w-sm w-full mx-4`}>
            <h3 className="text-lg font-medium mb-4">Start New Interview?</h3>
            <p className={`mb-6 ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
              Your current interview will end. Do you want to start a new interview?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowNewInterviewConfirm(false)}
                className={`px-4 py-2 rounded transition-colors ${
                  isDarkTheme 
                    ? 'hover:bg-gray-700' 
                    : 'hover:bg-gray-100'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowNewInterviewConfirm(false);
                  handleInitialMessage();
                }}
                className="px-4 py-2 bg-[rgb(111,12,240)] rounded hover:opacity-90 transition-colors text-white"
              >
                Start New
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}