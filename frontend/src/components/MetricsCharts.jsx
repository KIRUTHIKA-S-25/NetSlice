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
import { Clock } from 'lucide-react';

const CustomTooltip = ({ active, payload, label, metricType }) => {
  if (active && payload && payload.length) {
    const timeFormatted = typeof label === 'number' 
      ? new Date(label * 1000).toLocaleTimeString() 
      : label;

    const unit = metricType === 'throughput' ? 'Mbps' : metricType === 'latency' ? 'ms' : metricType === 'utilization' ? '%' : 'pkts';

    return (
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid #374151',
        borderRadius: '6px',
        padding: '8px 12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        fontSize: '0.78rem'
      }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
          {timeFormatted}
        </div>
        {payload.map((entry, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', margin: '2px 0' }}>
            <span style={{ color: entry.color, fontWeight: '500' }}>{entry.name}:</span>
            <span style={{ fontWeight: '600', color: '#ffffff' }}>
              {entry.value} {unit}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const MetricsCharts = ({ history }) => {
  const [metricType, setMetricType] = useState('throughput');

  const chartData = (history || []).map((snapshot) => {
    const slices = snapshot.slices || {};
    const timeLabel = new Date(snapshot.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return {
      timestamp: snapshot.timestamp,
      timeLabel: timeLabel,
      
      ll_throughput: Number((slices.low_latency?.throughput_mbps || 0).toFixed(1)),
      hb_throughput: Number((slices.high_bandwidth?.throughput_mbps || 0).toFixed(1)),
      gen_throughput: Number((slices.general?.throughput_mbps || 0).toFixed(1)),

      ll_latency: Number(((slices.low_latency?.avg_latency_ms || (slices.low_latency?.avg_latency || 0) * 1000)).toFixed(1)),
      hb_latency: Number(((slices.high_bandwidth?.avg_latency_ms || (slices.high_bandwidth?.avg_latency || 0) * 1000)).toFixed(1)),
      gen_latency: Number(((slices.general?.avg_latency_ms || (slices.general?.avg_latency || 0) * 1000)).toFixed(1)),

      ll_util: Number((slices.low_latency?.utilization || 0).toFixed(0)),
      hb_util: Number((slices.high_bandwidth?.utilization || 0).toFixed(0)),
      gen_util: Number((slices.general?.utilization || 0).toFixed(0)),

      ll_drops: slices.low_latency?.packets_dropped || 0,
      hb_drops: slices.high_bandwidth?.packets_dropped || 0,
      gen_drops: slices.general?.packets_dropped || 0
    };
  });

  return (
    <div className="glass-card" style={{ padding: '18px 22px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ fontSize: '0.98rem', fontWeight: '600', color: '#ffffff' }}>
            Live Traffic Graphs
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Real-time moving window over the last 60 seconds
          </p>
        </div>

        {/* Metric Selector Tabs */}
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#0c101c', padding: '3px', borderRadius: '6px', border: '1px solid #1e2638' }}>
          <button
            className="btn-secondary"
            onClick={() => setMetricType('throughput')}
            style={{
              padding: '4px 10px',
              fontSize: '0.76rem',
              border: 'none',
              backgroundColor: metricType === 'throughput' ? '#1e293b' : 'transparent',
              color: metricType === 'throughput' ? '#ffffff' : 'var(--text-secondary)'
            }}
          >
            Throughput (Mbps)
          </button>
          <button
            className="btn-secondary"
            onClick={() => setMetricType('latency')}
            style={{
              padding: '4px 10px',
              fontSize: '0.76rem',
              border: 'none',
              backgroundColor: metricType === 'latency' ? '#1e293b' : 'transparent',
              color: metricType === 'latency' ? '#ffffff' : 'var(--text-secondary)'
            }}
          >
            Latency (ms)
          </button>
          <button
            className="btn-secondary"
            onClick={() => setMetricType('utilization')}
            style={{
              padding: '4px 10px',
              fontSize: '0.76rem',
              border: 'none',
              backgroundColor: metricType === 'utilization' ? '#1e293b' : 'transparent',
              color: metricType === 'utilization' ? '#ffffff' : 'var(--text-secondary)'
            }}
          >
            Utilization (%)
          </button>
          <button
            className="btn-secondary"
            onClick={() => setMetricType('drops')}
            style={{
              padding: '4px 10px',
              fontSize: '0.76rem',
              border: 'none',
              backgroundColor: metricType === 'drops' ? '#1e293b' : 'transparent',
              color: metricType === 'drops' ? '#ffffff' : 'var(--text-secondary)'
            }}
          >
            Packet Drops
          </button>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <Clock size={16} style={{ marginRight: '6px' }} /> Awaiting live network traffic...
        </div>
      ) : (
        <div style={{ width: '100%', height: '290px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis 
                dataKey="timeLabel" 
                stroke="#6b7280" 
                tick={{ fontSize: 11 }} 
                minTickGap={25}
              />
              <YAxis 
                stroke="#6b7280" 
                tick={{ fontSize: 11 }}
                domain={metricType === 'utilization' ? [0, 105] : ['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip metricType={metricType} />} />
              <Legend 
                wrapperStyle={{ fontSize: '0.76rem', paddingTop: '6px' }} 
                iconType="circle"
              />

              {metricType === 'latency' && (
                <ReferenceLine 
                  y={15} 
                  label={{ value: 'Target Max (15ms)', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} 
                  stroke="#ef4444" 
                  strokeDasharray="4 4" 
                />
              )}

              {metricType === 'throughput' && (
                <>
                  <Line type="monotone" dataKey="ll_throughput" name="Calls & Gaming" stroke="var(--slice-low-latency)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="hb_throughput" name="Streaming & Video" stroke="var(--slice-high-bandwidth)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="gen_throughput" name="Standard Web" stroke="var(--slice-general)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </>
              )}

              {metricType === 'latency' && (
                <>
                  <Line type="monotone" dataKey="ll_latency" name="Calls & Gaming" stroke="var(--slice-low-latency)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="hb_latency" name="Streaming & Video" stroke="var(--slice-high-bandwidth)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="gen_latency" name="Standard Web" stroke="var(--slice-general)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </>
              )}

              {metricType === 'utilization' && (
                <>
                  <Line type="monotone" dataKey="ll_util" name="Calls & Gaming %" stroke="var(--slice-low-latency)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="hb_util" name="Streaming & Video %" stroke="var(--slice-high-bandwidth)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="gen_util" name="Standard Web %" stroke="var(--slice-general)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </>
              )}

              {metricType === 'drops' && (
                <>
                  <Line type="stepAfter" dataKey="ll_drops" name="Low-Latency Drops" stroke="var(--slice-low-latency)" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="hb_drops" name="Streaming Drops" stroke="var(--slice-high-bandwidth)" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="gen_drops" name="Standard Drops" stroke="var(--slice-general)" strokeWidth={1.5} dot={{ r: 2 }} isAnimationActive={false} />
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
