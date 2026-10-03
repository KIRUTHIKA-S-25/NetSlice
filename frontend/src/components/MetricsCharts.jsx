import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine
} from 'recharts';
import { BarChart3, TrendingUp, Clock, AlertCircle } from 'lucide-react';

const CustomTooltip = ({ active, payload, label, metricType }) => {
  if (active && payload && payload.length) {
    const timeFormatted = typeof label === 'number' 
      ? new Date(label * 1000).toLocaleTimeString() 
      : label;

    return (
      <div style={{
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '8px',
        padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        fontSize: '0.8rem'
      }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '500' }}>
          Time: {timeFormatted}
        </div>
        {payload.map((entry, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', margin: '3px 0' }}>
            <span style={{ color: entry.color, fontWeight: '600' }}>{entry.name}:</span>
            <span style={{ fontWeight: '700', color: 'white' }}>
              {entry.value} {metricType === 'throughput' ? 'Mbps' : metricType === 'latency' ? 'ms' : metricType === 'utilization' ? '%' : 'pkts'}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const MetricsCharts = ({ history }) => {
  const [metricType, setMetricType] = useState('throughput'); // 'throughput' | 'latency' | 'utilization' | 'drops'

  // Format data points for Recharts
  const chartData = (history || []).map((snapshot) => {
    const slices = snapshot.slices || {};
    const timeLabel = new Date(snapshot.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return {
      timestamp: snapshot.timestamp,
      timeLabel: timeLabel,
      
      // Throughput
      ll_throughput: Number((slices.low_latency?.throughput_mbps || 0).toFixed(2)),
      hb_throughput: Number((slices.high_bandwidth?.throughput_mbps || 0).toFixed(2)),
      gen_throughput: Number((slices.general?.throughput_mbps || 0).toFixed(2)),

      // Latency in ms
      ll_latency: Number(((slices.low_latency?.avg_latency_ms || (slices.low_latency?.avg_latency || 0) * 1000)).toFixed(2)),
      hb_latency: Number(((slices.high_bandwidth?.avg_latency_ms || (slices.high_bandwidth?.avg_latency || 0) * 1000)).toFixed(2)),
      gen_latency: Number(((slices.general?.avg_latency_ms || (slices.general?.avg_latency || 0) * 1000)).toFixed(2)),

      // Utilization
      ll_util: Number((slices.low_latency?.utilization || 0).toFixed(1)),
      hb_util: Number((slices.high_bandwidth?.utilization || 0).toFixed(1)),
      gen_util: Number((slices.general?.utilization || 0).toFixed(1)),

      // Drops
      ll_drops: slices.low_latency?.packets_dropped || 0,
      hb_drops: slices.high_bandwidth?.packets_dropped || 0,
      gen_drops: slices.general?.packets_dropped || 0
    };
  });

  return (
    <div className="glass-card" style={{ padding: '22px 26px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ color: 'var(--accent-cyan)' }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700' }}>
              Real-Time Time-Series Telemetry (Last 60 Seconds)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Moving live window tracking dynamic load adaptations across all slices
            </p>
          </div>
        </div>

        {/* Metric Selector Tabs */}
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <button
            className="btn-secondary"
            onClick={() => setMetricType('throughput')}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              borderColor: metricType === 'throughput' ? 'var(--accent-cyan)' : 'transparent',
              background: metricType === 'throughput' ? 'rgba(56, 189, 248, 0.2)' : 'transparent'
            }}
          >
            Throughput (Mbps)
          </button>
          <button
            className="btn-secondary"
            onClick={() => setMetricType('latency')}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              borderColor: metricType === 'latency' ? 'var(--accent-cyan)' : 'transparent',
              background: metricType === 'latency' ? 'rgba(56, 189, 248, 0.2)' : 'transparent'
            }}
          >
            Latency (ms)
          </button>
          <button
            className="btn-secondary"
            onClick={() => setMetricType('utilization')}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              borderColor: metricType === 'utilization' ? 'var(--accent-cyan)' : 'transparent',
              background: metricType === 'utilization' ? 'rgba(56, 189, 248, 0.2)' : 'transparent'
            }}
          >
            Utilization (%)
          </button>
          <button
            className="btn-secondary"
            onClick={() => setMetricType('drops')}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              borderColor: metricType === 'drops' ? 'var(--accent-rose)' : 'transparent',
              background: metricType === 'drops' ? 'rgba(244, 63, 94, 0.2)' : 'transparent'
            }}
          >
            Packet Drops
          </button>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <Clock size={18} style={{ marginRight: '8px' }} /> Awaiting live telemetry stream...
        </div>
      ) : (
        <div style={{ width: '100%', height: '320px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis 
                dataKey="timeLabel" 
                stroke="#64748b" 
                tick={{ fontSize: 11 }} 
                minTickGap={20}
              />
              <YAxis 
                stroke="#64748b" 
                tick={{ fontSize: 11 }}
                domain={metricType === 'utilization' ? [0, 110] : ['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip metricType={metricType} />} />
              <Legend 
                wrapperStyle={{ fontSize: '0.8rem', paddingTop: '8px' }} 
                iconType="circle"
              />

              {metricType === 'latency' && (
                <ReferenceLine 
                  y={15} 
                  label={{ value: 'URLLC SLA Limit (15ms)', fill: '#f43f5e', fontSize: 11, position: 'insideTopRight' }} 
                  stroke="#f43f5e" 
                  strokeDasharray="4 4" 
                />
              )}

              {metricType === 'utilization' && (
                <ReferenceLine 
                  y={90} 
                  label={{ value: 'Congestion Threshold (90%)', fill: '#f59e0b', fontSize: 11, position: 'insideTopRight' }} 
                  stroke="#f59e0b" 
                  strokeDasharray="4 4" 
                />
              )}

              {/* Data Lines based on active view */}
              {metricType === 'throughput' && (
                <>
                  <Line type="monotone" dataKey="ll_throughput" name="Low-Latency" stroke="#38bdf8" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="hb_throughput" name="High-Bandwidth" stroke="#a855f7" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="gen_throughput" name="General-Purpose" stroke="#10b981" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </>
              )}

              {metricType === 'latency' && (
                <>
                  <Line type="monotone" dataKey="ll_latency" name="Low-Latency (ms)" stroke="#38bdf8" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="hb_latency" name="High-Bandwidth (ms)" stroke="#a855f7" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="gen_latency" name="General-Purpose (ms)" stroke="#10b981" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </>
              )}

              {metricType === 'utilization' && (
                <>
                  <Line type="monotone" dataKey="ll_util" name="Low-Latency %" stroke="#38bdf8" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="hb_util" name="High-Bandwidth %" stroke="#a855f7" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="gen_util" name="General-Purpose %" stroke="#10b981" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </>
              )}

              {metricType === 'drops' && (
                <>
                  <Line type="stepAfter" dataKey="ll_drops" name="Low-Latency Drops" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="hb_drops" name="High-Bandwidth Drops" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="gen_drops" name="General-Purpose Drops" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default MetricsCharts;
