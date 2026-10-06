import React from 'react';
import { 
  Activity, 
  Play, 
  Square, 
  RotateCw, 
  Database, 
  Cpu, 
  Layers, 
  ShieldCheck,
  Radio,
  Wifi
} from 'lucide-react';

const Navbar = ({
  isRunning,
  strategy,
  onStrategyChange,
  mode = 'simulation',
  onModeChange,
  activeInterface = 'Wi-Fi',
  onInterfaceChange,
  interfaces = [],
  onStart,
  onStop,
  onRetrain,
  isRetraining,
  mlInfo,
  onOpenAnalytics,
  totalSnapshots
}) => {
  const currentIfaceObj = interfaces.find(i => i.name === activeInterface) || interfaces[0];

  return (
    <header className="glass-card" style={{ padding: '18px 28px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        
        {/* Brand & System Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: mode === 'real_network'
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(56, 189, 248, 0.35))'
              : 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(168, 85, 247, 0.3))',
            border: `1px solid ${mode === 'real_network' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(56, 189, 248, 0.4)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: mode === 'real_network' ? 'var(--accent-emerald)' : 'var(--accent-cyan)',
            boxShadow: mode === 'real_network' ? 'var(--glow-emerald)' : 'var(--glow-cyan)'
          }}>
            {mode === 'real_network' ? <Radio size={26} /> : <Layers size={26} />}
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
                {isRunning ? (mode === 'real_network' ? 'REAL NETWORK LIVE' : 'SIMULATION LIVE') : 'SYSTEM IDLE'}
              </span>

              {mode === 'real_network' && (
                <span className="badge badge-cyan" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Wifi size={12} />
                  {currentIfaceObj ? `${currentIfaceObj.name} (${currentIfaceObj.ip})` : 'Wi-Fi (10.57.56.13)'}
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>5G/6G Autonomous QoS Slicing</span>
              <span>•</span>
              <span style={{ color: mode === 'real_network' ? 'var(--accent-emerald)' : 'var(--accent-cyan)' }}>
                Mode: {mode === 'real_network' ? 'Real Network (Wi-Fi / Sockets)' : 'Synthetic Simulation'}
              </span>
              <span>•</span>
              <span style={{ color: 'var(--accent-cyan)' }}>Pool: 100 Mbps</span>
              <span>•</span>
              <span style={{ color: mlInfo?.sample_count > 0 ? 'var(--accent-emerald)' : 'var(--text-dim)' }}>
                ML: {mlInfo?.status || 'DecisionTree'}
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls & Strategy Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          {/* Operational Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(15, 23, 42, 0.8)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '6px' }}>Mode:</span>
            <select
              value={mode}
              onChange={(e) => onModeChange && onModeChange(e.target.value)}
              disabled={isRunning}
              style={{
                background: 'transparent',
                color: mode === 'real_network' ? 'var(--accent-emerald)' : 'var(--accent-cyan)',
                border: 'none',
                outline: 'none',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: isRunning ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="real_network" style={{ background: '#0f172a', color: '#34d399' }}>Real Network (Wi-Fi)</option>
              <option value="simulation" style={{ background: '#0f172a', color: '#38bdf8' }}>Synthetic Simulation</option>
            </select>
          </div>

          {/* Interface Selector (Shown when in Real Network mode) */}
          {mode === 'real_network' && interfaces.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(15, 23, 42, 0.8)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '6px' }}>NIC:</span>
              <select
                value={activeInterface}
                onChange={(e) => onInterfaceChange && onInterfaceChange(e.target.value)}
                disabled={isRunning}
                style={{
                  background: 'transparent',
                  color: 'white',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: isRunning ? 'not-allowed' : 'pointer'
                }}
              >
                {interfaces.map(iface => (
                  <option key={iface.name} value={iface.name} style={{ background: '#0f172a', color: 'white' }}>
                    {iface.name} ({iface.ip})
                  </option>
                ))}
              </select>
            </div>
          )}

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
              <span>Start {mode === 'real_network' ? 'Live Network' : 'Simulation'}</span>
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
