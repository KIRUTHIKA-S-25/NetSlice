import React, { useState } from 'react';
import { 
  Zap, 
  Film, 
  Car, 
  ShieldAlert, 
  RotateCcw, 
  Flame, 
  TrendingUp, 
  Activity 
} from 'lucide-react';

const TrafficTweaker = ({ isRunning, onTriggerScenario }) => {
  const [selectedSlice, setSelectedSlice] = useState('high_bandwidth');
  const [multiplier, setMultiplier] = useState(2.0);
  const [statusMessage, setStatusMessage] = useState(null);
  const [activeScenario, setActiveScenario] = useState('normal');

  const handleScenario = async (scenarioName, displayName) => {
    if (!isRunning) {
      setStatusMessage('Please start the simulation first to inject traffic scenarios.');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    try {
      const res = await fetch('http://localhost:8000/api/simulate_scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioName })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setActiveScenario(scenarioName);
        setStatusMessage(`Active Scenario: ${displayName}`);
        if (onTriggerScenario) onTriggerScenario(data);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage('Failed to trigger scenario');
    } finally {
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleCustomSpike = async () => {
    if (!isRunning) {
      setStatusMessage('Please start the simulation first to inject traffic spikes.');
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    try {
      const res = await fetch('http://localhost:8000/api/simulate_spike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slice_name: selectedSlice,
          multiplier: Number(multiplier)
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setStatusMessage(data.message);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage('Failed to spike traffic');
    } finally {
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '22px 26px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ color: 'var(--accent-amber)' }}>
            <Flame size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700' }}>
              Traffic Profile Tweaker & Chaos Engine
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Inject realistic traffic surges and attack scenarios to benchmark dynamic reallocation response
            </p>
          </div>
        </div>

        {statusMessage && (
          <div style={{
            padding: '5px 12px',
            borderRadius: '6px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: 'var(--accent-amber)',
            fontSize: '0.78rem',
            fontWeight: '600'
          }}>
            {statusMessage}
          </div>
        )}
      </div>

      {/* Preset Scenario Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        
        {/* DoS Attack */}
        <button
          className="btn-secondary"
          onClick={() => handleScenario('dos_attack', 'Simulated DoS Attack (70 Mbps Flood)')}
          style={{
            padding: '12px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            borderColor: activeScenario === 'dos_attack' ? 'var(--accent-rose)' : undefined,
            background: activeScenario === 'dos_attack' ? 'rgba(244, 63, 94, 0.15)' : undefined
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-rose)' }}>
            <ShieldAlert size={18} />
            <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>Simulate DoS Attack</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Floods General slice with 70 Mbps malicious traffic to test isolation.
          </span>
        </button>

        {/* 4K Video Burst */}
        <button
          className="btn-secondary"
          onClick={() => handleScenario('streaming_burst', '4K Ultra-HD Video Burst (80 Mbps)')}
          style={{
            padding: '12px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            borderColor: activeScenario === 'streaming_burst' ? 'var(--accent-purple)' : undefined,
            background: activeScenario === 'streaming_burst' ? 'rgba(168, 85, 247, 0.15)' : undefined
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-purple)' }}>
            <Film size={18} />
            <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>Start 4K Streaming Burst</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Surges High-Bandwidth slice to 80 Mbps to simulate video streaming spikes.
          </span>
        </button>

        {/* Autonomous Vehicle Surge */}
        <button
          className="btn-secondary"
          onClick={() => handleScenario('fleet_surge', 'Autonomous Fleet Surge (45 Mbps URLLC)')}
          style={{
            padding: '12px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            borderColor: activeScenario === 'fleet_surge' ? 'var(--accent-cyan)' : undefined,
            background: activeScenario === 'fleet_surge' ? 'rgba(56, 189, 248, 0.15)' : undefined
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
            <Car size={18} />
            <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>Autonomous Fleet Surge</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Spikes Low-Latency slice to 45 Mbps to test critical URLLC SLA defense.
          </span>
        </button>

        {/* Reset Baseline */}
        <button
          className="btn-secondary"
          onClick={() => handleScenario('normal_baseline', 'Baseline Traffic')}
          style={{
            padding: '12px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            borderColor: activeScenario === 'normal' || activeScenario === 'normal_baseline' ? 'var(--accent-emerald)' : undefined,
            background: activeScenario === 'normal' || activeScenario === 'normal_baseline' ? 'rgba(16, 185, 129, 0.15)' : undefined
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-emerald)' }}>
            <RotateCcw size={18} />
            <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>Reset Baseline</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Restores standard baseline demands (LL: 10M, HB: 30M, Gen: 10M).
          </span>
        </button>

      </div>

      {/* Granular Slice Spiker */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(0,0,0,0.25)',
        padding: '12px 16px',
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <TrendingUp size={16} color="var(--accent-cyan)" /> Granular Slice Spiker:
        </span>

        <select
          value={selectedSlice}
          onChange={(e) => setSelectedSlice(e.target.value)}
          style={{
            background: 'var(--bg-dark)',
            color: 'white',
            border: '1px solid var(--border-subtle)',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '0.8rem'
          }}
        >
          <option value="low_latency">Low-Latency Slice</option>
          <option value="high_bandwidth">High-Bandwidth Slice</option>
          <option value="general">General-Purpose Slice</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Multiplier:</span>
          {[1.5, 2.0, 2.5, 3.5].map((m) => (
            <button
              key={m}
              className="btn-secondary"
              onClick={() => setMultiplier(m)}
              style={{
                padding: '4px 8px',
                fontSize: '0.75rem',
                borderColor: multiplier === m ? 'var(--accent-cyan)' : undefined,
                background: multiplier === m ? 'rgba(56, 189, 248, 0.2)' : undefined
              }}
            >
              {m}x
            </button>
          ))}
        </div>

        <button
          className="btn-primary"
          onClick={handleCustomSpike}
          style={{ padding: '6px 14px', fontSize: '0.8rem', marginLeft: 'auto' }}
        >
          <Flame size={14} /> Inject Spike ({multiplier}x)
        </button>
      </div>
    </div>
  );
};

export default TrafficTweaker;
