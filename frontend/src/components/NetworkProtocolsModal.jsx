import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Server, 
  Globe, 
  Cpu, 
  Radio, 
  CheckCircle, 
  RefreshCw, 
  X, 
  Send,
  PlusCircle,
  Activity
} from 'lucide-react';
import { API_BASE } from '../config';

export default function NetworkProtocolsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('dhcp');

  // DHCP State
  const [dhcpLeases, setDhcpLeases] = useState([]);
  const [newMac, setNewMac] = useState('AA:BB:CC:DD:EE:11');
  const [newSlice, setNewSlice] = useState('low_latency');
  const [dhcpLoading, setDhcpLoading] = useState(false);

  // DNS State
  const [dnsRecords, setDnsRecords] = useState({});
  const [queryDomain, setQueryDomain] = useState('urllc.slice.5g');
  const [dnsResult, setDnsResult] = useState(null);
  const [newDomain, setNewDomain] = useState('');
  const [newIp, setNewIp] = useState('127.0.0.1');
  const [newPort, setNewPort] = useState(9104);
  const [newSliceName, setNewSliceName] = useState('Custom-Slice');

  // Multicast State
  const [multicastStatus, setMulticastStatus] = useState(null);
  const [broadcastMsg, setBroadcastMsg] = useState('SLICE_REBALANCE_SIGNAL');
  const [multicastLoading, setMulticastLoading] = useState(false);

  // ML State
  const [mlStatus, setMlStatus] = useState(null);
  const [selectedModel, setSelectedModel] = useState('decision_tree');
  const [mlLoading, setMlLoading] = useState(false);

  const fetchDhcp = async () => {
    try {
      setDhcpLoading(true);
      const res = await fetch(`${API_BASE}/api/dhcp/leases`);
      const data = await res.json();
      if (data.leases) setDhcpLeases(data.leases);
    } catch (err) {
      console.error('DHCP fetch error:', err);
    } finally {
      setDhcpLoading(false);
    }
  };

  const fetchDns = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dns/records`);
      const data = await res.json();
      if (data.records) setDnsRecords(data.records);
    } catch (err) {
      console.error('DNS fetch error:', err);
    }
  };

  const fetchMulticast = async () => {
    try {
      setMulticastLoading(true);
      const res = await fetch(`${API_BASE}/api/multicast/status`);
      const data = await res.json();
      if (data.multicast) setMulticastStatus(data.multicast);
    } catch (err) {
      console.error('Multicast fetch error:', err);
    } finally {
      setMulticastLoading(false);
    }
  };

  const fetchMl = async () => {
    try {
      setMlLoading(true);
      const res = await fetch(`${API_BASE}/api/ml/status`);
      const data = await res.json();
      setMlStatus(data);
      if (data.active_model) setSelectedModel(data.active_model);
    } catch (err) {
      console.error('ML fetch error:', err);
    } finally {
      setMlLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDhcp();
      fetchDns();
      fetchMulticast();
      fetchMl();
    }
  }, [isOpen]);

  const handleRequestDhcp = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dhcp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac: newMac, slice_type: newSlice }),
      });
      await res.json();
      fetchDhcp();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveDns = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dns/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: queryDomain }),
      });
      const data = await res.json();
      setDnsResult(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDnsRecord = async (e) => {
    e.preventDefault();
    if (!newDomain) return;
    try {
      await fetch(`${API_BASE}/api/dns/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: newDomain,
          ip: newIp,
          port: parseInt(newPort, 10),
          slice_name: newSliceName,
        }),
      });
      setNewDomain('');
      fetchDns();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBroadcast = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/multicast/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'orchestrator_node',
          event_type: 'BROADCAST_SIGNAL',
          message: broadcastMsg,
        }),
      });
      await res.json();
      fetchMulticast();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectModel = async (modelType) => {
    try {
      setSelectedModel(modelType);
      await fetch(`${API_BASE}/api/ml/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_type: modelType }),
      });
      fetchMl();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTrainAndCompare = async () => {
    try {
      setMlLoading(true);
      await fetch(`${API_BASE}/api/train`, { method: 'POST' });
      await fetchMl();
    } catch (err) {
      console.error(err);
    } finally {
      setMlLoading(false);
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
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(5px)',
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
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
          borderRadius: '14px',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-card)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-card-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#06b6d4'
            }}>
              <Network size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                5G/6G Advanced Protocols & ML Suite
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                DHCP IP Leasing, DNS Name Resolution, IPv4 Multicast & Multi-Model ML Benchmarking
              </p>
            </div>
          </div>

          <button 
            className="btn-secondary" 
            onClick={onClose} 
            style={{ padding: '6px', borderRadius: '8px', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '10px 24px 0 24px',
          borderBottom: '1px solid var(--border-card)',
          backgroundColor: 'var(--bg-card-subtle)'
        }}>
          {[
            { id: 'dhcp', label: 'DHCP Leasing', icon: Server },
            { id: 'dns', label: 'DNS Resolution', icon: Globe },
            { id: 'multicast', label: 'IPv4 Multicast', icon: Radio },
            { id: 'ml', label: 'ML Model Suite', icon: Cpu },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 16px',
                  fontSize: '0.82rem',
                  fontWeight: active ? '600' : '500',
                  color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  backgroundColor: active ? 'var(--bg-card)' : 'transparent',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: 'var(--bg-card)' }}>

          {/* TAB 1: DHCP */}
          {activeTab === 'dhcp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Request Form */}
              <div style={{
                backgroundColor: 'var(--bg-card-subtle)',
                padding: '16px 20px',
                borderRadius: '10px',
                border: '1px solid var(--border-card)'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
                  Simulate Virtual Node DHCP Request
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1', minWidth: '180px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                      MAC Address
                    </label>
                    <input
                      type="text"
                      value={newMac}
                      onChange={(e) => setNewMac(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-card)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>

                  <div style={{ width: '180px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                      Network Slice
                    </label>
                    <select
                      value={newSlice}
                      onChange={(e) => setNewSlice(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-card)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                      }}
                    >
                      <option value="low_latency">Low Latency (URLLC)</option>
                      <option value="high_bandwidth">High Bandwidth (eMBB)</option>
                      <option value="general">General (mMTC)</option>
                    </select>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={handleRequestDhcp}
                    style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    <Server size={14} /> Request IPv4 Lease
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={fetchDhcp}
                    style={{ padding: '8px 12px', cursor: 'pointer' }}
                    title="Refresh Leases"
                  >
                    <RefreshCw size={14} className={dhcpLoading ? 'spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Active Leases Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                    Active DHCP Leases ({dhcpLeases.length})
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Subnet Pool: 192.168.1.100 - 192.168.1.250 (TTL: 300s)
                  </span>
                </div>

                <div style={{
                  border: '1px solid var(--border-card)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-card)'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-card-subtle)', borderBottom: '1px solid var(--border-card)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px 14px' }}>MAC Address</th>
                        <th style={{ padding: '10px 14px' }}>Assigned IPv4</th>
                        <th style={{ padding: '10px 14px' }}>Target Slice</th>
                        <th style={{ padding: '10px 14px' }}>Leased Time</th>
                        <th style={{ padding: '10px 14px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dhcpLeases.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No active IP leases. Use the form above to assign a dynamic IP to a node.
                          </td>
                        </tr>
                      ) : (
                        dhcpLeases.map((l, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-card)' }}>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{l.mac}</td>
                            <td style={{ padding: '10px 14px', fontWeight: '600', color: 'var(--accent-primary)' }}>{l.ip}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{l.slice}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{l.leased_at}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: '600',
                                backgroundColor: 'var(--status-success-bg)',
                                color: 'var(--status-success)'
                              }}>
                                ACTIVE
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: DNS */}
          {activeTab === 'dns' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Lookup Card */}
              <div style={{
                backgroundColor: 'var(--bg-card-subtle)',
                padding: '16px 20px',
                borderRadius: '10px',
                border: '1px solid var(--border-card)'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
                  Resolve 5G Domain Name to Endpoint IP & Port
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={queryDomain}
                    onChange={(e) => setQueryDomain(e.target.value)}
                    placeholder="e.g. urllc.slice.5g"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-card)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button
                    className="btn-primary"
                    onClick={handleResolveDns}
                    style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    <Globe size={14} /> Resolve Domain
                  </button>
                </div>

                {dnsResult && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    backgroundColor: dnsResult.status === 'SUCCESS' ? 'var(--status-info-bg)' : 'var(--status-danger-bg)',
                    border: `1px solid ${dnsResult.status === 'SUCCESS' ? 'var(--status-info)' : 'var(--status-danger)'}`,
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)'
                  }}>
                    {dnsResult.status === 'SUCCESS' ? (
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <span><strong>Domain:</strong> {dnsResult.query}</span>
                        <span><strong>Resolved Target:</strong> {dnsResult.resolved_ip}:{dnsResult.resolved_port}</span>
                        <span><strong>Slice:</strong> {dnsResult.slice}</span>
                        <span><strong>Type:</strong> {dnsResult.record_type}</span>
                      </div>
                    ) : (
                      <div><strong>Resolution Failed:</strong> {dnsResult.error || 'NXDOMAIN'}</div>
                    )}
                  </div>
                )}
              </div>

              {/* DNS Records Directory */}
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Registered Slice DNS Records
                </div>
                <div style={{
                  border: '1px solid var(--border-card)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-card)'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-card-subtle)', borderBottom: '1px solid var(--border-card)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px 14px' }}>Domain Name</th>
                        <th style={{ padding: '10px 14px' }}>Type</th>
                        <th style={{ padding: '10px 14px' }}>Target IP</th>
                        <th style={{ padding: '10px 14px' }}>Target Port</th>
                        <th style={{ padding: '10px 14px' }}>Network Slice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(dnsRecords).map(([dom, rec], idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-card)' }}>
                          <td style={{ padding: '10px 14px', fontWeight: '600', color: 'var(--text-primary)' }}>{dom}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{rec.type}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{rec.ip}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{rec.port}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{rec.slice}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add Custom Record */}
              <form onSubmit={handleAddDnsRecord} style={{
                backgroundColor: 'var(--bg-card-subtle)',
                padding: '14px 18px',
                borderRadius: '8px',
                border: '1px solid var(--border-card)',
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                alignItems: 'flex-end'
              }}>
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Domain</label>
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="my-service.5g"
                    style={{ width: '100%', padding: '6px 10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-primary)' }}
                  />
                </div>
                <div style={{ width: '110px' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>IP</label>
                  <input
                    type="text"
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-primary)' }}
                  />
                </div>
                <div style={{ width: '70px' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Port</label>
                  <input
                    type="number"
                    value={newPort}
                    onChange={(e) => setNewPort(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-primary)' }}
                  />
                </div>
                <div style={{ width: '120px' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Slice</label>
                  <input
                    type="text"
                    value={newSliceName}
                    onChange={(e) => setNewSliceName(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-primary)' }}
                  />
                </div>
                <button type="submit" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <PlusCircle size={13} /> Add Record
                </button>
              </form>

            </div>
          )}

          {/* TAB 3: MULTICAST */}
          {activeTab === 'multicast' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Group Info & Broadcast Form */}
              <div style={{
                backgroundColor: 'var(--bg-card-subtle)',
                padding: '16px 20px',
                borderRadius: '10px',
                border: '1px solid var(--border-card)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      IPv4 Multicast Group Control
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Address: <strong style={{ color: 'var(--accent-primary)' }}>224.0.0.100:9999</strong> (IGMP v3 / Control Plane)
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    backgroundColor: 'var(--status-info-bg)',
                    color: 'var(--status-info)'
                  }}>
                    {multicastStatus?.subscribers?.length || 0} Connected Slices
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={broadcastMsg}
                    onChange={(e) => setBroadcastMsg(e.target.value)}
                    placeholder="Broadcast signal payload..."
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-card)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button
                    className="btn-primary"
                    onClick={handleBroadcast}
                    style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    <Send size={14} /> Send Broadcast
                  </button>
                </div>
              </div>

              {/* Subscribers & Transmission Log */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                {/* Subscribers */}
                <div style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-card)',
                  borderRadius: '8px',
                  padding: '14px'
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '10px' }}>
                    Subscribed Slice Nodes
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(multicastStatus?.subscribers || ['orchestrator_node', 'slice_node_1', 'slice_node_2']).map((sub, i) => (
                      <div key={i} style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        fontSize: '0.78rem',
                        fontFamily: 'monospace',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--status-success)' }} />
                        {sub}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Broadcast Log */}
                <div style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-card)',
                  borderRadius: '8px',
                  padding: '14px'
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '10px' }}>
                    Recent Multicast Signals
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                    {(!multicastStatus?.history || multicastStatus.history.length === 0) ? (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                        No broadcasts recorded yet. Use the field above to transmit a signal.
                      </div>
                    ) : (
                      multicastStatus.history.slice(-5).reverse().map((item, idx) => (
                        <div key={idx} style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-card-subtle)',
                          fontSize: '0.75rem',
                          border: '1px solid var(--border-card)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <strong style={{ color: 'var(--accent-primary)' }}>{item.event_type}</strong>
                            <span style={{ color: 'var(--text-muted)' }}>{item.timestamp}</span>
                          </div>
                          <div style={{ color: 'var(--text-secondary)' }}>{item.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: ML SUITE */}
          {activeTab === 'ml' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Algorithm Switcher */}
              <div style={{
                backgroundColor: 'var(--bg-card-subtle)',
                padding: '16px 20px',
                borderRadius: '10px',
                border: '1px solid var(--border-card)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Active Network Slice Traffic Predictor
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Select which ML architecture powers dynamic bandwidth adjustments
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={handleTrainAndCompare}
                    disabled={mlLoading}
                    style={{ padding: '7px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    <RefreshCw size={13} className={mlLoading ? 'spin' : ''} /> Train & Compare All
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  {[
                    { id: 'decision_tree', name: 'Decision Tree Regressor', desc: 'Fast non-linear recursive partitioning' },
                    { id: 'linear_regression', name: 'Linear Regression', desc: 'Standard parametric slope trendline' },
                    { id: 'random_forest', name: 'Random Forest Regressor', desc: 'Bootstrap aggregated decision trees' },
                    { id: 'gradient_boosting', name: 'Gradient Boosting Regressor', desc: 'Sequential residual error minimization' },
                  ].map((algo) => {
                    const isSelected = selectedModel === algo.id;
                    return (
                      <div
                        key={algo.id}
                        onClick={() => handleSelectModel(algo.id)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-card)',
                          backgroundColor: isSelected ? 'var(--status-info-bg)' : 'var(--bg-card)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: '600', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                            {algo.name}
                          </span>
                          {isSelected && <CheckCircle size={15} color="var(--accent-primary)" />}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {algo.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Benchmark Comparison Table */}
              {mlStatus?.comparison && Object.keys(mlStatus.comparison).length > 0 ? (
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '10px' }}>
                    Comparative Model Accuracy Benchmarks ($R^2$ Fit Score & MSE)
                  </div>
                  <div style={{
                    border: '1px solid var(--border-card)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: 'var(--bg-card)'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-card-subtle)', borderBottom: '1px solid var(--border-card)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '10px 14px' }}>Network Slice</th>
                          <th style={{ padding: '10px 14px' }}>Decision Tree</th>
                          <th style={{ padding: '10px 14px' }}>Linear Regression</th>
                          <th style={{ padding: '10px 14px' }}>Random Forest</th>
                          <th style={{ padding: '10px 14px' }}>Gradient Boosting</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(mlStatus.comparison).map(([sliceKey, algoData]) => (
                          <tr key={sliceKey} style={{ borderBottom: '1px solid var(--border-card)' }}>
                            <td style={{ padding: '10px 14px', fontWeight: '600', textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                              {sliceKey.replace('_', ' ')}
                            </td>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--slice-low-latency)' }}>
                              R²: {algoData.decision_tree?.r2_score ?? '0.00'} (MSE: {algoData.decision_tree?.mse ?? '0.0'})
                            </td>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--slice-high-bandwidth)' }}>
                              R²: {algoData.linear_regression?.r2_score ?? '0.00'} (MSE: {algoData.linear_regression?.mse ?? '0.0'})
                            </td>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--slice-general)' }}>
                              R²: {algoData.random_forest?.r2_score ?? '0.00'} (MSE: {algoData.random_forest?.mse ?? '0.0'})
                            </td>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--status-warning)' }}>
                              R²: {algoData.gradient_boosting?.r2_score ?? '0.00'} (MSE: {algoData.gradient_boosting?.mse ?? '0.0'})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '24px',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-card)',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem'
                }}>
                  <Activity size={24} style={{ margin: '0 auto 8px auto', opacity: 0.6 }} />
                  <div>No multi-model benchmark comparison generated yet.</div>
                  <div style={{ fontSize: '0.74rem', marginTop: '4px' }}>
                    Click <strong>"Train & Compare All"</strong> after running traffic for a few seconds to train all models against SQLite logs.
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
