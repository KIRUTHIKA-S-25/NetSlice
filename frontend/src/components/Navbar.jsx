import React from 'react';
import { 
  Play, 
  Square, 
  RotateCw, 
  Database, 
  Cpu, 
  Wifi,
  Sliders,
  CheckCircle2
} from 'lucide-react';

const Navbar = ({
  isRunning,
  strategy,
  onStrategyChange,
  mode = 'real_network',
  onModeChange,
  theme = 'slate',
  onThemeChange,
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
    <header className="glass-card" style={{ padding: '16px 24px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand & Connection State */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8'
          }}>
            <Sliders size={20} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.02em', color: '#ffffff' }}>
                NetSlice
              </h1>
              <span className={`badge ${isRunning ? 'badge-emerald' : 'badge-rose'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className={`pulse-indicator ${isRunning ? '' : 'idle'}`}></span>
                {isRunning ? 'Live Monitoring' : 'Paused'}
              </span>

              {mode === 'real_network' && (
                <span className="badge badge-cyan" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Wifi size={13} />
                  {currentIfaceObj?.wifi_details?.ssid 
                    ? `Wi-Fi: "${currentIfaceObj.wifi_details.ssid}" (${currentIfaceObj.wifi_details.signal || '96%'})`
                    : 'Wi-Fi: "Magic"'}
                </span>
              )}
            </div>
            
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Adaptive bandwidth manager</span>
              <span>•</span>
              <span>Capacity: 100 Mbps</span>
              {mlInfo?.sample_count > 0 && (
                <>
                  <span>•</span>
                  <span style={{ color: 'var(--status-success)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <CheckCircle2 size={12} /> Model trained ({mlInfo.sample_count} samples)
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Controls Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Operational Mode */}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#161f33', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginRight: '6px' }}>Source:</span>
            <select
              value={mode}
              onChange={(e) => onModeChange && onModeChange(e.target.value)}
              disabled={isRunning}
              style={{
                background: 'transparent',
                color: '#ffffff',
                border: 'none',
                outline: 'none',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: isRunning ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="real_network" style={{ background: '#111827', color: '#ffffff' }}>Live Network (Wi-Fi)</option>
              <option value="simulation" style={{ background: '#111827', color: '#ffffff' }}>Simulation Sandbox</option>
            </select>
          </div>

          {/* Allocation Strategy */}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#161f33', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginRight: '6px' }}>Balancing:</span>
            <select
              value={strategy}
              onChange={(e) => onStrategyChange(e.target.value)}
              disabled={isRunning}
              style={{
                background: 'transparent',
                color: '#ffffff',
                border: 'none',
                outline: 'none',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: isRunning ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="ai_assisted" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>AI Auto-Balance (Dynamic)</option>
              <option value="rule_based" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Rule-Based (Thresholds)</option>
              <option value="static" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Manual Allocation</option>
            </select>
          </div>

          {/* Theme Selector */}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-card-subtle)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginRight: '6px' }}>Theme:</span>
            <select
              value={theme}
              onChange={(e) => onThemeChange && onThemeChange(e.target.value)}
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                border: 'none',
                outline: 'none',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <option value="slate" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Midnight Slate</option>
              <option value="charcoal" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Charcoal Zinc</option>
              <option value="ocean" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Ocean Navy</option>
              <option value="light" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Executive Light</option>
            </select>
          </div>

          {/* Start / Stop Monitoring Button */}
          {!isRunning ? (
            <button className="btn-primary" onClick={onStart}>
              <Play size={14} fill="currentColor" />
              <span>Start Monitoring</span>
            </button>
          ) : (
            <button className="btn-danger" onClick={onStop}>
              <Square size={14} fill="currentColor" />
              <span>Stop</span>
            </button>
          )}

          {/* Retrain Model Button */}
          <button
            className="btn-secondary"
            onClick={onRetrain}
            disabled={isRetraining}
            title="Retrain model on recorded traffic patterns"
          >
            <Cpu size={14} color={isRetraining ? 'var(--status-warning)' : 'inherit'} />
            <span>{isRetraining ? 'Retraining...' : 'Retrain Model'}</span>
          </button>

          {/* History & Analytics Modal */}
          <button
            className="btn-secondary"
            onClick={onOpenAnalytics}
            title="View database history"
          >
            <Database size={14} />
            <span>History ({totalSnapshots || 0})</span>
          </button>

        </div>

      </div>
    </header>
  );
};

export default Navbar;
