import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import SliceCards from './components/SliceCards';
import MetricsCharts from './components/MetricsCharts';
import StaticSliders from './components/StaticSliders';
import TrafficTweaker from './components/TrafficTweaker';
import ActionTerminal from './components/ActionTerminal';
import AnalyticsModal from './components/AnalyticsModal';
import NetworkProtocolsModal from './components/NetworkProtocolsModal';
import ChatbotWidget from './components/ChatbotWidget';

import { API_BASE } from './config';

const Dashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [allocations, setAllocations] = useState({
    low_latency: 30,
    high_bandwidth: 50,
    general: 20
  });
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('real_network');
  const [activeInterface, setActiveInterface] = useState('Wi-Fi');
  const [interfaces, setInterfaces] = useState([]);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('netslice-theme');
    return (saved === 'slate' || !saved) ? 'white' : saved;
  });
  const [strategy, setStrategy] = useState('static');
  const [mlInfo, setMlInfo] = useState(null);
  const [isRetraining, setIsRetraining] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isProtocolsOpen, setIsProtocolsOpen] = useState(false);
  const [totalSnapshots, setTotalSnapshots] = useState(0);
  const [bannerAlert, setBannerAlert] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('netslice-theme', theme);
  }, [theme]);

  // Fetch initial system status & network interfaces
  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      const data = await res.json();
      setIsRunning(data.is_running);
      setStrategy(data.strategy);
      if (data.mode) setMode(data.mode);
      if (data.active_interface) setActiveInterface(data.active_interface);
      if (data.detected_interfaces) setInterfaces(data.detected_interfaces);
      setMlInfo(data.ml_info);
      if (data.custom_static) {
        setAllocations(data.custom_static);
      }
    } catch (e) {
      console.error('Error fetching initial status:', e);
    }
  };

  const fetchInterfaces = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/network/interfaces`);
      const data = await res.json();
      if (data.status === 'success') {
        setInterfaces(data.interfaces || []);
      }
    } catch (e) {
      // offline
    }
  };

  // Fetch snapshot count
  const fetchAnalyticsCount = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/analytics/summary`);
      const data = await res.json();
      if (data.status === 'success' && data.summary) {
        setTotalSnapshots(data.summary.total_records || 0);
      }
    } catch (e) {
      // ignore if offline
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchInterfaces();
    fetchAnalyticsCount();
  }, []);

  // Poll metrics every 1 second when active or check logs
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/metrics`);
        const data = await res.json();
        
        if (data.status === 'active' && data.data) {
          setMetrics(data.data.slices);
          setHistory(data.history || []);
          if (data.allocations) setAllocations(data.allocations);
          if (data.logs) setLogs(data.logs);
          if (data.ml_info) setMlInfo(data.ml_info);
          if (data.mode) setMode(data.mode);
          if (data.interface) setActiveInterface(data.interface);
          setIsRunning(true);
        } else if (data.status === 'idle') {
          if (data.logs) setLogs(data.logs);
          if (data.ml_info) setMlInfo(data.ml_info);
          if (data.mode) setMode(data.mode);
          if (data.interface) setActiveInterface(data.interface);
        }
      } catch (e) {
        // backend offline
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle Mode Change
  const handleModeChange = async (newMode) => {
    setMode(newMode);
    try {
      await fetch(`${API_BASE}/api/network/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode, interface: activeInterface })
      });
      setBannerAlert({ 
        type: 'info', 
        text: `Switched operational mode to ${newMode === 'real_network' ? 'REAL NETWORK (Wi-Fi Sockets)' : 'SYNTHETIC SIMULATION'}` 
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleInterfaceChange = async (newIface) => {
    setActiveInterface(newIface);
    try {
      await fetch(`${API_BASE}/api/network/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, interface: newIface })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Strategy Change
  const handleStrategyChange = (newStrategy) => {
    setStrategy(newStrategy);
  };

  // Start Simulation or Real Network
  const handleStart = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          strategy,
          mode,
          interface: activeInterface,
          custom_static: allocations
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setIsRunning(true);
        setBannerAlert({ 
          type: 'success', 
          text: mode === 'real_network' 
            ? `Real Network live on ${activeInterface} (Sockets Ports 9101-9103) with ${strategy.toUpperCase()}` 
            : `Simulation running with ${strategy.toUpperCase()} strategy` 
        });
        fetchAnalyticsCount();
      } else {
        setBannerAlert({ type: 'error', text: data.message });
      }
    } catch (e) {
      console.error(e);
      setBannerAlert({ type: 'error', text: 'Failed to start engine. Is backend running?' });
    } finally {
      setTimeout(() => setBannerAlert(null), 4000);
    }
  };

  // Stop Simulation
  const handleStop = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stop`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        setIsRunning(false);
        setBannerAlert({ type: 'info', text: 'Simulation stopped. Telemetry saved to SQLite database.' });
        fetchAnalyticsCount();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setBannerAlert(null), 4000);
    }
  };

  // Retrain AI Model
  const handleRetrain = async () => {
    setIsRetraining(true);
    try {
      const res = await fetch(`${API_BASE}/api/train`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMlInfo(data.details);
        setBannerAlert({ type: 'success', text: `AI Decision Tree retrained on ${data.details.sample_count} historical SQLite snapshots!` });
      } else {
        setBannerAlert({ type: 'error', text: data.message });
      }
    } catch (e) {
      console.error(e);
      setBannerAlert({ type: 'error', text: 'Error connecting to ML training endpoint' });
    } finally {
      setIsRetraining(false);
      setTimeout(() => setBannerAlert(null), 5000);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', minHeight: '100vh' }}>
      
      {/* Top Navigation Bar */}
      <Navbar
        isRunning={isRunning}
        strategy={strategy}
        onStrategyChange={handleStrategyChange}
        mode={mode}
        onModeChange={handleModeChange}
        theme={theme}
        onThemeChange={setTheme}
        activeInterface={activeInterface}
        onInterfaceChange={handleInterfaceChange}
        interfaces={interfaces}
        onStart={handleStart}
        onStop={handleStop}
        onRetrain={handleRetrain}
        isRetraining={isRetraining}
        mlInfo={mlInfo}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
        onOpenProtocols={() => setIsProtocolsOpen(true)}
        totalSnapshots={totalSnapshots}
      />

      {/* Alert Notification Toast */}
      {bannerAlert && (
        <div style={{
          padding: '10px 18px',
          borderRadius: '8px',
          marginBottom: '20px',
          background: bannerAlert.type === 'success' 
            ? 'rgba(16, 185, 129, 0.15)' 
            : bannerAlert.type === 'error' 
            ? 'rgba(244, 63, 94, 0.15)' 
            : 'rgba(56, 189, 248, 0.15)',
          border: `1px solid ${
            bannerAlert.type === 'success' 
              ? 'rgba(16, 185, 129, 0.4)' 
              : bannerAlert.type === 'error' 
              ? 'rgba(244, 63, 94, 0.4)' 
              : 'rgba(56, 189, 248, 0.4)'
          }`,
          color: bannerAlert.type === 'success' 
            ? 'var(--accent-emerald)' 
            : bannerAlert.type === 'error' 
            ? 'var(--accent-rose)' 
            : 'var(--accent-cyan)',
          fontSize: '0.85rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>{bannerAlert.text}</span>
          <button 
            onClick={() => setBannerAlert(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Real-Time Slice Telemetry Cards */}
      <SliceCards 
        metrics={metrics} 
        allocations={allocations} 
      />

      {/* 2. Interactive Configuration Sliders (100 Mbps Pool Allocation) */}
      <StaticSliders
        activeAllocations={allocations}
        onSaveAllocations={(newAlloc) => setAllocations(newAlloc)}
        isStaticStrategy={strategy === 'static'}
      />

      {/* 3. Traffic Profile Tweaker & Chaos Engine */}
      <TrafficTweaker
        isRunning={isRunning}
        onTriggerScenario={() => {
          // Trigger immediate refresh of telemetry
        }}
      />

      {/* 4. Live Moving Time-Series Charts (Recharts) */}
      <MetricsCharts 
        history={history} 
      />

      {/* 5. Action Log / Scrolling Terminal Window */}
      <ActionTerminal 
        logs={logs} 
      />

      {/* 6. SQLite Analytics & Reporting Modal */}
      <AnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        onRetrain={handleRetrain}
        isRetraining={isRetraining}
      />

      {/* 6b. Advanced Protocols (DHCP, DNS, Multicast, ML) Modal */}
      <NetworkProtocolsModal
        isOpen={isProtocolsOpen}
        onClose={() => setIsProtocolsOpen(false)}
      />

      {/* 7. Bottom-Right Integrated AI Assistant Bot */}
      <ChatbotWidget
        isRunning={isRunning}
        strategy={strategy}
        metrics={metrics}
      />

    </div>
  );
};

export default Dashboard;
