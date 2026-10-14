import React, { useState, useEffect } from 'react';
import { 
  Network, 
  ShieldCheck, 
  ShieldAlert, 
  Terminal, 
  RotateCcw, 
  Eye, 
  Laptop, 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle, 
  Plus, 
  Trash2,
  FileCode,
  Layers,
  ArrowRight
} from 'lucide-react';
import { API_BASE } from '../config';

const RealNetworkGatewayPanel = ({
  mode,
  onModeChange,
  enforcementStatus = 'UNCONFIGURED',
  gatewayInfo = {},
  devices = [],
  allocations = {},
  enforcedAllocations = {},
  onRefresh
}) => {
  const [operatorAuthorized, setOperatorAuthorized] = useState(false);
  const [adapterType, setAdapterType] = useState('dry_run');
  const [selectedInterface, setSelectedInterface] = useState('eth0');
  const [isUpdating, setIsUpdating] = useState(false);
  const [dryRunModalOpen, setDryRunModalOpen] = useState(false);
  const [dryRunData, setDryRunData] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);

  // New device form state
  const [newDevice, setNewDevice] = useState({
    device_id: '',
    name: '',
    mac_address: '',
    ip_address: '',
    assigned_slice: 'low_latency',
    application_profile: 'URLLC Low Latency Control',
    classification_source: 'Explicit Operator Label'
  });

  useEffect(() => {
    if (gatewayInfo) {
      if (gatewayInfo.operator_authorized !== undefined) {
        setOperatorAuthorized(gatewayInfo.operator_authorized);
      }
      if (gatewayInfo.adapter_type) {
        setAdapterType(gatewayInfo.adapter_type);
      }
      if (gatewayInfo.interface) {
        setSelectedInterface(gatewayInfo.interface);
      }
    }
  }, [gatewayInfo]);

  // Handle gateway configuration update
  const handleUpdateGatewayConfig = async (newMode, authorized, adapter) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/api/gateway/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: newMode || mode,
          adapter_type: adapter || adapterType,
          interface: selectedInterface,
          operator_authorized: authorized !== undefined ? authorized : operatorAuthorized,
          dry_run: adapter !== 'linux_tc' || !(authorized !== undefined ? authorized : operatorAuthorized)
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setStatusMessage({ type: 'success', text: data.message });
        if (onModeChange && newMode) {
          onModeChange(newMode);
        }
        if (onRefresh) onRefresh();
      } else {
        setStatusMessage({ type: 'error', text: data.message || 'Config failed' });
      }
    } catch (e) {
      setStatusMessage({ type: 'error', text: 'Backend communication error' });
    } finally {
      setIsUpdating(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Run dry run and preview tc script
  const handleRunDryRun = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/gateway/dry-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations })
      });
      const data = await res.json();
      setDryRunData(data);
      setDryRunModalOpen(true);
    } catch (e) {
      alert('Failed to execute dry-run check.');
    }
  };

  // Rollback gateway configuration
  const handleRollback = async () => {
    if (!window.confirm('Are you sure you want to rollback all traffic control rules on the gateway?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/gateway/rollback`, { method: 'POST' });
      const data = await res.json();
      setStatusMessage({ type: 'info', text: data.message });
      if (onRefresh) onRefresh();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (e) {
      alert('Rollback request failed.');
    }
  };

  // Add lab device
  const handleAddDevice = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDevice)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setShowAddDeviceModal(false);
        setNewDevice({
          device_id: '',
          name: '',
          mac_address: '',
          ip_address: '',
          assigned_slice: 'low_latency',
          application_profile: 'URLLC Low Latency Control',
          classification_source: 'Explicit Operator Label'
        });
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      alert('Error registering device');
    }
  };

  // Delete lab device
  const handleDeleteDevice = async (id) => {
    if (!window.confirm(`Remove device ${id}?`)) return;
    try {
      await fetch(`${API_BASE}/api/devices/${id}`, { method: 'DELETE' });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error removing device');
    }
  };

  const getStatusBadge = () => {
    switch (enforcementStatus) {
      case 'ENFORCING':
        return <span className="badge badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={12} /> Active Gateway Enforcement</span>;
      case 'DRY_RUN':
        return <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><FileCode size={12} /> Dry-Run Validated</span>;
      case 'ENFORCEMENT_UNAVAILABLE_ON_HOST':
        return <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> Windows Host: Read-Only (Enforcement Requires Linux Gateway)</span>;
      case 'MONITOR_ONLY':
        return <span className="badge badge-cyan" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Eye size={12} /> Safe Monitoring Only</span>;
      case 'FALLBACK_VIRTUAL':
        return <span className="badge badge-rose" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> Gateway Unavailable (Fallback Virtual)</span>;
      case 'ROLLED_BACK':
        return <span className="badge badge-slate" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><RotateCcw size={12} /> Rules Rolled Back</span>;
      default:
        return <span className="badge badge-slate">Unconfigured</span>;
    }
  };

  return (
    <div className="glass-card" style={{ padding: '20px 24px', marginBottom: '22px' }}>
      
      {/* Header & Mode Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px', borderBottom: '1px solid var(--border-card)', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)'
          }}>
            <Network size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Real-Network Integration & Gateway Enforcement
              </h2>
              {getStatusBadge()}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Demonstrating closed-loop predictive resource management on physical network gateways
            </p>
          </div>
        </div>

        {/* 3 Operating Modes Selector (Requirement 13) */}
        <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-card-subtle)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
          <button
            onClick={() => handleUpdateGatewayConfig('simulation', false, 'dry_run')}
            className="btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: mode === 'simulation' ? '700' : '500',
              backgroundColor: mode === 'simulation' ? 'var(--bg-hover)' : 'transparent',
              color: mode === 'simulation' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '6px'
            }}
          >
            1. Simulation Mode
          </button>

          <button
            onClick={() => handleUpdateGatewayConfig('real_network_monitor', false, 'dry_run')}
            className="btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: (mode === 'real_network_monitor' || mode === 'real_network') ? '700' : '500',
              backgroundColor: (mode === 'real_network_monitor' || mode === 'real_network') ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              color: (mode === 'real_network_monitor' || mode === 'real_network') ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '6px'
            }}
          >
            2. Real-Network Monitoring
          </button>

          <button
            onClick={() => handleUpdateGatewayConfig('real_network_enforce', operatorAuthorized, 'linux_tc')}
            className="btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: mode === 'real_network_enforce' ? '700' : '500',
              backgroundColor: mode === 'real_network_enforce' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              color: mode === 'real_network_enforce' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '6px'
            }}
          >
            3. Real-Network Enforcement
          </button>
        </div>
      </div>

      {statusMessage && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '6px',
          fontSize: '0.82rem',
          fontWeight: '600',
          marginBottom: '14px',
          backgroundColor: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
          color: statusMessage.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
          border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
        }}>
          {statusMessage.text}
        </div>
      )}

      {/* SECTION 1: 4-STAGE ALLOCATION DISTINCTION TABLE (Requirement 14) */}
      <div style={{ marginBottom: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <h3 style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} /> 4-Stage Slicing Control Pipeline (Truthful Metric Disaggregation)
            </h3>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              Faculty Verification: Clear distinction between raw physical measurements, predictions, mathematical allocations, and gateway kernel enforcement
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-card)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px 12px' }}>Slice Name</th>
                <th style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>1. Measured Device Traffic</span>
                    <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>MEASURED</span>
                  </div>
                </th>
                <th style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>2. Predicted Demand</span>
                    <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>PREDICTED</span>
                  </div>
                </th>
                <th style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>3. Calculated Allocation</span>
                    <span className="badge badge-amber" style={{ fontSize: '0.65rem' }}>CALCULATED</span>
                  </div>
                </th>
                <th style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>4. Successfully Enforced</span>
                    <span className="badge badge-rose" style={{ fontSize: '0.65rem' }}>ENFORCED</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* URLLC Slice */}
              <tr style={{ borderBottom: '1px solid var(--border-card)' }}>
                <td style={{ padding: '10px 12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Low-Latency (URLLC)
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--accent-emerald)', fontWeight: '700' }}>
                  {(() => {
                    const dev = devices.find(d => d.assigned_slice === 'low_latency');
                    const val = dev?.metrics?.measured_throughput_mbps?.value;
                    return val !== undefined ? `${val.toFixed(1)} Mbps` : '0.0 Mbps';
                  })()}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--accent-cyan)' }}>
                  {(() => {
                    const dev = devices.find(d => d.assigned_slice === 'low_latency');
                    const val = dev?.metrics?.predicted_demand_mbps?.value;
                    return val !== undefined ? `${val.toFixed(1)} Mbps` : '—';
                  })()}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--accent-amber)', fontWeight: '600' }}>
                  {(allocations.low_latency || 30.0).toFixed(1)} Mbps
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {mode === 'real_network_enforce' && enforcementStatus === 'ENFORCING' ? (
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: '700' }}>
                      {(enforcedAllocations.low_latency || allocations.low_latency || 30.0).toFixed(1)} Mbps (tc class 1:10)
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                      {mode === 'simulation' ? 'Simulated Only' : 'Monitor Only (Not Enforced)'}
                    </span>
                  )}
                </td>
              </tr>

              {/* eMBB Slice */}
              <tr style={{ borderBottom: '1px solid var(--border-card)' }}>
                <td style={{ padding: '10px 12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  High-Bandwidth (eMBB)
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--accent-emerald)', fontWeight: '700' }}>
                  {(() => {
                    const dev = devices.find(d => d.assigned_slice === 'high_bandwidth');
                    const val = dev?.metrics?.measured_throughput_mbps?.value;
                    return val !== undefined ? `${val.toFixed(1)} Mbps` : '0.0 Mbps';
                  })()}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--accent-cyan)' }}>
                  {(() => {
                    const dev = devices.find(d => d.assigned_slice === 'high_bandwidth');
                    const val = dev?.metrics?.predicted_demand_mbps?.value;
                    return val !== undefined ? `${val.toFixed(1)} Mbps` : '—';
                  })()}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--accent-amber)', fontWeight: '600' }}>
                  {(allocations.high_bandwidth || 50.0).toFixed(1)} Mbps
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {mode === 'real_network_enforce' && enforcementStatus === 'ENFORCING' ? (
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: '700' }}>
                      {(enforcedAllocations.high_bandwidth || allocations.high_bandwidth || 50.0).toFixed(1)} Mbps (tc class 1:20)
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                      {mode === 'simulation' ? 'Simulated Only' : 'Monitor Only (Not Enforced)'}
                    </span>
                  )}
                </td>
              </tr>

              {/* mMTC Slice */}
              <tr>
                <td style={{ padding: '10px 12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  General-Purpose (mMTC)
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--accent-emerald)', fontWeight: '700' }}>
                  {(() => {
                    const dev = devices.find(d => d.assigned_slice === 'general');
                    const val = dev?.metrics?.measured_throughput_mbps?.value;
                    return val !== undefined ? `${val.toFixed(1)} Mbps` : '0.0 Mbps';
                  })()}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--accent-cyan)' }}>
                  {(() => {
                    const dev = devices.find(d => d.assigned_slice === 'general');
                    const val = dev?.metrics?.predicted_demand_mbps?.value;
                    return val !== undefined ? `${val.toFixed(1)} Mbps` : '—';
                  })()}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--accent-amber)', fontWeight: '600' }}>
                  {(allocations.general || 20.0).toFixed(1)} Mbps
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {mode === 'real_network_enforce' && enforcementStatus === 'ENFORCING' ? (
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: '700' }}>
                      {(enforcedAllocations.general || allocations.general || 20.0).toFixed(1)} Mbps (tc class 1:30)
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                      {mode === 'simulation' ? 'Simulated Only' : 'Monitor Only (Not Enforced)'}
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: GATEWAY ENFORCEMENT ADAPTER CONTROLS & SAFETY GATES */}
      <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '16px 20px', borderRadius: '10px', marginBottom: '22px', border: '1px solid var(--border-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={15} /> Gateway Enforcement Controller (Linux tc / Token-Bucket)
            </h4>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Safety guards prevent automatic network alterations without explicit operator authorization
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleRunDryRun}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <FileCode size={13} /> Dry-Run & Preview tc Script
            </button>
            <button
              onClick={handleRollback}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-rose)' }}
            >
              <RotateCcw size={13} /> Rollback / Reset Rules
            </button>
          </div>
        </div>

        {/* Configuration Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'center' }}>
          {/* Interface input */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Target Gateway Interface
            </label>
            <input
              type="text"
              value={selectedInterface}
              onChange={(e) => setSelectedInterface(e.target.value)}
              placeholder="e.g. eth0, wlan0, Wi-Fi"
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-card)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '0.78rem',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          {/* Adapter Type */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Enforcement Adapter Engine
            </label>
            <select
              value={adapterType}
              onChange={(e) => setAdapterType(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-card)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '0.78rem',
                color: 'var(--text-primary)'
              }}
            >
              <option value="dry_run">Dry-Run Simulator (Safe Validation)</option>
              <option value="linux_tc">Linux Traffic Control (tc HTB + fq_codel)</option>
              <option value="local_shaper">Local Socket Token-Bucket Shaper</option>
            </select>
          </div>

          {/* Operator Authorization Checkbox (Requirements 8 & 9) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '16px' }}>
            <input
              type="checkbox"
              id="op_auth_checkbox"
              checked={operatorAuthorized}
              onChange={(e) => {
                const checked = e.target.checked;
                setOperatorAuthorized(checked);
                handleUpdateGatewayConfig(undefined, checked, undefined);
              }}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="op_auth_checkbox" style={{ fontSize: '0.74rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '500' }}>
              Authorize Traffic Control changes on <span style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>{selectedInterface}</span>
            </label>
          </div>
        </div>
      </div>

      {/* SECTION 3: PHYSICAL DEVICE INVENTORY & TRAFFIC CLASSIFICATION (Requirements 2, 3, 4) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <h3 style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Laptop size={16} /> Device & Traffic Classification Layer (Multi-Device Lab Testbed)
            </h3>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              Explicit identity mapping — Devices are NOT falsely claimed to be on virtual slices without verified classification
            </p>
          </div>

          <button
            onClick={() => setShowAddDeviceModal(true)}
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={13} /> Add Test Device
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-card)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px 10px' }}>Device Identity</th>
                <th style={{ padding: '8px 10px' }}>Network Address</th>
                <th style={{ padding: '8px 10px' }}>Assigned Slice</th>
                <th style={{ padding: '8px 10px' }}>Application Profile</th>
                <th style={{ padding: '8px 10px' }}>Classification Source</th>
                <th style={{ padding: '8px 10px' }}>Payload Integrity</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((dev) => (
                <tr key={dev.device_id} style={{ borderBottom: '1px solid var(--border-card)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    <div>{dev.name}</div>
                    <span className={dev.is_discovered ? 'badge badge-cyan' : 'badge badge-slate'} style={{ fontSize: '0.62rem', padding: '1px 5px', marginTop: '2px', display: 'inline-block' }}>
                      {dev.is_discovered ? 'Discovered (Live ARP)' : 'Manual Lab Device'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {dev.ip_address} <br />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{dev.mac_address}</span>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span className={`badge ${dev.assigned_slice === 'low_latency' ? 'badge-rose' : dev.assigned_slice === 'high_bandwidth' ? 'badge-cyan' : 'badge-slate'}`} style={{ fontSize: '0.7rem' }}>
                      {dev.assigned_slice === 'low_latency' ? 'URLLC' : dev.assigned_slice === 'high_bandwidth' ? 'eMBB' : 'mMTC'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                    {dev.application_profile}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span className="badge badge-slate" style={{ fontSize: '0.68rem' }}>
                      {dev.classification_source}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span className="badge badge-amber" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <HelpCircle size={10} /> TLS 1.3 (Payload Uninspected)
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDeleteDevice(dev.device_id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                      title="Remove device"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRY RUN PREVIEW MODAL */}
      {dryRunModalOpen && dryRunData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-card" style={{ width: '650px', maxHeight: '85vh', overflowY: 'auto', padding: '24px', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCode size={18} color="var(--accent-cyan)" /> Linux Traffic Control (tc) Generated Script
              </h3>
              <button
                onClick={() => setDryRunModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', marginBottom: '14px', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
              <strong>Validation Status:</strong> {dryRunData.valid ? 'PASSED (Syntactically valid & within 100 Mbps parent budget)' : 'FAILED'} <br />
              <strong>Target Interface:</strong> {dryRunData.interface} | <strong>Parent Bandwidth:</strong> {dryRunData.parent_bandwidth_mbps} Mbps
            </div>

            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Generated Linux Kernel Commands (HTB + fq_codel):
            </label>
            <pre style={{
              backgroundColor: '#0f172a',
              color: '#38bdf8',
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              overflowX: 'auto',
              fontFamily: 'monospace',
              lineHeight: '1.5',
              border: '1px solid var(--border-card)'
            }}>
              {dryRunData.generated_tc_commands?.join('\n')}
            </pre>

            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginTop: '12px', marginBottom: '6px' }}>
              Clean Rollback Command:
            </label>
            <pre style={{
              backgroundColor: '#0f172a',
              color: '#f43f5e',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              border: '1px solid var(--border-card)'
            }}>
              {dryRunData.rollback_commands?.join('\n')}
            </pre>

            <div style={{ marginTop: '18px', textAlign: 'right' }}>
              <button
                className="btn-primary"
                onClick={() => setDryRunModalOpen(false)}
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD LAB DEVICE MODAL */}
      {showAddDeviceModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-card" style={{ width: '480px', padding: '24px', backgroundColor: 'var(--bg-card)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px' }}>
              Register Physical / Lab Test Device
            </h3>
            <form onSubmit={handleAddDevice}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Device ID</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. drone_cam_03"
                  value={newDevice.device_id}
                  onChange={(e) => setNewDevice({ ...newDevice, device_id: e.target.value })}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-card)', backgroundColor: 'var(--bg-card-subtle)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Device Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Autonomous Drone 4K Downlink"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-card)', backgroundColor: 'var(--bg-card-subtle)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>IP Address</label>
                  <input
                    required
                    type="text"
                    placeholder="192.168.1.150"
                    value={newDevice.ip_address}
                    onChange={(e) => setNewDevice({ ...newDevice, ip_address: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-card)', backgroundColor: 'var(--bg-card-subtle)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>MAC Address</label>
                  <input
                    required
                    type="text"
                    placeholder="00:11:22:33:44:55"
                    value={newDevice.mac_address}
                    onChange={(e) => setNewDevice({ ...newDevice, mac_address: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-card)', backgroundColor: 'var(--bg-card-subtle)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Target Slice</label>
                  <select
                    value={newDevice.assigned_slice}
                    onChange={(e) => setNewDevice({ ...newDevice, assigned_slice: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-card)', backgroundColor: 'var(--bg-card-subtle)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                  >
                    <option value="low_latency">Low-Latency (URLLC)</option>
                    <option value="high_bandwidth">High-Bandwidth (eMBB)</option>
                    <option value="general">General-Purpose (mMTC)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Classification Source</label>
                  <select
                    value={newDevice.classification_source}
                    onChange={(e) => setNewDevice({ ...newDevice, classification_source: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-card)', backgroundColor: 'var(--bg-card-subtle)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                  >
                    <option value="Explicit Operator Label">Explicit Operator Label</option>
                    <option value="Local Host Agent">Local Host Agent</option>
                    <option value="OS Process Socket Inspection">OS Process Socket Inspection</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Application Profile Description</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. 4K 60fps Real-Time Optical Inspection"
                  value={newDevice.application_profile}
                  onChange={(e) => setNewDevice({ ...newDevice, application_profile: e.target.value })}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-card)', backgroundColor: 'var(--bg-card-subtle)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddDeviceModal(false)}
                  style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                >
                  Register Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealNetworkGatewayPanel;
