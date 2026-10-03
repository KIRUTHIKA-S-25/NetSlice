import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  RefreshCw, 
  Cpu, 
  ShieldAlert, 
  Activity, 
  CheckCircle2, 
  TrendingUp 
} from 'lucide-react';

const AnalyticsModal = ({ isOpen, onClose, onRetrain, isRetraining }) => {
  const [summary, setSummary] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [selectedSlice, setSelectedSlice] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      // Fetch summary
      const sumRes = await fetch('http://localhost:8000/api/analytics/summary');
      const sumData = await sumRes.json();
      if (sumData.status === 'success') {
        setSummary(sumData.summary);
      }

      // Fetch history table
      const url = selectedSlice === 'ALL' 
        ? 'http://localhost:8000/api/history?limit=30' 
        : `http://localhost:8000/api/history?limit=30&slice_name=${selectedSlice}`;
      const histRes = await fetch(url);
      const histData = await histRes.json();
      if (histData.status === 'success') {
        setHistoryLogs(histData.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAnalyticsData();
    }
  }, [isOpen, selectedSlice]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div 
        className="glass-card" 
        style={{
          width: '100%',
          maxWidth: '960px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '28px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)'
            }}>
              <Database size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>SQLite Network Analytics & Reporting Engine</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Persistent historical logs used for QoS audit reporting & AI Decision Tree training
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="btn-secondary" onClick={fetchAnalyticsData} disabled={isLoading} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <RefreshCw size={14} className={isLoading ? 'spin' : ''} /> Refresh
            </button>
            <button className="btn-secondary" onClick={onClose} style={{ padding: '6px', borderRadius: '8px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Summary KPI Cards */}
        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Total SQLite Snapshots</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--accent-cyan)' }}>
                {summary.total_records?.toLocaleString() || 0}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Packets Processed</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--accent-emerald)' }}>
                {summary.total_packets_processed?.toLocaleString() || 0}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Dropped Packets</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: summary.total_packets_dropped > 0 ? 'var(--accent-rose)' : 'var(--text-main)' }}>
                {summary.total_packets_dropped || 0}
                <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-dim)', marginLeft: '6px' }}>
                  ({summary.overall_drop_rate || 0}%)
                </span>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>QoS SLA Violations</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: summary.qos_violations > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
                {summary.qos_violations || 0}
              </div>
            </div>

          </div>
        )}

        {/* Per-Slice Historical Breakdown */}
        {summary?.slice_stats && Object.keys(summary.slice_stats).length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} color="var(--accent-purple)" /> Per-Slice Historical Performance
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Slice Name</th>
                    <th style={{ padding: '10px 14px' }}>Avg Throughput</th>
                    <th style={{ padding: '10px 14px' }}>Avg Latency</th>
                    <th style={{ padding: '10px 14px' }}>Peak Utilization</th>
                    <th style={{ padding: '10px 14px' }}>Total Drops</th>
                    <th style={{ padding: '10px 14px' }}>Stored Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.slice_stats).map(([sName, stat]) => (
                    <tr key={sName} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: '600', textTransform: 'capitalize' }}>
                        {sName.replace('_', ' ')}
                      </td>
                      <td style={{ padding: '10px 14px' }}>{stat.avg_throughput_mbps} Mbps</td>
                      <td style={{ padding: '10px 14px' }}>{stat.avg_latency_ms} ms</td>
                      <td style={{ padding: '10px 14px' }}>{stat.peak_utilization}%</td>
                      <td style={{ padding: '10px 14px', color: stat.total_dropped > 0 ? 'var(--accent-rose)' : 'inherit' }}>
                        {stat.total_dropped}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-dim)' }}>{stat.sample_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Database Historical Logs Explorer */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={16} color="var(--accent-cyan)" /> Recent Telemetry Snapshots in `network_logs`
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Filter Slice:</span>
              <select
                value={selectedSlice}
                onChange={(e) => setSelectedSlice(e.target.value)}
                style={{
                  background: 'var(--bg-dark)',
                  color: 'white',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.75rem'
                }}
              >
                <option value="ALL">All Slices</option>
                <option value="low_latency">Low-Latency</option>
                <option value="high_bandwidth">High-Bandwidth</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#0a0f1d' }}>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '8px 12px' }}>Timestamp</th>
                  <th style={{ padding: '8px 12px' }}>Slice</th>
                  <th style={{ padding: '8px 12px' }}>Throughput</th>
                  <th style={{ padding: '8px 12px' }}>Capacity</th>
                  <th style={{ padding: '8px 12px' }}>Util %</th>
                  <th style={{ padding: '8px 12px' }}>Latency</th>
                  <th style={{ padding: '8px 12px' }}>Drops</th>
                  <th style={{ padding: '8px 12px' }}>Strategy</th>
                </tr>
              </thead>
              <tbody>
                {historyLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '6px 12px', color: 'var(--text-dim)' }}>{log.datetime_str}</td>
                    <td style={{ padding: '6px 12px', fontWeight: '600' }}>{log.slice_name}</td>
                    <td style={{ padding: '6px 12px' }}>{log.throughput_mbps} Mbps</td>
                    <td style={{ padding: '6px 12px' }}>{log.allocated_bandwidth} Mbps</td>
                    <td style={{ padding: '6px 12px', color: log.utilization > 90 ? 'var(--accent-rose)' : 'inherit' }}>
                      {log.utilization}%
                    </td>
                    <td style={{ padding: '6px 12px' }}>{log.avg_latency_ms} ms</td>
                    <td style={{ padding: '6px 12px', color: log.packets_dropped > 0 ? 'var(--accent-rose)' : 'inherit' }}>
                      {log.packets_dropped}
                    </td>
                    <td style={{ padding: '6px 12px', textTransform: 'capitalize' }}>{log.strategy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer with ML Retrain Action */}
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Stored in <code>backend/network_logs.db</code> (SQLite via SQLAlchemy)
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-secondary" onClick={onRetrain} disabled={isRetraining}>
              <Cpu size={14} color="var(--accent-purple)" />
              <span>{isRetraining ? 'Retraining...' : 'Retrain ML Engine Now'}</span>
            </button>
            <button className="btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AnalyticsModal;
