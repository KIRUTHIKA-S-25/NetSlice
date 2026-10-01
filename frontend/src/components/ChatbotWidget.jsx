import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  MessageSquare, 
  ChevronDown, 
  RotateCcw,
  Zap,
  Activity
} from 'lucide-react';

const quickPrompts = [
  "Why are packets dropping right now?",
  "Analyze current slice latency & SLAs",
  "Recommend optimal bandwidth allocations",
  "How does AI dynamic mode compare to Static?"
];

const ChatbotWidget = ({ isRunning, strategy, metrics }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "👋 **Hello! I'm your NetSlice AI Network Assistant.**\n\nI have direct read-access to the real-time slice telemetry and historical SQLite logs. Ask me anything about traffic spikes, QoS violations, or bandwidth reallocation suggestions!",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages, isOpen, isTyping]);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputVal.trim();
    if (!text) return;

    const userMsg = {
      sender: 'user',
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setIsTyping(true);

    try {
      const res = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      
      const botMsg = {
        sender: 'bot',
        text: data.reply || "I analyzed the system metrics, but encountered an unexpected response format.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev, 
        { 
          sender: 'bot', 
          text: "⚠️ **Connection Error:** Unable to reach the backend AI reasoning engine. Please verify the FastAPI backend server is running on port 8000.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderFormattedText = (text) => {
    // Basic Markdown formatting helper for bold, lists, and inline code
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Bold replace
      let formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Code replace
      formatted = formatted.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.85em;">$1</code>');
      
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <li key={idx} style={{ marginLeft: '16px', marginBottom: '4px' }} dangerouslySetInnerHTML={{ __html: formatted.substring(2) }} />
        );
      }
      return (
        <p key={idx} style={{ margin: line ? '4px 0' : '8px 0', minHeight: line ? 'auto' : '8px' }} dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    });
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '28px',
            right: '28px',
            zIndex: 900,
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0ea5e9, #a855f7)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 30px rgba(14, 165, 233, 0.45)',
            transition: 'transform 0.25s ease, box-shadow 0.25s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 12px 35px rgba(168, 85, 247, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(14, 165, 233, 0.45)';
          }}
          title="Open AI Network Slicing Assistant"
        >
          <Bot size={28} />
          {/* Pulsing online badge */}
          <span style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: '#10b981',
            border: '2px solid #090d16'
          }} />
        </button>
      )}

      {/* Expanded Chat Window */}
      {isOpen && (
        <div 
          className="glass-card" 
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '390px',
            height: '560px',
            maxHeight: 'calc(100vh - 48px)',
            zIndex: 950,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            overflow: 'hidden',
            background: 'rgba(15, 23, 42, 0.94)'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(168, 85, 247, 0.25))',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0ea5e9, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                <Bot size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'white' }}>NetSlice AI Assistant</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: '#34d399' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }} />
                  Telemetry & DB Context Active
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="btn-secondary"
              style={{ padding: '5px', borderRadius: '6px', border: 'none', background: 'transparent' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Body */}
          <div 
            ref={messagesEndRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {messages.map((m, idx) => (
              <div 
                key={idx}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%'
                }}
              >
                <div style={{
                  padding: '10px 14px',
                  borderRadius: m.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: m.sender === 'user' 
                    ? 'linear-gradient(135deg, #0284c7, #4f46e5)' 
                    : 'rgba(30, 41, 59, 0.85)',
                  border: m.sender === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'white',
                  fontSize: '0.83rem',
                  lineHeight: '1.45',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}>
                  {renderFormattedText(m.text)}
                </div>
                <div style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-dim)',
                  marginTop: '3px',
                  textAlign: m.sender === 'user' ? 'right' : 'left',
                  padding: '0 4px'
                }}>
                  {m.time}
                </div>
              </div>
            ))}

            {isTyping && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(30, 41, 59, 0.7)', borderRadius: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <Sparkles size={14} className="spin" color="var(--accent-cyan)" />
                <span>AI analyzing telemetry & logs...</span>
              </div>
            )}
          </div>

          {/* Quick Prompts Carousel */}
          <div style={{
            padding: '8px 12px',
            background: 'rgba(10, 15, 29, 0.8)',
            borderTop: '1px solid var(--border-subtle)',
            overflowX: 'auto',
            display: 'flex',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}>
            {quickPrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(p)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '4px 10px',
                  color: 'var(--text-muted)',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div style={{
            padding: '12px 14px',
            background: 'rgba(15, 23, 42, 0.95)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <input
              type="text"
              placeholder="Ask about latency, drops, allocations..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              style={{
                flex: 1,
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: 'white',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputVal.trim() || isTyping}
              className="btn-primary"
              style={{ padding: '8px 12px', borderRadius: '8px' }}
            >
              <Send size={15} />
            </button>
          </div>

        </div>
      )}
    </>
  );
};

export default ChatbotWidget;
