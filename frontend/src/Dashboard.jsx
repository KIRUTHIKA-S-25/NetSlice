import React, { useState, useEffect } from 'react';
import './index.css';

const Dashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [strategy, setStrategy] = useState('static');

  // Poll metrics every 1 second
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:8000/api/metrics');
          const data = await res.json();
          if (data.status === 'active') {
            setMetrics(data.data.slices);
          }
        } catch (e) {
          console.error(e);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleStart = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setIsRunning(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStop = async () => {
    try {
      await fetch('http://localhost:8000/api/stop', { method: 'POST' });
      setIsRunning(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          AI-Assisted Network Slicing
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>5G/6G Resource Allocation Simulation</p>
      </header>

      <section className="glass" style={{ padding: '20px', marginBottom: '30px', display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'center' }}>
        <div>
          <label style={{ marginRight: '10px' }}>Allocation Strategy:</label>
          <select 
            value={strategy} 
            onChange={(e) => setStrategy(e.target.value)}
            disabled={isRunning}
            style={{ padding: '8px', borderRadius: '6px', background: 'var(--bg-color)', color: 'white', border: '1px solid var(--text-muted)' }}
          >
            <option value="static">Static</option>
            <option value="rule_based">Rule-Based</option>
            <option value="ai_assisted">AI-Assisted Dynamic</option>
          </select>
        </div>
        <button className="premium-btn" onClick={handleStart} disabled={isRunning}>Start Simulation</button>
        <button className="premium-btn danger" onClick={handleStop} disabled={!isRunning}>Stop</button>
      </section>

      {metrics && (
        <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {Object.entries(metrics).map(([name, data]) => (
            <div key={name} className="glass" style={{ padding: '20px' }}>
              <h3 style={{ textTransform: 'capitalize', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                {name.replace('_', ' ')} Slice
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Throughput:</span>
                  <span style={{ fontWeight: '600' }}>{data.throughput_mbps.toFixed(2)} Mbps</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Utilization:</span>
                  <span style={{ fontWeight: '600', color: data.utilization > 90 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                    {data.utilization.toFixed(1)}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Avg Latency:</span>
                  <span style={{ fontWeight: '600' }}>{(data.avg_latency * 1000).toFixed(2)} ms</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Packets Dropped:</span>
                  <span style={{ fontWeight: '600', color: data.packets_dropped > 0 ? 'var(--accent-red)' : 'inherit' }}>
                    {data.packets_dropped}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export default Dashboard;
