import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  MessageSquare, 
  Sparkles,
  HelpCircle,
  Wifi
} from 'lucide-react';

const promptChips = [
  "How is my Wi-Fi performing?",
  "Are any slices dropping packets?",
  "What is the best bandwidth split?",
  "Difference between Dynamic and Manual"
];

const ChatbotWidget = ({ isRunning, strategy, metrics }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "👋 **Hi there! I'm your NetSlice assistant.**\n\nI monitor your connection in real-time. I can help diagnose connection spikes, check latency targets, or recommend how to allocate bandwidth for calls, streaming, and downloads.",
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
        text: data.reply || "I analyzed the current metrics. Everything looks balanced right now.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev, 
        { 
          sender: 'bot', 
          text: "I couldn't reach the backend server. Please verify the application server is running.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderFormattedText = (text) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      formatted = formatted.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.85em;">$1</code>');
      
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <li key={idx} style={{ marginLeft: '14px', marginBottom: '3px' }} dangerouslySetInnerHTML={{ __html: formatted.substring(2) }} />
        );
      }
      return (
        <p key={idx} style={{ margin: line ? '4px 0' : '6px 0', minHeight: line ? 'auto' : '6px' }} dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    });
  };

  return (
    <>
      {/* Floating Toggle Pill */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 900,
            padding: '10px 16px',
            borderRadius: '9999px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
            transition: 'background-color 0.15s ease, transform 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#334155'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
          title="Open Network Assistant"
        >
          <MessageSquare size={17} color="#38bdf8" />
          <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Network Assistant</span>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--status-success)'
          }} />
        </button>
      )}

      {/* Slide-out/Modal Chat Window */}
      {isOpen && (
        <div 
          className="glass-card" 
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '380px',
            height: '540px',
            maxHeight: 'calc(100vh - 48px)',
            zIndex: 950,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
            border: '1px solid #374151',
            overflow: 'hidden',
            backgroundColor: '#111827'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#161f33',
            borderBottom: '1px solid var(--border-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                backgroundColor: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8'
              }}>
                <MessageSquare size={16} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '600', color: '#ffffff' }}>Network Assistant</h4>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  Connected to active telemetry
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="btn-secondary"
              style={{ padding: '4px', borderRadius: '4px', border: 'none', background: 'transparent' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Body */}
          <div 
            ref={messagesEndRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              backgroundColor: '#0b0f19'
            }}
          >
            {messages.map((m, idx) => (
              <div 
                key={idx}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%'
                }}
              >
                <div style={{
                  padding: '9px 12px',
                  borderRadius: m.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  backgroundColor: m.sender === 'user' ? 'var(--accent-primary)' : '#161f33',
                  border: m.sender === 'user' ? 'none' : '1px solid #1f2937',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  lineHeight: '1.45'
                }}>
                  {renderFormattedText(m.text)}
                </div>
                <div style={{
                  fontSize: '0.66rem',
                  color: 'var(--text-muted)',
                  marginTop: '2px',
                  textAlign: m.sender === 'user' ? 'right' : 'left',
                  padding: '0 4px'
                }}>
                  {m.time}
                </div>
              </div>
            ))}

            {isTyping && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', backgroundColor: '#161f33', borderRadius: '8px', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                <span>Analyzing network state...</span>
              </div>
            )}
          </div>

          {/* Quick Questions */}
          <div style={{
            padding: '6px 10px',
            backgroundColor: '#111827',
            borderTop: '1px solid var(--border-card)',
            overflowX: 'auto',
            display: 'flex',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}>
            {promptChips.map((chip, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(chip)}
                style={{
                  backgroundColor: '#161f33',
                  border: '1px solid #1f2937',
                  borderRadius: '12px',
                  padding: '3px 9px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.borderColor = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = '#1f2937';
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <div style={{
            padding: '10px 12px',
            backgroundColor: '#111827',
            borderTop: '1px solid var(--border-card)',
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
                backgroundColor: '#0b0f19',
                border: '1px solid var(--border-card)',
                borderRadius: '6px',
                padding: '7px 10px',
                color: '#ffffff',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputVal.trim() || isTyping}
              className="btn-primary"
              style={{ padding: '7px 12px', borderRadius: '6px' }}
            >
              <Send size={14} />
            </button>
          </div>

        </div>
      )}
    </>
  );
};

export default ChatbotWidget;
