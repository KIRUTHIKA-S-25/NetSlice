import React, { useState, useEffect } from 'react';
import { Sliders, Check, RotateCcw } from 'lucide-react';

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
        setFeedbackMsg('Allocations updated successfully.');
        if (onSaveAllocations) onSaveAllocations(data.allocations);
      }
    } catch (err) {
      console.error(err);
      setFeedbackMsg('Failed to update allocations.');
    } finally {
      setIsApplying(false);
      setTimeout(() => setFeedbackMsg(null), 3000);
    }
  };

  const applyPreset = (ll, hb, gen) => {
    setAllocations({ low_latency: ll, high_bandwidth: hb, general: gen });
  };

  return (
    <div className="glass-card" style={{ padding: '18px 22px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '0.98rem', fontWeight: '600', color: '#ffffff' }}>
            Bandwidth Allocation
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {isStaticStrategy 
              ? 'Manually split your 100 Mbps connection between traffic types'
              : 'Active policy is set to Dynamic Auto-Balance. Switch to "Manual" in the header to lock these custom caps.'}
          </p>
        </div>

        {/* Total & Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            padding: '5px 10px',
            borderRadius: '6px',
            backgroundColor: Math.abs(currentTotal - 100) < 0.1 ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
            border: `1px solid ${Math.abs(currentTotal - 100) < 0.1 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            fontSize: '0.8rem',
            fontWeight: '600',
            color: Math.abs(currentTotal - 100) < 0.1 ? 'var(--status-success)' : 'var(--status-danger)'
          }}>
            Total: {currentTotal.toFixed(0)} / 100 Mbps
          </div>

          {Math.abs(currentTotal - 100) >= 0.1 && (
            <button className="btn-secondary" onClick={handleAutoNormalize} style={{ padding: '5px 10px', fontSize: '0.78rem' }}>
              <RotateCcw size={13} /> Auto-Balance (100M)
            </button>
          )}

          <button 
            className="btn-primary" 
            onClick={handleApply} 
            disabled={isApplying}
            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
          >
            <Check size={14} />
            <span>{isApplying ? 'Saving...' : 'Apply Allocation'}</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div style={{
          padding: '7px 12px',
          borderRadius: '6px',
          backgroundColor: 'var(--status-info-bg)',
          border: '1px solid rgba(2, 132, 199, 0.3)',
          color: '#38bdf8',
          fontSize: '0.8rem',
          marginBottom: '12px'
        }}>
          {feedbackMsg}
        </div>
      )}

      {/* Sliders Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '14px' }}>
        
        {/* Low-Latency */}
        <div style={{ backgroundColor: '#0c101c', padding: '12px 14px', borderRadius: '8px', border: '1px solid #1e2638' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '500', color: 'var(--slice-low-latency)' }}>Calls & Gaming</span>
            <span style={{ fontSize: '0.88rem', fontWeight: '600' }}>{allocations.low_latency} Mbps</span>
          </div>
          <input
            type="range"
            min="5"
            max="80"
            step="1"
            value={allocations.low_latency}
            onChange={(e) => handleSliderChange('low_latency', e.target.value)}
            style={{ width: '100%', accentColor: 'var(--slice-low-latency)', cursor: 'pointer' }}
          />
        </div>

        {/* High-Bandwidth */}
        <div style={{ backgroundColor: '#0c101c', padding: '12px 14px', borderRadius: '8px', border: '1px solid #1e2638' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '500', color: 'var(--slice-high-bandwidth)' }}>Streaming & Video</span>
            <span style={{ fontSize: '0.88rem', fontWeight: '600' }}>{allocations.high_bandwidth} Mbps</span>
          </div>
          <input
            type="range"
            min="5"
            max="85"
            step="1"
            value={allocations.high_bandwidth}
            onChange={(e) => handleSliderChange('high_bandwidth', e.target.value)}
            style={{ width: '100%', accentColor: 'var(--slice-high-bandwidth)', cursor: 'pointer' }}
          />
        </div>

        {/* General */}
        <div style={{ backgroundColor: '#0c101c', padding: '12px 14px', borderRadius: '8px', border: '1px solid #1e2638' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '500', color: 'var(--slice-general)' }}>General Web & Sync</span>
            <span style={{ fontSize: '0.88rem', fontWeight: '600' }}>{allocations.general} Mbps</span>
          </div>
          <input
            type="range"
            min="5"
            max="60"
            step="1"
            value={allocations.general}
            onChange={(e) => handleSliderChange('general', e.target.value)}
            style={{ width: '100%', accentColor: 'var(--slice-general)', cursor: 'pointer' }}
          />
        </div>

      </div>

      {/* Human Presets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Quick Presets:</span>
        <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.74rem' }} onClick={() => applyPreset(30, 50, 20)}>
          Balanced (30 / 50 / 20)
        </button>
        <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.74rem' }} onClick={() => applyPreset(20, 65, 15)}>
          Streaming Focus (20 / 65 / 15)
        </button>
        <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.74rem' }} onClick={() => applyPreset(50, 35, 15)}>
          Low-Latency Focus (50 / 35 / 15)
        </button>
        <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.74rem' }} onClick={() => applyPreset(34, 33, 33)}>
          Equal Split (34 / 33 / 33)
        </button>
      </div>
    </div>
  );
};

export default StaticSliders;
