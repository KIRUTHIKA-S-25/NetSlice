import React from 'react';
import { Zap, Wifi, Activity, AlertCircle, CheckCircle, Video, Gamepad2, Globe } from 'lucide-react';

const sliceConfig = {
  low_latency: {
    title: 'Low-Latency Traffic',
    subtitle: 'Calls, gaming & real-time tasks',
    slaTarget: 'Target: < 15 ms latency',
    accentColor: 'var(--slice-low-latency)',
    icon: Gamepad2
  },
  high_bandwidth: {
    title: 'High-Bandwidth Traffic',
    subtitle: 'Streaming, downloads & video',
    slaTarget: 'Target: > 40 Mbps throughput',
    accentColor: 'var(--slice-high-bandwidth)',
    icon: Video
  },
  general: {
    title: 'Standard Web Traffic',
    subtitle: 'Browsing, sync & everyday apps',
    slaTarget: 'Best-effort delivery',
    accentColor: 'var(--slice-general)',
    icon: Globe
  }
};

const SliceCards = ({ metrics, allocations }) => {
  if (!metrics) {
    return (
      <div className="glass-card" style={{ padding: '28px', textAlign: 'center', marginBottom: '20px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Monitoring is currently idle. Click <strong>Start Monitoring</strong> above to stream live traffic.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '20px' }}>
      {Object.entries(metrics).map(([key, data]) => {
        const config = sliceConfig[key] || {
          title: key,
          subtitle: 'General slice',
          slaTarget: 'Standard QoS',
          accentColor: '#3b82f6',
          icon: Activity
        };

        const Icon = config.icon;
        const allocated = allocations?.[key] ?? data.allocated_bandwidth ?? 0;
        const throughput = data.throughput_mbps ?? 0;
        const utilization = data.utilization ?? 0;
        const latencyMs = data.avg_latency_ms ?? (data.avg_latency * 1000) ?? 0;
        const dropped = data.packets_dropped ?? 0;
        const processed = data.packets_processed ?? 0;

        const isUrllc = key === 'low_latency';
        const hasDrops = dropped > 0;
        const hasLatencySpike = isUrllc && latencyMs > 15;
        const isHealthy = !hasDrops && !hasLatencySpike && utilization < 90;

        return (
          <div 
            key={key} 
            className="glass-card" 
            style={{ 
              padding: '20px', 
              position: 'relative',
              borderColor: hasDrops ? 'rgba(239, 68, 68, 0.4)' : undefined
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: config.accentColor
                }}>
                  <Icon size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {config.title}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {config.subtitle}
                    </span>
                    {data.real_port && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        (Port {data.real_port})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {isHealthy ? (
                <span className="badge badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={12} /> Healthy
                </span>
              ) : hasDrops ? (
                <span className="badge badge-rose" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={12} /> Packet Drops
                </span>
              ) : (
                <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  High Load
                </span>
              )}
            </div>

            {/* Throughput & Capacity Bar */}
            <div style={{ marginBottom: '14px', backgroundColor: 'var(--bg-card-subtle)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Current Throughput</span>
                <div>
                  <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {throughput.toFixed(1)}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '3px' }}>
                    / {allocated.toFixed(0)} Mbps
                  </span>
                </div>
              </div>

              <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-card)', borderRadius: '3px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    width: `${Math.min(100, utilization)}%`, 
                    height: '100%', 
                    backgroundColor: utilization > 90 ? 'var(--status-danger)' : utilization > 75 ? 'var(--status-warning)' : config.accentColor,
                    borderRadius: '3px',
                    transition: 'width 0.4s ease'
                  }} 
                />
              </div>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              
              <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Utilization</div>
                <div style={{ 
                  fontSize: '0.95rem', 
                  fontWeight: '600', 
                  color: utilization > 90 ? 'var(--status-danger)' : utilization > 75 ? 'var(--status-warning)' : 'var(--text-primary)'
                }}>
                  {utilization.toFixed(0)}%
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Latency</div>
                <div style={{ 
                  fontSize: '0.95rem', 
                  fontWeight: '600',
                  color: hasLatencySpike ? 'var(--status-danger)' : 'var(--text-primary)'
                }}>
                  {latencyMs.toFixed(1)} ms
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Drops</div>
                <div style={{ 
                  fontSize: '0.95rem', 
                  fontWeight: '600', 
                  color: dropped > 0 ? 'var(--status-danger)' : 'var(--text-secondary)'
                }}>
                  {dropped}
                </div>
              </div>

            </div>

            {/* Target Note */}
            <div style={{ marginTop: '10px', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{config.slaTarget}</span>
              <span>{processed.toLocaleString()} pkts processed</span>
            </div>

          </div>
        );
      })}
    </div>
  );
};

export default SliceCards;
