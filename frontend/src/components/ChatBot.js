// =============================================================================
// ChatBot.js - AI-Powered Floating Chat Assistant
// =============================================================================
// This component renders a floating chat button in the bottom-right corner
// of every page. When clicked, it opens a chat window powered by OpenAI
// GPT-4o via the backend /api/ai/chat endpoint.
//
// Key features:
//   - Floating orange button that pulses to attract attention
//   - Full chat window with message history
//   - Improved typing indicator: "Baba is typing..." text with animated dots
//   - Conversation memory via session ID (backend stores history in MongoDB)
//   - Auto-scrolls to latest message
//   - Send on Enter key or click the send button
//   - Assistant avatar shown next to AI messages
//
// How AI memory works:
//   - A session ID is generated on first message
//   - Backend stores all messages in MongoDB under that session ID
//   - Each new message sends the session ID so backend can retrieve history
//   - GPT-4o receives full conversation history for contextual responses
// =============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';
import axios from 'axios';

// Backend API URL from environment variables
const API = process.env.REACT_APP_BACKEND_URL;

export default function ChatBot() {
  // isOpen: controls whether the chat window is visible or collapsed to button
  const [isOpen, setIsOpen] = useState(false);

  // messages: array of all chat messages in the conversation
  // Each message has: { role: 'user' | 'assistant', content: string }
  // Initialised with the AI's greeting message
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Salaam! Welcome to Baba Falooda! I'm Baba, your dessert guide. Ask me anything about our menu or get personalised recommendations!"
    }
  ]);

  // input: the text currently typed in the input field
  const [input, setInput] = useState('');

  // loading: true while waiting for the AI response
  // Shows the "Baba is typing..." indicator
  const [loading, setLoading] = useState(false);

  // sessionId: unique identifier for this conversation
  // Empty string initially - set by backend on first message
  // Sent with every subsequent message so backend can retrieve history
  const [sessionId, setSessionId] = useState('');

  // messagesEndRef: reference to an invisible div at the bottom of the messages list
  // Used to auto-scroll to the latest message
  const messagesEndRef = useRef(null);

  // =============================================================================
  // AUTO-SCROLL TO LATEST MESSAGE
  // =============================================================================
  // Runs whenever the messages array or loading state changes
  // scrollIntoView smoothly scrolls the messages container to show the latest message

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // =============================================================================
  // SEND MESSAGE FUNCTION
  // =============================================================================

  const sendMessage = async () => {
    // Prevent sending empty messages or sending while already loading
    if (!input.trim() || loading) return;

    const userMsg = input.trim();

    // Clear the input field immediately for better UX
    setInput('');

    // Add the user's message to the chat immediately (optimistic update)
    // User sees their message instantly without waiting for the API response
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    setLoading(true); // Show typing indicator

    try {
      // Send message to backend AI chat endpoint
      // Include session ID so backend can retrieve conversation history
      const { data } = await axios.post(`${API}/api/ai/chat`, {
        message: userMsg,
        session_id: sessionId  // Empty string for first message, UUID for subsequent
      });

      // Store the session ID returned by backend for future messages
      // On first message, backend generates a new UUID session ID
      setSessionId(data.session_id);

      // Add the AI's response to the chat
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);

    } catch {
      // Show friendly error message if the API call fails
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I'm having a moment! Please try again."
      }]);
    } finally {
      // Always hide the loading indicator when done
      setLoading(false);
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <>
      {/* ================================================================
          FLOATING CHAT BUTTON
          Shown when chat window is closed. Pulses with CSS animation
          to draw user attention. Disappears when chat is open.
          ================================================================ */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-8 right-8 z-[9999] w-14 h-14 rounded-full bg-[#FF6B00] hover:bg-[#FF8C00] text-white flex items-center justify-center shadow-lg animate-pulse-glow transition-all duration-300 hover:scale-110"
          data-testid="chatbot-toggle-btn"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* ================================================================
          CHAT WINDOW
          Full chat interface shown when isOpen is true.
          Fixed position, responsive width with max constraints.
          ================================================================ */}
      {isOpen && (
        <div
          className="fixed bottom-8 right-8 z-[9999] w-[360px] max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl overflow-hidden border border-black/10 shadow-2xl bg-white"
          data-testid="chatbot-window"
        >
          {/* ---- CHAT HEADER ---- */}
          {/* Orange header bar with title, online indicator and close button */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#FF6B00]">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-white" />
              <span className="font-heading text-white text-sm">Baba AI Assistant</span>
              {/* Green dot showing the AI is online and ready */}
              <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
            </div>
            {/* Close button collapses chat back to floating button */}
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white"
              data-testid="chatbot-close-btn"
            >
              <X size={18} />
            </button>
          </div>

          {/* ---- MESSAGES AREA ---- */}
          {/* Scrollable container for all chat messages */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FFF8F0]"
            data-testid="chatbot-messages"
          >
            {/* Render each message with different styling for user vs assistant */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`chat-bubble flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Assistant avatar shown next to AI messages */}
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-[#FF6B00] flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                    <Sparkles size={12} className="text-white" />
                  </div>
                )}

                <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === 'user'
                    // User messages: orange bubble on the right, no bottom-right radius
                    ? 'bg-[#FF6B00] text-white rounded-br-none'
                    // Assistant messages: white bubble on the left, no bottom-left radius
                    : 'bg-white text-[#1a1a1a] border border-black/5 rounded-bl-none shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* ================================================================
                IMPROVED TYPING INDICATOR
                Shows "Baba is typing..." text alongside animated bouncing dots.
                Much more informative and friendly than dots alone.
                ================================================================ */}
            {loading && (
              <div className="flex justify-start items-center gap-2">
                {/* Assistant avatar shown next to typing indicator */}
                <div className="w-7 h-7 rounded-full bg-[#FF6B00] flex items-center justify-center flex-shrink-0">
                  <Sparkles size={12} className="text-white" />
                </div>

                <div className="bg-white border border-black/5 px-4 py-2.5 rounded-xl rounded-bl-none shadow-sm">
                  <div className="flex items-center gap-2">
                    {/* "Baba is typing..." italic text */}
                    <span className="text-[#999] text-xs italic">Baba is typing</span>
                    {/* Three bouncing dots with staggered animation delays for wave effect */}
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-[#FF6B00] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-[#FF6B00] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-[#FF6B00] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Invisible div at the bottom - scrolled into view when new messages arrive */}
            <div ref={messagesEndRef} />
          </div>

          {/* ---- INPUT AREA ---- */}
          {/* Text input and send button at the bottom of the chat window */}
          <div className="p-3 border-t border-black/5 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                // Allow sending message by pressing Enter key
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask Baba anything..."
                className="flex-1 bg-[#FFF8F0] border border-black/10 rounded-full px-4 py-2 text-sm text-[#1a1a1a] placeholder-[#aaa] focus:outline-none focus:border-[#FF6B00]/50"
                data-testid="chatbot-input"
              />
              {/* Send button - disabled when loading or input is empty */}
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="w-9 h-9 rounded-full bg-[#FF6B00] hover:bg-[#FF8C00] text-white flex items-center justify-center disabled:opacity-50 transition-all"
                data-testid="chatbot-send-btn"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}