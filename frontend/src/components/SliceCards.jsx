import React from 'react';
import { Zap, Wifi, Activity, AlertTriangle, ShieldCheck, ArrowUpRight } from 'lucide-react';

const sliceMetadata = {
  low_latency: {
    displayName: 'Low-Latency Slice',
    category: 'URLLC (Critical Telemetry)',
    sla: 'Latency < 15 ms',
    color: 'var(--accent-cyan)',
    glow: 'var(--glow-cyan)',
    badgeClass: 'badge-cyan',
    icon: Zap
  },
  high_bandwidth: {
    displayName: 'High-Bandwidth Slice',
    category: 'eMBB (Video & AR/VR)',
    sla: 'Throughput > 40 Mbps',
    color: 'var(--accent-purple)',
    glow: 'var(--glow-purple)',
    badgeClass: 'badge-purple',
    icon: Activity
  },
  general: {
    displayName: 'General-Purpose Slice',
    category: 'mMTC (Smart Sensors & IoT)',
    sla: 'Best-Effort Delivery',
    color: 'var(--accent-emerald)',
    glow: 'var(--glow-emerald)',
    badgeClass: 'badge-emerald',
    icon: Wifi
  }
};

const SliceCards = ({ metrics, allocations }) => {
  if (!metrics) {
    return (
      <div className="glass-card" style={{ padding: '36px', textAlign: 'center', marginBottom: '24px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Simulation is currently stopped. Click <strong>Start Simulation</strong> above to stream live telemetry.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '24px' }}>
      {Object.entries(metrics).map(([key, data]) => {
        const meta = sliceMetadata[key] || {
          displayName: key,
          category: 'Standard Slice',
          sla: 'Standard SLA',
          color: 'var(--accent-blue)',
          glow: 'none',
          badgeClass: 'badge-cyan',
          icon: Wifi
        };

        const Icon = meta.icon;
        const allocated = allocations?.[key] ?? data.allocated_bandwidth ?? 0;
        const throughput = data.throughput_mbps ?? 0;
        const utilization = data.utilization ?? 0;
        const latencyMs = data.avg_latency_ms ?? (data.avg_latency * 1000) ?? 0;
        const dropped = data.packets_dropped ?? 0;
        const processed = data.packets_processed ?? 0;

        // SLA Evaluation
        const isUrllc = key === 'low_latency';
        const isSlaViolated = (isUrllc && latencyMs > 15) || dropped > 0;
        const isCongested = utilization > 90;

        return (
          <div 
            key={key} 
            className="glass-card" 
            style={{ 
              padding: '24px', 
              position: 'relative',
              overflow: 'hidden',
              borderColor: isSlaViolated ? 'rgba(244, 63, 94, 0.4)' : undefined,
              boxShadow: isSlaViolated ? '0 0 20px rgba(244, 63, 94, 0.2)' : undefined
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${meta.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: meta.color,
                  boxShadow: meta.glow
                }}>
                  <Icon size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    {meta.displayName}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {meta.category}
                  </span>
                </div>
              </div>

              <span className={`badge ${isSlaViolated ? 'badge-rose' : 'badge-emerald'}`}>
                {isSlaViolated ? 'SLA VIOLATION' : 'SLA HEALTHY'}
              </span>
            </div>

            {/* Throughput & Bandwidth Meter */}
            <div style={{ marginBottom: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Throughput / Cap</span>
                <div>
                  <span style={{ fontSize: '1.3rem', fontWeight: '800', color: meta.color }}>
                    {throughput.toFixed(2)}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                    / {allocated.toFixed(1)} Mbps
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    width: `${Math.min(100, utilization)}%`, 
                    height: '100%', 
                    background: utilization > 90 ? 'var(--accent-rose)' : utilization > 75 ? 'var(--accent-amber)' : meta.color,
                    borderRadius: '4px',
                    transition: 'width 0.5s ease, background 0.3s ease'
                  }} 
                />
              </div>
            </div>

            {/* Key Telemetry Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              
              {/* Utilization */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Utilization</div>
                <div style={{ 
                  fontSize: '1.05rem', 
                  fontWeight: '700', 
                  color: utilization > 90 ? 'var(--accent-rose)' : utilization > 75 ? 'var(--accent-amber)' : 'var(--accent-emerald)'
                }}>
                  {utilization.toFixed(1)}%
                </div>
              </div>

              {/* Avg Latency */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Latency</div>
                <div style={{ 
                  fontSize: '1.05rem', 
                  fontWeight: '700',
                  color: isUrllc && latencyMs > 15 ? 'var(--accent-rose)' : 'var(--text-main)'
                }}>
                  {latencyMs.toFixed(2)} ms
                </div>
              </div>

              {/* Packets Processed */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Packets Processed</div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)' }}>
                  {processed.toLocaleString()}
                </div>
              </div>

              {/* Packets Dropped */}
              <div style={{ 
                background: dropped > 0 ? 'rgba(244, 63, 94, 0.1)' : 'rgba(255,255,255,0.02)', 
                padding: '10px', 
                borderRadius: '8px', 
                border: dropped > 0 ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid var(--border-subtle)' 
              }}>
                <div style={{ fontSize: '0.72rem', color: dropped > 0 ? 'var(--accent-rose)' : 'var(--text-muted)', marginBottom: '2px' }}>
                  Dropped Packets
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '700', color: dropped > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                  {dropped}
                </div>
              </div>

            </div>

            {/* SLA Target Note */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              <span>Target: {meta.sla}</span>
              {dropped > 0 && (
                <span style={{ color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={12} /> Buffer Overflow
                </span>
              )}
            </div>

          </div>
        );
      })}
    </div>
  );
};

export default SliceCards;
