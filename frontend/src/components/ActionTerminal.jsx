import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, ArrowDownCircle, Shield, Filter } from 'lucide-react';

const levelColors = {
  'AI-ACTION': { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.4)' },
  'RULE-ENGINE': { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.4)' },
  'WARNING': { bg: 'rgba(244, 63, 94, 0.15)', text: '#fb7185', border: 'rgba(244, 63, 94, 0.4)' },
  'SCENARIO': { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.4)' },
  'CONFIG': { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.4)' },
  'STATIC-ALLOC': { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.4)' },
  'ML-ENGINE': { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6', border: 'rgba(236, 72, 153, 0.4)' },
  'SYSTEM': { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' }
};

const ActionTerminal = ({ logs = [] }) => {
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [localLogs, setLocalLogs] = useState(logs);
  const scrollRef = useRef(null);

  useEffect(() => {
    setLocalLogs(logs);
  }, [logs]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localLogs, autoScroll]);

  const filteredLogs = localLogs.filter((log) => {
    if (filterLevel === 'ALL') return true;
    return log.level === filterLevel;
  });

  const handleClear = () => {
    setLocalLogs([]);
  };

  return (
    <div className="glass-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '24px' }}>
      
      {/* Terminal Title Bar */}
      <div style={{
        background: 'rgba(10, 15, 29, 0.95)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Terminal Window Controls */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={16} color="var(--accent-cyan)" />
            <span className="terminal-font" style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '0.04em' }}>
              RESOURCE_ALLOCATION_ENGINE // LIVE_ACTION_LOGS
            </span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          
          {/* Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={13} color="var(--text-dim)" />
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '0.75rem'
              }}
            >
              <option value="ALL">All Events</option>
              <option value="AI-ACTION">AI-Action</option>
              <option value="RULE-ENGINE">Rule-Engine</option>
              <option value="WARNING">Warnings</option>
              <option value="SCENARIO">Chaos Scenarios</option>
              <option value="CONFIG">Config</option>
              <option value="ML-ENGINE">ML Retraining</option>
              <option value="SYSTEM">System</option>
            </select>
          </div>

          {/* Auto Scroll Toggle */}
          <button
            className="btn-secondary"
            onClick={() => setAutoScroll(!autoScroll)}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderColor: autoScroll ? 'var(--accent-emerald)' : undefined,
              color: autoScroll ? 'var(--accent-emerald)' : 'var(--text-muted)'
            }}
          >
            <ArrowDownCircle size={13} /> Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>

          {/* Clear Button */}
          <button
            className="btn-secondary"
            onClick={handleClear}
            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
            title="Clear terminal view"
          >
            <Trash2 size={13} />
          </button>

        </div>
      </div>

      {/* Terminal Output Window */}
      <div
        ref={scrollRef}
        className="terminal-font"
        style={{
          background: '#070b14',
          height: '240px',
          overflowY: 'auto',
          padding: '16px 20px',
          fontSize: '0.8rem',
          lineHeight: '1.6',
          color: '#e2e8f0'
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ color: '#475569', fontStyle: 'italic', padding: '20px 0' }}>
            &gt; Waiting for allocation engine events and slice telemetry shifts...
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const styleMeta = levelColors[log.level] || levelColors['SYSTEM'];
            return (
              <div 
                key={log.id || index}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '4px 0',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
                }}
              >
                {/* Timestamp */}
                <span style={{ color: '#64748b', flexShrink: 0, userSelect: 'none' }}>
                  [{log.datetime_str || new Date(log.timestamp * 1000).toLocaleTimeString()}]
                </span>

                {/* Level Tag */}
                <span
                  style={{
                    background: styleMeta.bg,
                    color: styleMeta.text,
                    border: `1px solid ${styleMeta.border}`,
                    borderRadius: '4px',
                    padding: '1px 6px',
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    flexShrink: 0,
                    minWidth: '85px',
                    textAlign: 'center'
                  }}
                >
                  {log.level}
                </span>

                {/* Message */}
                <span style={{ color: '#f1f5f9', wordBreak: 'break-word' }}>
                  {log.message}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Terminal Footer */}
      <div style={{
        background: 'rgba(10, 15, 29, 0.8)',
        padding: '6px 20px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.72rem',
        color: 'var(--text-dim)'
      }}>
        <span>● STREAM STATUS: ACTIVE</span>
        <span>EVENTS RECORDED: {filteredLogs.length}</span>
      </div>

    </div>
  );
};

export default ActionTerminal;
