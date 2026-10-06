import React, { useState } from 'react';
import { 
  Film, 
  Gamepad2, 
  Globe, 
  RotateCcw, 
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
      setStatusMessage('Please start monitoring first before injecting test traffic.');
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
        setStatusMessage(`Active test: ${displayName}`);
        if (onTriggerScenario) onTriggerScenario(data);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage('Failed to trigger scenario');
    } finally {
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handleCustomSpike = async () => {
    if (!isRunning) {
      setStatusMessage('Please start monitoring first.');
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
      setStatusMessage('Failed to adjust traffic load');
    } finally {
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '18px 22px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ fontSize: '0.98rem', fontWeight: '600', color: 'var(--text-primary)' }}>
            Traffic Load Testing
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Simulate realistic network surges to test how dynamic allocation adapts
          </p>
        </div>

        {statusMessage && (
          <div style={{
            padding: '4px 10px',
            borderRadius: '6px',
            backgroundColor: 'var(--status-info-bg)',
            border: '1px solid rgba(2, 132, 199, 0.3)',
            color: 'var(--status-info)',
            fontSize: '0.76rem',
            fontWeight: '500'
          }}>
            {statusMessage}
          </div>
        )}
      </div>

      {/* Preset Scenario Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        
        {/* 4K Streaming */}
        <button
          className="btn-secondary"
          onClick={() => handleScenario('streaming_burst', '4K Streaming Surge (80 Mbps)')}
          style={{
            padding: '10px 12px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            borderColor: activeScenario === 'streaming_burst' ? 'var(--slice-high-bandwidth)' : undefined,
            backgroundColor: activeScenario === 'streaming_burst' ? 'rgba(124, 58, 237, 0.1)' : undefined
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--slice-high-bandwidth)' }}>
            <Film size={16} />
            <span style={{ fontWeight: '600', fontSize: '0.82rem' }}>4K Video Stream (80M)</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Heavy burst on High-Bandwidth slice.
          </span>
        </button>

        {/* Gaming & Voice */}
        <button
          className="btn-secondary"
          onClick={() => handleScenario('fleet_surge', 'Gaming & Voice Surge (45 Mbps)')}
          style={{
            padding: '10px 12px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            borderColor: activeScenario === 'fleet_surge' ? 'var(--slice-low-latency)' : undefined,
            backgroundColor: activeScenario === 'fleet_surge' ? 'var(--status-info-bg)' : undefined
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--slice-low-latency)' }}>
            <Gamepad2 size={16} />
            <span style={{ fontWeight: '600', fontSize: '0.82rem' }}>Voice / Gaming Surge (45M)</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Tests real-time packet prioritization.
          </span>
        </button>

        {/* Heavy Bulk Download */}
        <button
          className="btn-secondary"
          onClick={() => handleScenario('dos_attack', 'Bulk Web Spike (70 Mbps)')}
          style={{
            padding: '10px 12px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            borderColor: activeScenario === 'dos_attack' ? '#f87171' : undefined,
            backgroundColor: activeScenario === 'dos_attack' ? 'var(--status-danger-bg)' : undefined
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--status-danger)' }}>
            <Globe size={16} />
            <span style={{ fontWeight: '600', fontSize: '0.82rem' }}>Heavy Download Spike (70M)</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Simulates saturated background downloads.
          </span>
        </button>

        {/* Baseline */}
        <button
          className="btn-secondary"
          onClick={() => handleScenario('normal_baseline', 'Normal Traffic Baseline')}
          style={{
            padding: '10px 12px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            borderColor: activeScenario === 'normal' || activeScenario === 'normal_baseline' ? 'var(--status-success)' : undefined,
            backgroundColor: activeScenario === 'normal' || activeScenario === 'normal_baseline' ? 'var(--status-success-bg)' : undefined
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--status-success)' }}>
            <RotateCcw size={16} />
            <span style={{ fontWeight: '600', fontSize: '0.82rem' }}>Normal Activity</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Resets to standard traffic levels.
          </span>
        </button>

      </div>

      {/* Granular Spike Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        backgroundColor: 'var(--bg-card-subtle)',
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1px solid var(--border-card)',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={14} /> Custom Slice Load:
        </span>

        <select
          value={selectedSlice}
          onChange={(e) => setSelectedSlice(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-card)',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '0.78rem'
          }}
        >
          <option value="low_latency">Low-Latency (Calls & Gaming)</option>
          <option value="high_bandwidth">High-Bandwidth (Streaming)</option>
          <option value="general">Standard Traffic (Web)</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {[1.5, 2.0, 3.0].map((m) => (
            <button
              key={m}
              className="btn-secondary"
              onClick={() => setMultiplier(m)}
              style={{
                padding: '4px 8px',
                fontSize: '0.74rem',
                borderColor: multiplier === m ? 'var(--accent-primary)' : undefined,
                backgroundColor: multiplier === m ? 'var(--bg-hover)' : undefined
              }}
            >
              {m}x
            </button>
          ))}
        </div>

        <button
          className="btn-primary"
          onClick={handleCustomSpike}
          style={{ padding: '5px 12px', fontSize: '0.78rem', marginLeft: 'auto' }}
        >
          Apply Spike ({multiplier}x)
        </button>
      </div>
    </div>
  );
};

export default TrafficTweaker;
