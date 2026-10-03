import React, { useState, useEffect } from 'react';
import { Sliders, Check, RotateCcw, Sparkles } from 'lucide-react';

const StaticSliders = ({ activeAllocations, onSaveAllocations, isStaticStrategy }) => {
  const [allocations, setAllocations] = useState({
    low_latency: 30,
    high_bandwidth: 50,
    general: 20
  });
  const [isApplying, setIsApplying] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  useEffect(() => {
    if (activeAllocations) {
      setAllocations({
        low_latency: activeAllocations.low_latency ?? 30,
        high_bandwidth: activeAllocations.high_bandwidth ?? 50,
        general: activeAllocations.general ?? 20
      });
    }
  }, [activeAllocations]);

  const currentTotal = allocations.low_latency + allocations.high_bandwidth + allocations.general;

  const handleSliderChange = (sliceKey, newVal) => {
    setAllocations(prev => ({
      ...prev,
      [sliceKey]: Number(newVal)
    }));
  };

  const handleAutoNormalize = () => {
    const total = allocations.low_latency + allocations.high_bandwidth + allocations.general;
    if (total <= 0) return;
    const factor = 100 / total;
    const ll = Math.round(allocations.low_latency * factor);
    const hb = Math.round(allocations.high_bandwidth * factor);
    const gen = 100 - ll - hb;
    setAllocations({ low_latency: ll, high_bandwidth: hb, general: gen });
  };

  const handleApply = async () => {
    setIsApplying(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('http://localhost:8000/api/slices/configure_static', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          low_latency: allocations.low_latency,
          high_bandwidth: allocations.high_bandwidth,
          general: allocations.general
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setFeedbackMsg('Allocations applied to 100 Mbps pool!');
        if (onSaveAllocations) onSaveAllocations(data.allocations);
      }
    } catch (err) {
      console.error(err);
      setFeedbackMsg('Failed to update allocations');
    } finally {
      setIsApplying(false);
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  const applyPreset = (ll, hb, gen) => {
    setAllocations({ low_latency: ll, high_bandwidth: hb, general: gen });
  };

  return (
    <div className="glass-card" style={{ padding: '22px 26px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ color: 'var(--accent-purple)' }}>
            <Sliders size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700' }}>
              Interactive Bandwidth Allocation Pool (100 Mbps)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {isStaticStrategy 
                ? 'Active in Static Mode: Drag sliders to manually partition slice bandwidth'
                : 'Note: Currently running under Dynamic Strategy. Switch to "Static" in header to lock manual allocations.'}
            </p>
          </div>
        </div>

        {/* Sum Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            padding: '6px 14px',
            borderRadius: '8px',
            background: Math.abs(currentTotal - 100) < 0.1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            border: `1px solid ${Math.abs(currentTotal - 100) < 0.1 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.4)'}`,
            fontSize: '0.85rem',
            fontWeight: '700',
            color: Math.abs(currentTotal - 100) < 0.1 ? 'var(--accent-emerald)' : 'var(--accent-rose)'
          }}>
            Total Pool: {currentTotal.toFixed(1)} / 100 Mbps
          </div>

          {Math.abs(currentTotal - 100) >= 0.1 && (
            <button className="btn-secondary" onClick={handleAutoNormalize} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <RotateCcw size={14} /> Auto-Balance (100M)
            </button>
          )}

          <button 
            className="btn-primary" 
            onClick={handleApply} 
            disabled={isApplying}
            style={{ padding: '7px 16px', fontSize: '0.85rem' }}
          >
            <Check size={16} />
            <span>{isApplying ? 'Applying...' : 'Apply Allocation'}</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div style={{
          padding: '8px 14px',
          borderRadius: '8px',
          background: 'rgba(56, 189, 248, 0.15)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          color: 'var(--accent-cyan)',
          fontSize: '0.8rem',
          marginBottom: '14px'
        }}>
          {feedbackMsg}
        </div>
      )}

      {/* Sliders Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '16px' }}>
        
        {/* Low-Latency Slider */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--accent-cyan)' }}>Low-Latency (URLLC)</span>
            <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{allocations.low_latency} Mbps</span>
          </div>
          <input
            type="range"
            min="5"
            max="80"
            step="1"
            value={allocations.low_latency}
            onChange={(e) => handleSliderChange('low_latency', e.target.value)}
            style={{ width: '100%', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            <span>Min: 5 Mbps</span>
            <span>Max: 80 Mbps</span>
          </div>
        </div>

        {/* High-Bandwidth Slider */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--accent-purple)' }}>High-Bandwidth (eMBB)</span>
            <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{allocations.high_bandwidth} Mbps</span>
          </div>
          <input
            type="range"
            min="5"
            max="85"
            step="1"
            value={allocations.high_bandwidth}
            onChange={(e) => handleSliderChange('high_bandwidth', e.target.value)}
            style={{ width: '100%', accentColor: 'var(--accent-purple)', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            <span>Min: 5 Mbps</span>
            <span>Max: 85 Mbps</span>
          </div>
        </div>

        {/* General-Purpose Slider */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--accent-emerald)' }}>General-Purpose (mMTC)</span>
            <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{allocations.general} Mbps</span>
          </div>
          <input
            type="range"
            min="5"
            max="60"
            step="1"
            value={allocations.general}
            onChange={(e) => handleSliderChange('general', e.target.value)}
            style={{ width: '100%', accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            <span>Min: 5 Mbps</span>
            <span>Max: 60 Mbps</span>
          </div>
        </div>

      </div>

      {/* Quick Presets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quick Presets:</span>
        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => applyPreset(30, 50, 20)}>
          Standard Baseline (30/50/20)
        </button>
        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => applyPreset(50, 35, 15)}>
          Critical Telemetry Heavy (50/35/15)
        </button>
        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => applyPreset(20, 65, 15)}>
          Media & Streaming Heavy (20/65/15)
        </button>
        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => applyPreset(34, 33, 33)}>
          Equal Split (34/33/33)
        </button>
      </div>
    </div>
  );
};

export default StaticSliders;
