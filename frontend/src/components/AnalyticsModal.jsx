import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  RefreshCw, 
  Cpu, 
  Activity, 
  CheckCircle2 
} from 'lucide-react';

const AnalyticsModal = ({ isOpen, onClose, onRetrain, isRetraining }) => {
  const [summary, setSummary] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [selectedSlice, setSelectedSlice] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const sumRes = await fetch('http://localhost:8000/api/analytics/summary');
      const sumData = await sumRes.json();
      if (sumData.status === 'success') {
        setSummary(sumData.summary);
      }

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
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
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
          maxWidth: '920px',
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: '24px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-card)', paddingBottom: '14px' }}>
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
              color: 'var(--slice-low-latency)'
            }}>
              <Database size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>Network History & Recorded Metrics</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Persistent historical traffic logs and QoS performance audits
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn-secondary" onClick={fetchAnalyticsData} disabled={isLoading} style={{ padding: '5px 10px', fontSize: '0.78rem' }}>
              <RefreshCw size={13} className={isLoading ? 'spin' : ''} /> Refresh
            </button>
            <button className="btn-secondary" onClick={onClose} style={{ padding: '5px', borderRadius: '6px' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            
            <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Recorded Snapshots</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                {summary.total_records?.toLocaleString() || 0}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Packets Processed</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--status-success)' }}>
                {summary.total_packets_processed?.toLocaleString() || 0}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Dropped Packets</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: summary.total_packets_dropped > 0 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
                {summary.total_packets_dropped || 0}
                <span style={{ fontSize: '0.74rem', fontWeight: '400', color: 'var(--text-muted)', marginLeft: '4px' }}>
                  ({summary.overall_drop_rate || 0}%)
                </span>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '3px' }}>SLA Alerts</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: summary.qos_violations > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                {summary.qos_violations || 0}
              </div>
            </div>

          </div>
        )}

        {/* Per-Slice Historical Breakdown */}
        {summary?.slice_stats && Object.keys(summary.slice_stats).length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: '600', marginBottom: '10px', color: 'var(--text-primary)' }}>
              Per-Slice Average Performance
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-card-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Slice</th>
                    <th style={{ padding: '8px 12px' }}>Avg Throughput</th>
                    <th style={{ padding: '8px 12px' }}>Avg Latency</th>
                    <th style={{ padding: '8px 12px' }}>Peak Load</th>
                    <th style={{ padding: '8px 12px' }}>Total Drops</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.slice_stats).map(([sName, stat]) => (
                    <tr key={sName} style={{ borderBottom: '1px solid var(--border-card)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: '500', textTransform: 'capitalize' }}>
                        {sName.replace('_', ' ')}
                      </td>
                      <td style={{ padding: '8px 12px' }}>{stat.avg_throughput_mbps} Mbps</td>
                      <td style={{ padding: '8px 12px' }}>{stat.avg_latency_ms} ms</td>
                      <td style={{ padding: '8px 12px' }}>{stat.peak_utilization}%</td>
                      <td style={{ padding: '8px 12px', color: stat.total_dropped > 0 ? 'var(--status-danger)' : 'inherit' }}>
                        {stat.total_dropped}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Database Logs Explorer */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              Recent Snapshots
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Filter:</span>
              <select
                value={selectedSlice}
                onChange={(e) => setSelectedSlice(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-card)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.74rem'
                }}
              >
                <option value="ALL">All Slices</option>
                <option value="low_latency">Low-Latency</option>
                <option value="high_bandwidth">High-Bandwidth</option>
                <option value="general">Standard</option>
              </select>
            </div>
          </div>

          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-card)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card-subtle)' }}>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-card)' }}>
                  <th style={{ padding: '6px 10px' }}>Time</th>
                  <th style={{ padding: '6px 10px' }}>Slice</th>
                  <th style={{ padding: '6px 10px' }}>Throughput</th>
                  <th style={{ padding: '6px 10px' }}>Cap</th>
                  <th style={{ padding: '6px 10px' }}>Load</th>
                  <th style={{ padding: '6px 10px' }}>Latency</th>
                  <th style={{ padding: '6px 10px' }}>Drops</th>
                </tr>
              </thead>
              <tbody>
                {historyLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-card)' }}>
                    <td style={{ padding: '5px 10px', color: 'var(--text-muted)' }}>{log.datetime_str}</td>
                    <td style={{ padding: '5px 10px', fontWeight: '500' }}>{log.slice_name}</td>
                    <td style={{ padding: '5px 10px' }}>{log.throughput_mbps} Mbps</td>
                    <td style={{ padding: '5px 10px' }}>{log.allocated_bandwidth} Mbps</td>
                    <td style={{ padding: '5px 10px' }}>{log.utilization}%</td>
                    <td style={{ padding: '5px 10px' }}>{log.avg_latency_ms} ms</td>
                    <td style={{ padding: '5px 10px', color: log.packets_dropped > 0 ? 'var(--status-danger)' : 'inherit' }}>
                      {log.packets_dropped}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-card)' }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Database: SQLite (<code>network_logs.db</code>)
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary" onClick={onRetrain} disabled={isRetraining} style={{ fontSize: '0.8rem' }}>
              <Cpu size={13} />
              <span>{isRetraining ? 'Retraining...' : 'Retrain Model'}</span>
            </button>
            <button className="btn-primary" onClick={onClose} style={{ fontSize: '0.8rem' }}>
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AnalyticsModal;
