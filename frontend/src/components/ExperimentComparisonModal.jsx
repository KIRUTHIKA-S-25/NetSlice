import React, { useState, useEffect } from 'react';
import { 
  X, 
  Play, 
  BarChart3, 
  CheckCircle, 
  AlertTriangle, 
  Sliders, 
  Cpu, 
  RefreshCw,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { API_BASE } from '../config';

const ExperimentComparisonModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('benchmark'); // 'benchmark' | 'profiles' | 'decisions'
  const [scenario, setScenario] = useState('gaming_burst');
  const [duration, setDuration] = useState(20);
  const [seed, setSeed] = useState(42);
  const [isRunning, setIsRunning] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  
  // Application Profiles state
  const [profiles, setProfiles] = useState({});
  const [selectedProfileId, setSelectedProfileId] = useState('online_gaming');
  const [profileForm, setProfileForm] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');

  // Allocation Decisions state
  const [decisions, setDecisions] = useState([]);
  const [isLoadingDecisions, setIsLoadingDecisions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProfiles();
      fetchDecisions();
    }
  }, [isOpen]);

  const fetchProfiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/application-profiles`);
      const data = await res.json();
      if (data.status === 'success') {
        setProfiles(data.profiles);
        if (data.profiles[selectedProfileId]) {
          setProfileForm({ ...data.profiles[selectedProfileId] });
        }
      }
    } catch (err) {
      console.error('Failed to fetch profiles:', err);
    }
  };

  const fetchDecisions = async () => {
    setIsLoadingDecisions(true);
    try {
      const res = await fetch(`${API_BASE}/api/allocation/decisions?limit=25`);
      const data = await res.json();
      if (data.status === 'success') {
        setDecisions(data.decisions || []);
      }
    } catch (err) {
      console.error('Failed to fetch allocation decisions:', err);
    } finally {
      setIsLoadingDecisions(false);
    }
  };

  const handleProfileSelect = (profId) => {
    setSelectedProfileId(profId);
    if (profiles[profId]) {
      setProfileForm({ ...profiles[profId] });
      setSaveStatus('');
    }
  };

  const handleSaveProfile = async () => {
    if (!profileForm) return;
    setSaveStatus('Saving...');
    try {
      const res = await fetch(`${API_BASE}/api/application-profiles/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: selectedProfileId,
          updates: {
            preferred_slice: profileForm.preferred_slice,
            priority: parseInt(profileForm.priority, 10),
            target_max_latency_ms: parseFloat(profileForm.target_max_latency_ms),
            target_max_jitter_ms: parseFloat(profileForm.target_max_jitter_ms),
            target_max_loss_rate: parseFloat(profileForm.target_max_loss_rate),
            min_throughput_mbps: parseFloat(profileForm.min_throughput_mbps),
            target_throughput_mbps: parseFloat(profileForm.target_throughput_mbps)
          }
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSaveStatus('Profile updated successfully!');
        fetchProfiles();
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus('Failed to update: ' + (data.message || 'Error'));
      }
    } catch (err) {
      setSaveStatus('Network error while saving');
    }
  };

  const handleRunBenchmark = async () => {
    setIsRunning(true);
    try {
      const res = await fetch(`${API_BASE}/api/experiments/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario,
          duration_ticks: parseInt(duration, 10),
          seed: parseInt(seed, 10)
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setBenchmarkResult(data.experiment);
        fetchDecisions();
      }
    } catch (err) {
      console.error('Benchmark error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 10, 20, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1100px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        color: '#f8fafc',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ padding: '6px', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '8px', color: '#60a5fa' }}>
                <BarChart3 size={20} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                Fair Experimental Evaluation & QoS Profiler
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
              Deterministic 3-Strategy Benchmark (Static vs Rule-Based vs AI Predictive) • <span style={{ color: '#38bdf8', fontWeight: 600 }}>Simulated Workload Engine (Identical Seeds & Traces)</span>
            </p>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', backgroundColor: '#090d16', padding: '0 20px' }}>
          <button
            onClick={() => setActiveTab('benchmark')}
            style={{
              padding: '12px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'benchmark' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'benchmark' ? '#60a5fa' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Zap size={16} /> 3-Strategy Fair Benchmark
          </button>
          <button
            onClick={() => setActiveTab('profiles')}
            style={{
              padding: '12px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'profiles' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'profiles' ? '#60a5fa' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Layers size={16} /> 8 Application QoS Profiles
          </button>
          <button
            onClick={() => { setActiveTab('decisions'); fetchDecisions(); }}
            style={{
              padding: '12px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'decisions' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'decisions' ? '#60a5fa' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Clock size={16} /> Reallocation Decisions Log
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          
          {/* TAB 1: 3-STRATEGY BENCHMARK */}
          {activeTab === 'benchmark' && (
            <div>
              {/* Configuration Toolbar */}
              <div style={{
                backgroundColor: '#1e293b',
                padding: '16px 20px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Workload Scenario:</label>
                  <select
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                    style={{
                      background: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.82rem'
                    }}
                  >
                    <option value="gaming_burst">1. Sudden Gaming Traffic Burst (45 Mbps on LL)</option>
                    <option value="streaming_heavy">2. Streaming-Heavy 4K UHD Workload (75 Mbps on HB)</option>
                    <option value="download_congestion">3. Large File Download Congestion (80 Mbps Bulk)</option>
                    <option value="mixed_concurrent">4. Multiple Concurrent Applications (Mixed)</option>
                    <option value="overload">5. Extreme System Overload (170 Mbps vs 100 Mbps)</option>
                    <option value="idle_low">6. Low-Demand Idle Conditions (20 Mbps Total)</option>
                    <option value="normal">7. Normal Balanced Baseline</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Duration (Ticks):</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    style={{
                      background: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.82rem'
                    }}
                  >
                    <option value="15">15 Seconds (Quick)</option>
                    <option value="20">20 Seconds (Standard)</option>
                    <option value="30">30 Seconds (Deep)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Deterministic Seed:</label>
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    style={{
                      background: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      width: '90px',
                      fontSize: '0.82rem'
                    }}
                  />
                </div>

                <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
                  <button
                    onClick={handleRunBenchmark}
                    disabled={isRunning}
                    style={{
                      backgroundColor: isRunning ? '#334155' : '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isRunning ? <RefreshCw className="spin" size={16} /> : <Play size={16} />}
                    {isRunning ? 'Evaluating Workload...' : 'Execute Fair Benchmark'}
                  </button>
                </div>
              </div>

              {/* Benchmark Results */}
              {benchmarkResult ? (
                <div>
                  {/* Key Highlights Banner */}
                  <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '16px',
                    borderRadius: '10px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CheckCircle color="#10b981" size={24} />
                      <div>
                        <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.95rem' }}>
                          Predict-Before-Congestion Evaluation Summary
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                          {benchmarkResult.tradeoffs_summary?.observations}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
                          {benchmarkResult.tradeoffs_summary?.latency_reduction_pct}%
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Latency Reduction</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>
                          {benchmarkResult.tradeoffs_summary?.qos_violation_reduction_pct}%
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>QoS Violations Avoided</div>
                      </div>
                    </div>
                  </div>

                  {/* Side-by-Side Comparison Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    
                    {/* Strategy A: Static */}
                    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontWeight: 700, color: '#cbd5e1', fontSize: '0.9rem' }}>Strategy A: Static</span>
                        <span style={{ fontSize: '0.7rem', backgroundColor: '#334155', padding: '2px 8px', borderRadius: '4px' }}>Fixed Baseline</span>
                      </div>
                      <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Avg Latency:</span>
                          <span style={{ fontWeight: 600 }}>{benchmarkResult.strategies?.static?.avg_latency_ms} ms</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>P95 Latency:</span>
                          <span style={{ fontWeight: 600 }}>{benchmarkResult.strategies?.static?.p95_latency_ms} ms</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Packet Loss:</span>
                          <span style={{ fontWeight: 600, color: benchmarkResult.strategies?.static?.packet_loss_rate > 0 ? '#f43f5e' : '#34d399' }}>
                            {benchmarkResult.strategies?.static?.packet_loss_rate}% ({benchmarkResult.strategies?.static?.packets_dropped} pkts)
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Throughput:</span>
                          <span style={{ fontWeight: 600 }}>{benchmarkResult.strategies?.static?.avg_throughput_mbps} Mbps</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>QoS Violations:</span>
                          <span style={{ fontWeight: 600, color: benchmarkResult.strategies?.static?.total_qos_violations > 0 ? '#f43f5e' : '#34d399' }}>
                            {benchmarkResult.strategies?.static?.total_qos_violations}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Reallocations:</span>
                          <span style={{ fontWeight: 600 }}>0 (Static)</span>
                        </div>
                      </div>
                    </div>

                    {/* Strategy B: Rule-Based */}
                    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #475569' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.9rem' }}>Strategy B: Rule-Based</span>
                        <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', padding: '2px 8px', borderRadius: '4px' }}>Threshold Reactive</span>
                      </div>
                      <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Avg Latency:</span>
                          <span style={{ fontWeight: 600 }}>{benchmarkResult.strategies?.rule_based?.avg_latency_ms} ms</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>P95 Latency:</span>
                          <span style={{ fontWeight: 600 }}>{benchmarkResult.strategies?.rule_based?.p95_latency_ms} ms</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Packet Loss:</span>
                          <span style={{ fontWeight: 600, color: benchmarkResult.strategies?.rule_based?.packet_loss_rate > 0 ? '#f43f5e' : '#34d399' }}>
                            {benchmarkResult.strategies?.rule_based?.packet_loss_rate}%
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Throughput:</span>
                          <span style={{ fontWeight: 600 }}>{benchmarkResult.strategies?.rule_based?.avg_throughput_mbps} Mbps</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>QoS Violations:</span>
                          <span style={{ fontWeight: 600, color: benchmarkResult.strategies?.rule_based?.total_qos_violations > 0 ? '#fbbf24' : '#34d399' }}>
                            {benchmarkResult.strategies?.rule_based?.total_qos_violations}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Reallocations:</span>
                          <span style={{ fontWeight: 600 }}>{benchmarkResult.strategies?.rule_based?.reallocations_count} shifts</span>
                        </div>
                      </div>
                    </div>

                    {/* Strategy C: AI-Assisted */}
                    <div style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid #3b82f6' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontWeight: 700, color: '#60a5fa', fontSize: '0.9rem' }}>Strategy C: AI Predictive</span>
                        <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa', padding: '2px 8px', borderRadius: '4px' }}>Predict-Before-Congest</span>
                      </div>
                      <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Avg Latency:</span>
                          <span style={{ fontWeight: 700, color: '#38bdf8' }}>{benchmarkResult.strategies?.ai_assisted?.avg_latency_ms} ms</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>P95 Latency:</span>
                          <span style={{ fontWeight: 700, color: '#38bdf8' }}>{benchmarkResult.strategies?.ai_assisted?.p95_latency_ms} ms</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Packet Loss:</span>
                          <span style={{ fontWeight: 600, color: '#34d399' }}>
                            {benchmarkResult.strategies?.ai_assisted?.packet_loss_rate}%
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Throughput:</span>
                          <span style={{ fontWeight: 600 }}>{benchmarkResult.strategies?.ai_assisted?.avg_throughput_mbps} Mbps</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>QoS Violations:</span>
                          <span style={{ fontWeight: 700, color: '#34d399' }}>
                            {benchmarkResult.strategies?.ai_assisted?.total_qos_violations}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>Prediction Accuracy:</span>
                          <span style={{ fontWeight: 600, color: '#c084fc' }}>
                            MAE: {benchmarkResult.strategies?.ai_assisted?.prediction_mae} | RMSE: {benchmarkResult.strategies?.ai_assisted?.prediction_rmse}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Per-Slice Resource Breakdown Table */}
                  <div style={{ backgroundColor: '#0b1120', borderRadius: '10px', padding: '16px', border: '1px solid #1e293b' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', margin: '0 0 12px', textTransform: 'uppercase' }}>
                      Per-Slice Detailed Invariants & Outcomes
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #1e293b', textAlign: 'left', color: '#64748b' }}>
                          <th style={{ padding: '8px' }}>Slice Class</th>
                          <th style={{ padding: '8px' }}>Static Alloc</th>
                          <th style={{ padding: '8px' }}>Rule Alloc</th>
                          <th style={{ padding: '8px' }}>AI Predictive Alloc</th>
                          <th style={{ padding: '8px' }}>AI Latency (ms)</th>
                          <th style={{ padding: '8px' }}>AI Utilization</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 600, color: '#f43f5e' }}>URLLC (Low-Latency)</td>
                          <td style={{ padding: '10px 8px' }}>30.0 Mbps</td>
                          <td style={{ padding: '10px 8px' }}>{benchmarkResult.strategies?.rule_based?.slice_breakdown?.low_latency?.final_allocated_bandwidth} Mbps</td>
                          <td style={{ padding: '10px 8px', fontWeight: 700, color: '#38bdf8' }}>{benchmarkResult.strategies?.ai_assisted?.slice_breakdown?.low_latency?.final_allocated_bandwidth} Mbps</td>
                          <td style={{ padding: '10px 8px' }}>{benchmarkResult.strategies?.ai_assisted?.slice_breakdown?.low_latency?.avg_latency_ms} ms</td>
                          <td style={{ padding: '10px 8px' }}>{benchmarkResult.strategies?.ai_assisted?.slice_breakdown?.low_latency?.avg_utilization}%</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 600, color: '#06b6d4' }}>eMBB (High-Bandwidth)</td>
                          <td style={{ padding: '10px 8px' }}>50.0 Mbps</td>
                          <td style={{ padding: '10px 8px' }}>{benchmarkResult.strategies?.rule_based?.slice_breakdown?.high_bandwidth?.final_allocated_bandwidth} Mbps</td>
                          <td style={{ padding: '10px 8px', fontWeight: 700, color: '#06b6d4' }}>{benchmarkResult.strategies?.ai_assisted?.slice_breakdown?.high_bandwidth?.final_allocated_bandwidth} Mbps</td>
                          <td style={{ padding: '10px 8px' }}>{benchmarkResult.strategies?.ai_assisted?.slice_breakdown?.high_bandwidth?.avg_latency_ms} ms</td>
                          <td style={{ padding: '10px 8px' }}>{benchmarkResult.strategies?.ai_assisted?.slice_breakdown?.high_bandwidth?.avg_utilization}%</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '10px 8px', fontWeight: 600, color: '#10b981' }}>mMTC (General)</td>
                          <td style={{ padding: '10px 8px' }}>20.0 Mbps</td>
                          <td style={{ padding: '10px 8px' }}>{benchmarkResult.strategies?.rule_based?.slice_breakdown?.general?.final_allocated_bandwidth} Mbps</td>
                          <td style={{ padding: '10px 8px', fontWeight: 700, color: '#10b981' }}>{benchmarkResult.strategies?.ai_assisted?.slice_breakdown?.general?.final_allocated_bandwidth} Mbps</td>
                          <td style={{ padding: '10px 8px' }}>{benchmarkResult.strategies?.ai_assisted?.slice_breakdown?.general?.avg_latency_ms} ms</td>
                          <td style={{ padding: '10px 8px' }}>{benchmarkResult.strategies?.ai_assisted?.slice_breakdown?.general?.avg_utilization}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                </div>
              ) : (
                <div style={{
                  padding: '60px 20px',
                  textAlign: 'center',
                  backgroundColor: 'rgba(30, 41, 59, 0.4)',
                  borderRadius: '12px',
                  border: '1px dashed #334155'
                }}>
                  <BarChart3 size={40} color="#64748b" style={{ margin: '0 auto 12px' }} />
                  <h4 style={{ margin: '0 0 6px', fontWeight: 600 }}>No Benchmark Run Executed Yet</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                    Select a workload scenario above and click "Execute Fair Benchmark" to run all three strategies under identical random seeds.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: APPLICATION QOS PROFILES */}
          {activeTab === 'profiles' && (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
              
              {/* Profile List */}
              <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '16px', border: '1px solid #334155' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  8 Application Profiles
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.values(profiles).map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleProfileSelect(p.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: selectedProfileId === p.id ? '1px solid #3b82f6' : '1px solid transparent',
                        backgroundColor: selectedProfileId === p.id ? 'rgba(59, 130, 246, 0.15)' : '#0f172a',
                        color: selectedProfileId === p.id ? '#60a5fa' : '#cbd5e1',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{p.name}</span>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: p.preferred_slice === 'low_latency' ? 'rgba(244, 63, 94, 0.2)' : (p.preferred_slice === 'high_bandwidth' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(16, 185, 129, 0.2)'),
                        color: p.preferred_slice === 'low_latency' ? '#f43f5e' : (p.preferred_slice === 'high_bandwidth' ? '#06b6d4' : '#10b981')
                      }}>
                        {p.preferred_slice === 'low_latency' ? 'URLLC' : (p.preferred_slice === 'high_bandwidth' ? 'eMBB' : 'mMTC')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Profile Config Form */}
              {profileForm && (
                <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{profileForm.name}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>{profileForm.description}</p>
                    </div>
                    <span style={{ fontSize: '0.75rem', backgroundColor: '#334155', padding: '4px 10px', borderRadius: '6px' }}>
                      Category: {profileForm.category}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Preferred Slice:</label>
                      <select
                        value={profileForm.preferred_slice}
                        onChange={(e) => setProfileForm({ ...profileForm, preferred_slice: e.target.value })}
                        style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '8px', borderRadius: '6px' }}
                      >
                        <option value="low_latency">Low-Latency (URLLC)</option>
                        <option value="high_bandwidth">High-Bandwidth (eMBB)</option>
                        <option value="general">General-Purpose (mMTC)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Priority (1=Highest, 6=Lowest):</label>
                      <input
                        type="number"
                        min="1"
                        max="6"
                        value={profileForm.priority}
                        onChange={(e) => setProfileForm({ ...profileForm, priority: e.target.value })}
                        style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '8px', borderRadius: '6px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Target Max Latency (ms):</label>
                      <input
                        type="number"
                        value={profileForm.target_max_latency_ms}
                        onChange={(e) => setProfileForm({ ...profileForm, target_max_latency_ms: e.target.value })}
                        style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '8px', borderRadius: '6px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Target Max Jitter (ms):</label>
                      <input
                        type="number"
                        value={profileForm.target_max_jitter_ms}
                        onChange={(e) => setProfileForm({ ...profileForm, target_max_jitter_ms: e.target.value })}
                        style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '8px', borderRadius: '6px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Target Max Packet Loss Rate (e.g. 0.01 = 1%):</label>
                      <input
                        type="number"
                        step="0.005"
                        value={profileForm.target_max_loss_rate}
                        onChange={(e) => setProfileForm({ ...profileForm, target_max_loss_rate: e.target.value })}
                        style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '8px', borderRadius: '6px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Min Guaranteed Throughput (Mbps):</label>
                      <input
                        type="number"
                        value={profileForm.min_throughput_mbps}
                        onChange={(e) => setProfileForm({ ...profileForm, min_throughput_mbps: e.target.value })}
                        style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '8px', borderRadius: '6px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #334155', paddingTop: '16px' }}>
                    <span style={{ fontSize: '0.8rem', color: saveStatus.includes('successfully') ? '#34d399' : '#f59e0b' }}>
                      {saveStatus}
                    </span>
                    <button
                      onClick={handleSaveProfile}
                      style={{
                        backgroundColor: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Update Profile Parameters
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: EXPLAINABLE ALLOCATION DECISIONS */}
          {activeTab === 'decisions' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                  Recent Explainable Allocation Decisions
                </h3>
                <button
                  onClick={fetchDecisions}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={14} className={isLoadingDecisions ? 'spin' : ''} /> Refresh Log
                </button>
              </div>

              {decisions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  No allocation events recorded yet. Run a simulation or benchmark to generate explainable reallocation logs.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {decisions.map((d, idx) => (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: '#1e293b',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        border: '1px solid #334155'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: d.decision_type === 'PROACTIVE_PREDICTION' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                            color: d.decision_type === 'PROACTIVE_PREDICTION' ? '#60a5fa' : '#f59e0b',
                            fontWeight: 700
                          }}>
                            {d.decision_type}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {new Date(d.timestamp * 1000).toLocaleTimeString()}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Budget: {d.total_budget} Mbps
                        </span>
                      </div>

                      <p style={{ margin: '0 0 10px', fontSize: '0.84rem', color: '#f1f5f9', fontWeight: 500 }}>
                        {d.reason}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '0.78rem', backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: '6px' }}>
                        <div>
                          <span style={{ color: '#f43f5e', fontWeight: 600 }}>Low-Latency: </span>
                          <span style={{ color: '#94a3b8' }}>{d.previous_allocations?.low_latency}M </span>
                          <ArrowRight size={10} style={{ display: 'inline', margin: '0 2px' }} />
                          <span style={{ color: '#f8fafc', fontWeight: 700 }}>{d.new_allocations?.low_latency}M</span>
                        </div>
                        <div>
                          <span style={{ color: '#06b6d4', fontWeight: 600 }}>High-Bandwidth: </span>
                          <span style={{ color: '#94a3b8' }}>{d.previous_allocations?.high_bandwidth}M </span>
                          <ArrowRight size={10} style={{ display: 'inline', margin: '0 2px' }} />
                          <span style={{ color: '#f8fafc', fontWeight: 700 }}>{d.new_allocations?.high_bandwidth}M</span>
                        </div>
                        <div>
                          <span style={{ color: '#10b981', fontWeight: 600 }}>General: </span>
                          <span style={{ color: '#94a3b8' }}>{d.previous_allocations?.general}M </span>
                          <ArrowRight size={10} style={{ display: 'inline', margin: '0 2px' }} />
                          <span style={{ color: '#f8fafc', fontWeight: 700 }}>{d.new_allocations?.general}M</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ExperimentComparisonModal;
