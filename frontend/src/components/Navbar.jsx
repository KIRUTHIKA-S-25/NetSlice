import React from 'react';
import { 
  Activity, 
  Play, 
  Square, 
  RotateCw, 
  Database, 
  Cpu, 
  Layers, 
  ShieldCheck 
} from 'lucide-react';

const Navbar = ({
  isRunning,
  strategy,
  onStrategyChange,
  onStart,
  onStop,
  onRetrain,
  isRetraining,
  mlInfo,
  onOpenAnalytics,
  totalSnapshots
}) => {
  return (
    <header className="glass-card" style={{ padding: '18px 28px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        
        {/* Brand & System Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(168, 85, 247, 0.3))',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            boxShadow: 'var(--glow-cyan)'
          }}>
            <Layers size={26} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ 
                fontSize: '1.45rem', 
                fontWeight: '800', 
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #ffffff 40%, #94a3b8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                NetSlice AI Controller
              </h1>
              <span className={`badge ${isRunning ? 'badge-emerald' : 'badge-rose'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span className={`pulse-indicator ${isRunning ? '' : 'idle'}`}></span>
                {isRunning ? 'SIMULATION LIVE' : 'SYSTEM IDLE'}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>5G/6G Autonomous QoS Slicing Engine</span>
              <span>•</span>
              <span style={{ color: 'var(--accent-cyan)' }}>Total Pool: 100 Mbps</span>
              <span>•</span>
              <span style={{ color: mlInfo?.sample_count > 0 ? 'var(--accent-emerald)' : 'var(--text-dim)' }}>
                ML: {mlInfo?.status || 'DecisionTree'}
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls & Strategy Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          {/* Strategy Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(15, 23, 42, 0.8)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '8px', paddingLeft: '4px' }}>Strategy:</span>
            <select
              value={strategy}
              onChange={(e) => onStrategyChange(e.target.value)}
              disabled={isRunning}
              style={{
                background: 'transparent',
                color: 'white',
                border: 'none',
                outline: 'none',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: isRunning ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="static" style={{ background: '#0f172a', color: 'white' }}>Static Allocation</option>
              <option value="rule_based" style={{ background: '#0f172a', color: 'white' }}>Rule-Based Dynamic</option>
              <option value="ai_assisted" style={{ background: '#0f172a', color: 'white' }}>AI-Assisted (Decision Tree)</option>
            </select>
          </div>

          {/* Start / Stop Button */}
          {!isRunning ? (
            <button className="btn-primary" onClick={onStart}>
              <Play size={16} fill="white" />
              <span>Start Simulation</span>
            </button>
          ) : (
            <button className="btn-danger" onClick={onStop}>
              <Square size={16} fill="white" />
              <span>Stop</span>
            </button>
          )}

          {/* ML Retrain Button */}
          <button
            className="btn-secondary"
            onClick={onRetrain}
            disabled={isRetraining}
            title="Retrain Decision Tree models from historical SQLite records"
          >
            <Cpu size={16} color={isRetraining ? 'var(--accent-amber)' : 'var(--accent-purple)'} />
            <span>{isRetraining ? 'Retraining...' : 'Retrain AI'}</span>
          </button>

          {/* Database Analytics Button */}
          <button
            className="btn-secondary"
            onClick={onOpenAnalytics}
            title="View historical SQLite network analytics and reports"
          >
            <Database size={16} color="var(--accent-cyan)" />
            <span>SQLite Analytics ({totalSnapshots || 0})</span>
          </button>

        </div>

      </div>
    </header>
  );
};

export default Navbar;
