import React from 'react';
import { 
  WifiOff, 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Video, 
  Gamepad2, 
  Globe, 
  ShieldCheck, 
  ShieldAlert,
  Clock,
  Layers
} from 'lucide-react';

const sliceConfig = {
  low_latency: {
    title: 'Low-Latency Traffic',
    subtitle: 'URLLC • Gaming, Calls & C2 Telemetry',
    slaTarget: 'Target: < 15 ms latency',
    accentColor: 'var(--slice-low-latency)',
    icon: Gamepad2
  },
  high_bandwidth: {
    title: 'High-Bandwidth Traffic',
    subtitle: 'eMBB • 4K Video, Streaming & Large Downloads',
    slaTarget: 'Target: > 40 Mbps throughput',
    accentColor: 'var(--slice-high-bandwidth)',
    icon: Video
  },
  general: {
    title: 'Standard Web Traffic',
    subtitle: 'mMTC • IoT Sensors, Browsing & Background',
    slaTarget: 'Best-effort delivery',
    accentColor: 'var(--slice-general)',
    icon: Globe
  }
};

const ProvenanceTag = ({ status, source }) => {
  let badgeClass = 'badge-slate';
  const label = status || 'UNAVAILABLE';

  if (status === 'MEASURED') {
    badgeClass = 'badge-emerald';
  } else if (status === 'ESTIMATED') {
    badgeClass = 'badge-cyan';
  } else if (status === 'SIMULATED') {
    badgeClass = 'badge-indigo';
  } else if (status === 'UNAVAILABLE') {
    badgeClass = 'badge-amber';
  }

  return (
    <span 
      className={`badge ${badgeClass}`} 
      title={source ? `Provenance: ${source}` : `Status: ${status}`}
      style={{ 
        fontSize: '0.6rem', 
        padding: '1px 5px', 
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontWeight: '700'
      }}
    >
      {label}
    </span>
  );
};

const SliceCards = ({ 
  metrics, 
  allocations = {}, 
  enforcedAllocations = {}, 
  enforcementStatus = 'UNCONFIGURED',
  isOnline = true,
  isRunning = false
}) => {
  if (!metrics) {
    return (
      <div className="glass-card" style={{ padding: '28px', textAlign: 'center', marginBottom: '20px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Monitoring is currently idle. Click <strong>Start Monitoring</strong> above to stream live telemetry.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '16px', marginBottom: '20px' }}>
      {Object.entries(metrics).map(([key, data]) => {
        const config = sliceConfig[key] || {
          title: key,
          subtitle: 'General slice',
          slaTarget: 'Standard QoS',
          accentColor: '#3b82f6',
          icon: Activity
        };

        const Icon = config.icon;
        const configuredAlloc = allocations?.[key] ?? data.allocated_bandwidth ?? 0;
        const enforcedAlloc = enforcedAllocations?.[key];
        const isEnforced = (enforcementStatus === 'ENFORCING' && enforcedAlloc !== undefined);

        const throughput = data.throughput_mbps ?? 0;
        const utilization = data.utilization ?? 0;
        const latencyMs = (data.avg_latency_ms !== null && data.avg_latency_ms !== undefined) 
          ? data.avg_latency_ms 
          : (data.avg_latency !== null && data.avg_latency !== undefined ? data.avg_latency * 1000 : null);
        const dropped = data.packets_dropped ?? 0;
        const processed = data.packets_processed ?? 0;

        const prov = data.provenance || {};
        const tpProv = prov.throughput || { status: isRunning ? 'ESTIMATED' : 'UNAVAILABLE' };
        const latProv = prov.latency || { status: isRunning ? 'ESTIMATED' : 'UNAVAILABLE' };
        const dropProv = prov.drops || { status: isRunning ? 'SIMULATED' : 'UNAVAILABLE' };

        const isUrllc = key === 'low_latency';
        const hasDrops = dropped > 0;
        const hasLatencySpike = isUrllc && latencyMs !== null && latencyMs > 15;

        // Truthful QoS Status determination
        let qosBadge = null;
        if (!isRunning) {
          qosBadge = (
            <span className="badge badge-slate" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={11} /> Waiting for data
            </span>
          );
        } else if (!isOnline) {
          qosBadge = (
            <span className="badge badge-rose" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <WifiOff size={11} /> Offline
            </span>
          );
        } else if (hasDrops) {
          qosBadge = (
            <span className="badge badge-rose" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={11} /> Shaper Deficit
            </span>
          );
        } else if (hasLatencySpike) {
          qosBadge = (
            <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              High Latency
            </span>
          );
        } else if (utilization > 85) {
          qosBadge = (
            <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              High Load
            </span>
          );
        } else {
          qosBadge = (
            <span className="badge badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={11} /> Optimal
            </span>
          );
        }

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
                  <h3 style={{ fontSize: '0.96rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {config.title}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
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

              {qosBadge}
            </div>

            {/* Throughput & Capacity Bar */}
            <div style={{ marginBottom: '14px', backgroundColor: 'var(--bg-card-subtle)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    Throughput
                  </span>
                  <ProvenanceTag status={tpProv.status} source={tpProv.source} />
                </div>
                <div>
                  <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {isRunning ? throughput.toFixed(1) : '0.0'}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '3px' }}>
                    / {configuredAlloc.toFixed(0)} Mbps
                  </span>
                </div>
              </div>

              <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-card)', borderRadius: '3px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    width: `${Math.min(100, isRunning ? utilization : 0)}%`, 
                    height: '100%', 
                    backgroundColor: utilization > 90 ? 'var(--status-danger)' : utilization > 75 ? 'var(--status-warning)' : config.accentColor,
                    borderRadius: '3px',
                    transition: 'width 0.4s ease'
                  }} 
                />
              </div>

              {/* Allocation Detail Breakdown */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <span>Configured: <strong>{configuredAlloc.toFixed(0)}M</strong></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isEnforced ? (
                    <span style={{ color: 'var(--accent-emerald)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <ShieldCheck size={11} /> Enforced: {enforcedAlloc.toFixed(0)}M
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <ShieldAlert size={11} /> Not Enforced (Dry-Run)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              
              {/* Utilization */}
              <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Utilization</span>
                  <ProvenanceTag status={tpProv.status} source={tpProv.source} />
                </div>
                <div style={{ 
                  fontSize: '0.92rem', 
                  fontWeight: '700', 
                  color: utilization > 90 ? 'var(--status-danger)' : utilization > 75 ? 'var(--status-warning)' : 'var(--text-primary)'
                }}>
                  {isRunning ? `${utilization.toFixed(0)}%` : '—'}
                </div>
              </div>

              {/* Latency */}
              <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Latency</span>
                  <ProvenanceTag status={latProv.status} source={latProv.source} />
                </div>
                <div style={{ 
                  fontSize: '0.92rem', 
                  fontWeight: '700',
                  color: !isOnline ? 'var(--text-muted)' : (hasLatencySpike ? 'var(--status-danger)' : 'var(--text-primary)')
                }}>
                  {isRunning && latencyMs !== null && latencyMs !== undefined 
                    ? `${latencyMs.toFixed(1)} ms` 
                    : isRunning ? 'Measuring...' : '—'}
                </div>
              </div>

              {/* Shaper Drops / Deficit */}
              <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Shaper Drops</span>
                  <ProvenanceTag status={dropProv.status} source={dropProv.source} />
                </div>
                <div style={{ 
                  fontSize: '0.92rem', 
                  fontWeight: '700', 
                  color: dropped > 0 ? 'var(--status-danger)' : 'var(--text-secondary)'
                }}>
                  {isRunning ? dropped : '—'}
                </div>
              </div>

            </div>

            {/* Target Note */}
            <div style={{ marginTop: '10px', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{config.slaTarget}</span>
              <span>{isRunning ? `${processed.toLocaleString()} pkts processed` : 'Standby'}</span>
            </div>

          </div>
        );
      })}
    </div>
  );
};

export default SliceCards;
