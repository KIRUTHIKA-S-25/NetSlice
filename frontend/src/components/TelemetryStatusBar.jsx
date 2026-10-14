import React from 'react';
import { 
  Wifi, 
  WifiOff, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Activity, 
  Radio, 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  HelpCircle,
  Cpu
} from 'lucide-react';

const ProvenanceBadge = ({ status, source }) => {
  let badgeClass = 'badge-slate';
  let label = status || 'UNAVAILABLE';

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
      title={source ? `Source: ${source}` : `Status: ${status}`}
      style={{ 
        fontSize: '0.62rem', 
        padding: '2px 6px', 
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontWeight: '700'
      }}
    >
      {label}
    </span>
  );
};

const TelemetryStatusBar = ({
  telemetry = null,
  mode = 'real_network',
  activeInterface = 'Wi-Fi',
  isOnline = true,
  isRunning = false,
  enforcementStatus = 'UNCONFIGURED',
  lastSampleTime = null
}) => {
  const download = telemetry?.download_mbps;
  const upload = telemetry?.upload_mbps;
  const aggregate = telemetry?.aggregate_mbps;
  const wifi = telemetry?.wifi;
  const probe = telemetry?.probe_rtt;

  const isReal = mode === 'real_network';

  const formatRate = (rateObj) => {
    if (!isRunning || rateObj?.value === null || rateObj?.value === undefined) {
      return { val: '—', status: 'UNAVAILABLE' };
    }
    return {
      val: `${Number(rateObj.value).toFixed(2)} Mbps`,
      status: rateObj.status || 'MEASURED',
      source: rateObj.source
    };
  };

  const dl = formatRate(download);
  const ul = formatRate(upload);
  const agg = formatRate(aggregate);

  const timeStr = lastSampleTime 
    ? new Date(lastSampleTime * 1000).toLocaleTimeString() 
    : isRunning ? 'Streaming live' : 'Standby';

  const getGatewayStatusDisplay = (status) => {
    switch (status) {
      case 'ENFORCING':
        return { text: 'Active Kernel tc Verified', badge: 'badge-emerald', icon: ShieldCheck };
      case 'DRY_RUN':
        return { text: 'Dry-Run (Not Enforced)', badge: 'badge-amber', icon: ShieldAlert };
      case 'ENFORCEMENT_UNAVAILABLE_ON_HOST':
        return { text: 'Windows Host (Monitor Only)', badge: 'badge-amber', icon: ShieldAlert };
      case 'FALLBACK_VIRTUAL':
        return { text: 'Virtual Fallback (Safe)', badge: 'badge-cyan', icon: ShieldAlert };
      case 'ROLLED_BACK':
        return { text: 'Rules Purged (Clean)', badge: 'badge-slate', icon: ShieldCheck };
      case 'MONITOR_ONLY':
        return { text: 'Read-Only Monitor', badge: 'badge-cyan', icon: Activity };
      default:
        return { text: 'Unconfigured (Safe Dry-Run)', badge: 'badge-slate', icon: ShieldAlert };
    }
  };

  const gw = getGatewayStatusDisplay(enforcementStatus);
  const GwIcon = gw.icon;

  return (
    <div 
      className="glass-card" 
      style={{
        padding: '12px 18px',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        backgroundColor: 'var(--bg-card-subtle)',
        border: '1px solid var(--border-card)'
      }}
    >
      {/* 1. Operating Mode & Interface */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          backgroundColor: isReal ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isReal ? 'var(--accent-cyan)' : 'var(--accent-purple)'
        }}>
          {isReal ? <Radio size={16} /> : <Cpu size={16} />}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {isReal ? 'REAL-NETWORK TELEMETRY' : 'SYNTHETIC 5G SIMULATION'}
            </span>
            <span className={isReal ? 'badge badge-cyan' : 'badge badge-purple'} style={{ fontSize: '0.62rem' }}>
              {isReal ? 'Physical Adapter' : 'Virtual Core'}
            </span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Iface: <strong>{activeInterface}</strong></span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={11} /> {timeStr}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Measured Physical Adapter Throughput */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '14px', 
        padding: '4px 12px', 
        borderRadius: '8px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-card)'
      }}>
        {/* Download */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            <ArrowDownCircle size={11} color="var(--accent-emerald)" />
            <span>DOWNLOAD</span>
            <ProvenanceBadge status={dl.status} source={dl.source} />
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {dl.val}
          </span>
        </div>

        <div style={{ width: '1px', height: '26px', backgroundColor: 'var(--border-card)' }} />

        {/* Upload */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            <ArrowUpCircle size={11} color="var(--accent-cyan)" />
            <span>UPLOAD</span>
            <ProvenanceBadge status={ul.status} source={ul.source} />
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {ul.val}
          </span>
        </div>

        <div style={{ width: '1px', height: '26px', backgroundColor: 'var(--border-card)' }} />

        {/* Aggregate */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            <Activity size={11} color="var(--accent-purple)" />
            <span>AGGREGATE</span>
            <ProvenanceBadge status={agg.status} source={agg.source} />
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {agg.val}
          </span>
        </div>
      </div>

      {/* 3. Real Wi-Fi / Link State */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {isOnline ? <Wifi size={11} color="var(--accent-emerald)" /> : <WifiOff size={11} color="var(--accent-rose)" />}
            <span>WLAN LINK</span>
            <ProvenanceBadge status={wifi?.status || (isOnline ? 'MEASURED' : 'UNAVAILABLE')} source="netsh" />
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>
            {wifi?.ssid ? `${wifi.ssid} (${wifi.signal || 'N/A'})` : isOnline ? 'Connected' : 'Offline'}
          </span>
        </div>

        {/* Probe RTT */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            <Activity size={11} color="var(--accent-cyan)" />
            <span>PROBE RTT</span>
            <ProvenanceBadge status={probe?.status || (isOnline ? 'MEASURED' : 'UNAVAILABLE')} source="tcp_probe" />
          </div>
          <span 
            style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}
            title={probe?.target ? `Probe target: ${probe.target}` : 'Direct TCP socket handshake'}
          >
            {probe?.value !== null && probe?.value !== undefined ? `${Number(probe.value).toFixed(1)} ms` : '—'}
          </span>
        </div>
      </div>

      {/* 4. Gateway Enforcement Verification Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span 
          className={`badge ${gw.badge}`} 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '0.74rem' }}
          title={`Enforcement status: ${enforcementStatus}`}
        >
          <GwIcon size={12} />
          {gw.text}
        </span>
      </div>
    </div>
  );
};

export default TelemetryStatusBar;
