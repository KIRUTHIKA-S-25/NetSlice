# 🎨 NetSlice Frontend Architecture & Networking Visualization Guide

---

## 1. Overview of Frontend Architecture
The frontend of **NetSlice** serves as the **Operational Management Dashboard & Telemetry Visualizer** for next-generation network slicing. Built using **React 19, Vite, Lucide Icons, and Recharts**, it delivers a high-performance, responsive, **Glassmorphism-styled UI** tailored for real-time network monitoring.

In carrier-grade telecommunications, operators cannot manage network slices through raw terminal logs. The NetSlice frontend bridges this gap by providing:
1. **1-Second Live Metric Polling**: Continuously ingests streaming JSON snapshots from the FastAPI backend.
2. **Interactive Traffic Shaping Controls**: Allows administrators to dynamically rebalance bandwidth pools via responsive sliders.
3. **Chaos Engineering Triggers**: Injects real-world network surges (4K video bursts, DoS floods, autonomous vehicle spikes).
4. **Protocols Diagnostic Suite**: An interactive control interface for DHCP IP leases, 5G DNS queries, Multicast group signals, and ML model benchmarking.
5. **Context-Aware AI Assistant**: A bottom-right floating chatbot offering real-time network diagnosis and advice.

---

## 2. Directory Structure & File-by-File Breakdown

```
frontend/
├── index.html                  # HTML entry point with meta viewport & Google Fonts
├── vite.config.js              # Vite dev server configuration & /api reverse-proxy
├── nginx.conf                  # Production reverse-proxy configuration for Docker
├── Dockerfile                  # Multi-stage production build (Node build -> Nginx alpine)
├── package.json                # Project dependencies (React 19, Recharts, Lucide-React)
└── src/
    ├── main.jsx                # React DOM root render entry point
    ├── App.jsx                 # Top-level application component
    ├── index.css               # Global CSS design tokens, themes (Slate & White), glassmorphism
    ├── App.css                 # Application-specific layout styles
    ├── config.js               # Centralized API Base URL configuration
    ├── Dashboard.jsx           # Main operational dashboard & state controller
    └── components/             # Modular UI components
        ├── Navbar.jsx          # Header with Wi-Fi hardware badge, mode & strategy switches
        ├── SliceCards.jsx      # Live slice cards (URLLC, eMBB, mMTC) with SLA health badges
        ├── MetricsCharts.jsx   # Live moving time-series charts (Recharts)
        ├── StaticSliders.jsx   # Interactive 100 Mbps bandwidth allocation sliders
        ├── TrafficTweaker.jsx  # Chaos engineering panel (DoS, 4K burst, fleet surge)
        ├── ActionTerminal.jsx  # Real-time scrolling audit terminal
        ├── AnalyticsModal.jsx  # SQLite historical telemetry & QoS violation viewer
        ├── NetworkProtocolsModal.jsx # DHCP, DNS, Multicast & ML benchmark modal
        └── ChatbotWidget.jsx   # Context-aware floating AI chatbot widget
```

---

### Detailed File Specifications

#### 1. `frontend/vite.config.js`
- **Purpose**: Configuration file for the Vite build tool and development server.
- **How it is Implemented**:
  - Sets up the React plugin (`@vitejs/plugin-react`).
  - Configures the development server with host `127.0.0.1` on port `5173`.
  - **Reverse Proxy**: Maps all `/api` requests to `http://127.0.0.1:8000`.
- **Computer Networks Concepts**:
  - **Reverse Proxying**: Forwarding client requests to backend service ports on the local loopback interface.
  - **Cross-Origin Resource Sharing (CORS) Avoidance**: By using a reverse proxy, the browser sees requests originating from the same host, eliminating CORS preflight overhead.

---

#### 2. `frontend/src/config.js`
- **Purpose**: Centralizes the backend API endpoint configuration across all frontend components.
- **How it is Implemented**:
  - Checks if `import.meta.env.VITE_API_URL` is defined (for custom deployments).
  - In local development (`import.meta.env.DEV`), defaults to an empty string `''` to leverage Vite's reverse proxy directly (`/api/...`).
  - Fallback connects directly to `http://127.0.0.1:8000`.
- **Computer Networks Concepts**:
  - API Gateway Addressing & Environment Decoupling.

---

#### 3. `frontend/src/Dashboard.jsx`
- **Purpose**: The primary operational dashboard component managing state, background polling, and component synchronization.
- **How it is Implemented**:
  - **1-Second Polling Loop**: Uses `setInterval` inside `useEffect` to fetch `GET /api/metrics` every 1 second:
    - Updates slice metrics (throughput, latency, packet drops, utilization).
    - Updates moving historical arrays for charts.
    - Synchronizes the active strategy, operational mode, and hardware interfaces.
  - **Interface Refresh Loop**: Polls `GET /api/network/interfaces` every 3 seconds to catch hardware changes.
  - **Offline Detection**: Reads `is_online` from backend responses. If the network drops, renders a prominent red alert banner: *"Physical Network Disconnected — Real physical telemetry and slice traffic are halted (0.0 Mbps)"*.
  - **Control Handlers**:
    - `handleStrategyChange`: Dispatches `POST /api/strategy` to dynamically update allocation policy.
    - `handleModeChange`: Toggles between `simulation` and `real_network`.
    - `handleStart` / `handleStop`: Starts and stops the backend telemetry engine.
- **Computer Networks Concepts**:
  - Real-Time Network Telemetry Ingestion.
  - Fault Detection & Network Disconnection State Machine.

---

#### 4. `frontend/src/components/Navbar.jsx`
- **Purpose**: Header navigation displaying connection status, real physical hardware telemetry, strategy selectors, and modal triggers.
- **How it is Implemented**:
  - **Real Wi-Fi Hardware Badge**: Reads detected Wi-Fi details from `interfaces` array and displays the real SSID name (e.g. `Wi-Fi: "Magic"`) and signal percentage (`95%+`).
  - **Status Indicator**: Renders an animated pulsing badge (`Live Monitoring` or `Network Disconnected`).
  - **Strategy Selector**: Dropdown allowing the operator to switch between `Static`, `Rule-Based`, and `AI-Assisted` policies.
  - **Modal Action Triggers**: Buttons to open the Analytics and Network Protocols dialogs.
- **Computer Networks Concepts**:
  - **WLAN Radio Telemetry Display (SSID, Signal Strength, 802.11 Link Quality)**.
  - **Control Plane Slicing Policy Selection**.

---

#### 5. `frontend/src/components/SliceCards.jsx`
- **Purpose**: Renders the 3 core 5G slice telemetry cards with live gauges, SLA targets, and health badges.
- **How it is Implemented**:
  - Displays:
    - **URLLC (Low-Latency)**: Accent purple, port `9101`, Target: < 15 ms latency.
    - **eMBB (High-Bandwidth)**: Accent cyan, port `9102`, Target: > 40 Mbps throughput.
    - **mMTC (General Web)**: Accent blue, port `9103`, Target: Best-effort delivery.
  - **Throughput Gauge**: Visual progress bar comparing current throughput against the dynamically allocated slice capacity (`throughput / allocated Mbps`).
  - **SLA Health Badge**: Evaluates packet drops and utilization:
    - `Healthy` (Green Checkmark): Zero drops and utilization < 90%.
    - `Packet Drops` (Red Alert): Rendered when token-bucket drops packets.
    - `Offline` (Rose Badge): Rendered when physical Wi-Fi/Internet is disconnected.
- **Computer Networks Concepts**:
  - **5G Slicing Service Tiers (URLLC, eMBB, mMTC)**.
  - **Quality of Service (QoS) & SLA Health Verification**.
  - **Capacity Utilization & Bandwidth Saturation Monitoring**.

---

#### 6. `frontend/src/components/MetricsCharts.jsx`
- **Purpose**: High-frequency real-time moving time-series charts visualizing network performance.
- **How it is Implemented**:
  - Utilizes **Recharts** (`ResponsiveContainer`, `LineChart`, `Line`, `Tooltip`, `XAxis`, `YAxis`).
  - Displays two synchronized real-time charts over the last 60 seconds:
    1. **Throughput Curves (Mbps)**: Independent lines tracking URLLC, eMBB, and mMTC throughput.
    2. **Latency (ms) & Packet Drop Curves**: Highlights latency spikes and shows red bars during buffer drops.
  - Configured with custom CSS glassmorphism tooltips for precise point-in-time packet inspection.
- **Computer Networks Concepts**:
  - **Network Time-Series Telemetry Analysis**.
  - **Throughput vs. Latency Trade-Off Visualization**.

---

#### 7. `frontend/src/components/StaticSliders.jsx`
- **Purpose**: Interactive bandwidth allocation control allowing operators to partition the 100 Mbps pool.
- **How it is Implemented**:
  - Features three synchronized range sliders (`<input type="range">`) for URLLC, eMBB, and general slices.
  - **Auto-Normalize Algorithm**: Sums total slider values; if greater or less than 100 Mbps, scales them proportionally so the total pool always equals 100 Mbps.
  - **Presets**: Offers one-click carrier presets:
    - *Balanced*: 30M / 50M / 20M
    - *Streaming Focus*: 20M / 65M / 15M
    - *Ultra-Reliable*: 45M / 35M / 20M
  - Dispatches `POST /api/slices/configure_static` to update backend token buckets.
- **Computer Networks Concepts**:
  - **Dynamic Bandwidth Allocation (DBA)**.
  - **Spectrum / Capacity Pool Partitioning**.

---

#### 8. `frontend/src/components/TrafficTweaker.jsx`
- **Purpose**: Chaos engineering and traffic injection panel to evaluate network slicing performance under stress.
- **How it is Implemented**:
  - Provides quick scenario injection buttons:
    - **4K Video Burst**: Sends `POST /api/simulate_scenario` with `streaming_burst` (82 Mbps on eMBB).
    - **DoS Attack**: Injects 72 Mbps flood on general slice port 9103.
    - **Autonomous Fleet Surge**: Surges URLLC port 9101 to 46 Mbps.
    - **Restore Baseline**: Restores normal baseline profiles.
  - Custom Spike Slider: Allows multiplying any selected slice's traffic by 1.5x–4.0x.
- **Computer Networks Concepts**:
  - **Network Chaos Testing & Stress Testing**.
  - **Denial of Service (DoS) Traffic Emulation**.
  - **Bursty Traffic Generation & Buffer Congestion Simulation**.

---

#### 9. `frontend/src/components/ActionTerminal.jsx`
- **Purpose**: Real-time scrolling audit terminal displaying administrative and system events.
- **How it is Implemented**:
  - Auto-scrolls to the newest log as events stream in from SQLite.
  - Color-codes log levels:
    - `AI-ACTION` (Cyan): Reallocation decisions made by machine learning models.
    - `WARNING` (Red): QoS violations and packet drop events.
    - `HANDOVER` (Amber): Wi-Fi network mobility changes.
    - `DISCONNECT` (Rose): Internet loss events.
    - `CONFIG` (Emerald): Slider quota updates.
- **Computer Networks Concepts**:
  - **Network Event Logging & Syslog / Audit Trail Emulation**.

---

#### 10. `frontend/src/components/AnalyticsModal.jsx`
- **Purpose**: Persistent reporting dialog querying historical SQLite database snapshots.
- **How it is Implemented**:
  - Queries `GET /api/analytics/summary` to show total records logged, average utilization, and QoS violation counts.
  - Queries `GET /api/history` to show historical tabular telemetry with slice-based filtering.
  - Contains a **"Retrain AI Model"** button dispatching `POST /api/train` to rebuild Scikit-Learn models on historical data.
- **Computer Networks Concepts**:
  - Network Performance Historical Reporting.
  - Offline Model Training from Historical Network Traces.

---

#### 11. `frontend/src/components/NetworkProtocolsModal.jsx`
- **Purpose**: Advanced networking protocols interactive control center.
- **How it is Implemented**:
  - **DHCP Tab**: Interacts with `/api/dhcp/*` to view the active 192.168.1.100–250 lease table and submit dynamic IP requests with custom MAC addresses.
  - **DNS Tab**: Interacts with `/api/dns/*` to resolve 5G slice domain names (`urllc.slice.5g` &rarr; `127.0.0.1:9101`) and add new DNS records.
  - **Multicast Tab**: Interacts with `/api/multicast/*` to inspect IGMP group `224.0.0.100:9999` subscribers and broadcast control signals.
  - **ML Benchmarks Tab**: Queries `/api/ml/status` to compare R² scores and MSE across Decision Trees, Linear Regression, Random Forests, and Gradient Boosting, with one-click model selection.
- **Computer Networks Concepts**:
  - **DHCP IPv4 Dynamic Lease Management (RFC 2131)**.
  - **DNS FQDN Service Resolution (RFC 1035)**.
  - **IGMP Multicast Group Communication (RFC 1112)**.
  - **Machine Learning Evaluation for Network Optimization**.

---

#### 12. `frontend/src/components/ChatbotWidget.jsx`
- **Purpose**: Floating context-aware assistant helping operators troubleshoot network performance.
- **How it is Implemented**:
  - Floating trigger button in the bottom-right corner with badge indicator.
  - Dispatches user questions to `POST /api/chat`.
  - Supports Markdown rendering for structured network diagnostics, recommendations, and quick-prompt chips.
- **Computer Networks Concepts**:
  - AI-Driven Network Diagnostics & Automated Helpdesk.

---

## 3. Computer Networks (CN) Concepts Visualized in Frontend

| Networking Concept | Frontend Component | How It Is Visualized / Managed |
|---|---|---|
| **Quality of Service (QoS)** | `SliceCards.jsx` | Live SLA health badges (Healthy vs Packet Drops vs High Load). |
| **Bandwidth Allocation** | `StaticSliders.jsx` | Dynamic 100 Mbps pool partitioning across URLLC, eMBB, and mMTC. |
| **Real-Time Telemetry** | `MetricsCharts.jsx` | Moving 60-second curves of Throughput (Mbps) and Latency (ms). |
| **Traffic Congestion** | `TrafficTweaker.jsx` | Real-time injection of 4K bursts, DoS floods, and fleet surges. |
| **WLAN Radio Telemetry** | `Navbar.jsx` | Real-time SSID name, signal percentage, and link speed display. |
| **Network Audit Trail** | `ActionTerminal.jsx` | Color-coded streaming logs of QoS warnings, handovers, and AI actions. |
| **IPv4 DHCP Provisioning** | `NetworkProtocolsModal.jsx` | Dynamic lease requests, IP-to-MAC bindings, and lease duration. |
| **5G DNS Resolution** | `NetworkProtocolsModal.jsx` | Domain lookups for `urllc.slice.5g` resolving to edge IP:Port sockets. |
| **IGMP Multicast** | `NetworkProtocolsModal.jsx` | Broadcast signaling to Class D IP `224.0.0.100:9999`. |
| **Reverse Proxy / CORS** | `vite.config.js` | Dev server proxy routing `/api` calls directly to backend port 8000. |
