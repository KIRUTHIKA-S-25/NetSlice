import React from 'react';
import { 
  Play, 
  Square, 
  RotateCw, 
  Database, 
  Cpu, 
  Wifi,
  WifiOff,
  Sliders,
  CheckCircle2,
  BarChart3
} from 'lucide-react';

const Navbar = ({
  isRunning,
  isOnline = true,
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
  onOpenProtocols,
  onOpenExperiments,
  totalSnapshots
}) => {
  // Accurately resolve active Wi-Fi interface and SSID
  const currentIfaceObj = interfaces.find(i => i.wifi_details?.is_connected && i.wifi_details?.ssid)
    || interfaces.find(i => i.wifi_details?.ssid)
    || interfaces.find(i => i.name === activeInterface && i.wifi_details)
    || interfaces.find(i => i.name === activeInterface)
    || interfaces[0];

  const activeSsid = isOnline ? (currentIfaceObj?.wifi_details?.ssid || null) : null;
  const activeSignal = isOnline ? (currentIfaceObj?.wifi_details?.signal || '0%') : '0%';

  return (
    <header className="glass-card" style={{ padding: '16px 24px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand & Connection State */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)'
          }}>
            <Sliders size={20} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                NetSlice
              </h1>
              <span className={`badge ${!isOnline ? 'badge-rose' : (isRunning ? 'badge-emerald' : 'badge-slate')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className={`pulse-indicator ${!isOnline ? 'idle' : (isRunning ? '' : 'idle')}`}></span>
                {!isOnline ? 'Network Disconnected' : (isRunning ? 'Live Monitoring' : 'Paused')}
              </span>

              {mode === 'real_network' && (
                <span className={`badge ${isOnline && activeSsid ? 'badge-cyan' : 'badge-rose'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {isOnline && activeSsid ? <Wifi size={13} /> : <WifiOff size={13} />}
                  {isOnline && activeSsid 
                    ? `Wi-Fi: "${activeSsid}" (${activeSignal})`
                    : 'Wi-Fi: Disconnected'}
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
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-card-subtle)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginRight: '6px' }}>Mode:</span>
            <select
              value={mode === 'real_network' ? 'real_network_monitor' : mode}
              onChange={(e) => onModeChange && onModeChange(e.target.value)}
              disabled={isRunning}
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                border: 'none',
                outline: 'none',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: isRunning ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="simulation" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>1. Simulation Mode</option>
              <option value="real_network_monitor" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>2. Real-Network Monitoring</option>
              <option value="real_network_enforce" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>3. Real-Network Enforcement</option>
            </select>
          </div>

          {/* Allocation Strategy */}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-card-subtle)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginRight: '6px' }}>Balancing:</span>
            <select
              value={strategy}
              onChange={(e) => onStrategyChange(e.target.value)}
              disabled={isRunning}
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
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
              <option value="white" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Clean White (Porcelain)</option>
              <option value="warm" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Warm White (Alabaster)</option>
              <option value="slate" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Midnight Slate</option>
              <option value="charcoal" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Charcoal Zinc</option>
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

          {/* Protocols & ML Suite Modal */}
          <button
            className="btn-secondary"
            onClick={onOpenProtocols}
            title="DHCP, DNS, Multicast & ML Suite"
            style={{ backgroundColor: 'rgba(6, 182, 212, 0.15)', borderColor: 'rgba(6, 182, 212, 0.3)', color: '#22d3ee' }}
          >
            <Wifi size={14} />
            <span>Protocols & ML</span>
          </button>

          {/* Fair Benchmark & QoS Evaluation Modal */}
          <button
            className="btn-secondary"
            onClick={onOpenExperiments}
            title="Fair 3-Strategy Evaluation & QoS Application Profiles"
            style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.35)', color: '#818cf8', fontWeight: 600 }}
          >
            <BarChart3 size={14} />
            <span>Benchmark & QoS</span>
          </button>

        </div>

      </div>
    </header>
  );
};

export default Navbar;
