import React, { useState, useEffect, useRef } from 'react';
import { Activity, Trash2, ArrowDownCircle, Filter } from 'lucide-react';

const tagStyles = {
  'AI-ACTION': { bg: 'rgba(2, 132, 199, 0.12)', text: '#38bdf8', border: 'rgba(2, 132, 199, 0.3)', label: 'Auto-Balanced' },
  'RULE-ENGINE': { bg: 'rgba(139, 92, 246, 0.12)', text: '#c084fc', border: 'rgba(139, 92, 246, 0.3)', label: 'Rule Shift' },
  'WARNING': { bg: 'rgba(239, 68, 68, 0.12)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)', label: 'Alert' },
  'SCENARIO': { bg: 'rgba(245, 158, 11, 0.12)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)', label: 'Load Test' },
  'CONFIG': { bg: 'rgba(16, 185, 129, 0.12)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)', label: 'Config' },
  'STATIC-ALLOC': { bg: 'rgba(99, 102, 241, 0.12)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.3)', label: 'Manual Split' },
  'ML-ENGINE': { bg: 'rgba(236, 72, 153, 0.12)', text: '#f472b6', border: 'rgba(236, 72, 153, 0.3)', label: 'Model Retrain' },
  'REAL-NET': { bg: 'rgba(16, 185, 129, 0.12)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)', label: 'Live Network' },
  'SYSTEM': { bg: 'rgba(148, 163, 184, 0.12)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.25)', label: 'System' }
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
    <div className="glass-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '20px' }}>
      
      {/* Header Bar */}
      <div style={{
        backgroundColor: '#111827',
        borderBottom: '1px solid var(--border-card)',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} color="var(--slice-low-latency)" />
          <h3 style={{ fontSize: '0.92rem', fontWeight: '600', color: '#ffffff' }}>
            Activity & System Events
          </h3>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            ({filteredLogs.length} events)
          </span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          
          {/* Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={12} color="var(--text-muted)" />
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              style={{
                backgroundColor: '#161f33',
                color: '#ffffff',
                border: '1px solid var(--border-card)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '0.74rem'
              }}
            >
              <option value="ALL">All Categories</option>
              <option value="AI-ACTION">Auto-Balanced</option>
              <option value="RULE-ENGINE">Rule Shift</option>
              <option value="WARNING">Alerts & Drops</option>
              <option value="SCENARIO">Load Tests</option>
              <option value="REAL-NET">Live Network</option>
              <option value="CONFIG">Configuration</option>
              <option value="SYSTEM">System</option>
            </select>
          </div>

          {/* Auto Scroll Toggle */}
          <button
            className="btn-secondary"
            onClick={() => setAutoScroll(!autoScroll)}
            style={{
              padding: '3px 8px',
              fontSize: '0.74rem',
              color: autoScroll ? 'var(--status-success)' : 'var(--text-muted)'
            }}
          >
            <ArrowDownCircle size={12} /> Auto-Scroll
          </button>

          {/* Clear Button */}
          <button
            className="btn-secondary"
            onClick={handleClear}
            style={{ padding: '3px 6px', fontSize: '0.74rem' }}
            title="Clear list"
          >
            <Trash2 size={12} />
          </button>

        </div>
      </div>

      {/* Events List Body */}
      <div
        ref={scrollRef}
        style={{
          backgroundColor: '#0a0d16',
          height: '210px',
          overflowY: 'auto',
          padding: '12px 18px',
          fontSize: '0.8rem',
          lineHeight: '1.5'
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '16px 0', fontSize: '0.82rem' }}>
            No recent activity recorded yet. Events will appear here as the system balances bandwidth.
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const styleMeta = tagStyles[log.level] || tagStyles['SYSTEM'];
            return (
              <div 
                key={log.id || index}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '10px',
                  padding: '5px 0',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
                }}
              >
                {/* Time */}
                <span className="terminal-font" style={{ color: '#64748b', fontSize: '0.74rem', flexShrink: 0 }}>
                  {log.datetime_str || new Date(log.timestamp * 1000).toLocaleTimeString()}
                </span>

                {/* Event Tag */}
                <span
                  style={{
                    backgroundColor: styleMeta.bg,
                    color: styleMeta.text,
                    border: `1px solid ${styleMeta.border}`,
                    borderRadius: '4px',
                    padding: '1px 6px',
                    fontSize: '0.68rem',
                    fontWeight: '500',
                    flexShrink: 0,
                    minWidth: '80px',
                    textAlign: 'center'
                  }}
                >
                  {styleMeta.label}
                </span>

                {/* Message */}
                <span style={{ color: '#e2e8f0', wordBreak: 'break-word', fontSize: '0.8rem' }}>
                  {log.message}
                </span>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default ActionTerminal;
