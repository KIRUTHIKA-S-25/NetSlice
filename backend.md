# ⚙️ NetSlice Backend Architecture & Networking Concepts Guide

---

## 1. Overview of Backend Architecture
The backend of **NetSlice** acts as the **Intelligent Control and Data Plane** for next-generation 5G/6G network slicing. Built using **Python 3.11+ and FastAPI**, it bridges real operating system network telemetry with software-defined socket servers, machine learning regression engines, and traditional networking protocols.

Unlike generic web servers that only store and retrieve database records, this backend actively:
1. Opens and binds low-level **TCP/UDP sockets** on physical network ports (`9101`, `9102`, `9103`, `9105`).
2. Enforces **Token-Bucket rate-limiting algorithms** to physically shape bandwidth.
3. Probes the physical OS network adapter (`psutil`) and wireless radio state (`netsh wlan`).
4. Runs **machine learning regression models** to forecast traffic load and reallocate bandwidth.
5. Operates autonomous networking daemons for **DHCP IPv4 leasing**, **5G Slice DNS resolution**, and **IGMP Multicast group control**.

---

## 2. Directory Structure & File-by-File Breakdown

```
backend/
├── main.py                     # Central FastAPI application & REST endpoint orchestrator
├── real_network.py             # Physical NIC ingestion, Token-Bucket shaper & socket servers
├── database.py                 # SQLAlchemy ORM models & SQLite time-series persistence
├── ai_assistant.py             # Context-aware LLM chatbot with offline fallback
├── requirements.txt            # Python dependencies (FastAPI, scikit-learn, psutil, etc.)
├── Dockerfile                  # Containerization specification for backend
└── simulation/                 # Slicing, ML, and Networking Protocol Engines
    ├── slices.py               # Data structures and SLA definitions for 5G slices
    ├── allocation.py           # Resource allocation engine (Static, Rule-Based, AI-Assisted)
    ├── ml_engine.py            # Multi-model scikit-learn ML suite (DT, LR, RF, GBDT)
    ├── traffic_generator.py    # Synthetic Poisson packet generator for simulation mode
    ├── monitor.py              # Background 1-second telemetry metrics collector thread
    ├── dhcp.py                 # Dynamic Host Configuration Protocol server
    ├── dns.py                  # 5G Slice Domain Name System resolution server
    └── multicast.py            # IPv4 Multicast (IGMP) group signaling manager
```

---

### Detailed File Specifications

#### 1. `backend/main.py`
- **Purpose**: The central API gateway and orchestration engine connecting the frontend React dashboard with all backend background threads and algorithms.
- **How it is Implemented**:
  - Initializes FastAPI with CORS middleware.
  - Registers startup lifecycle hooks (`@app.on_event("startup")`) to automatically initialize database tables and launch the real-time physical Wi-Fi monitoring engine.
  - Exposes REST endpoints:
    - `/api/status`: System state, detected physical interfaces, and active ML model.
    - `/api/metrics`: High-frequency 1-second stream of slice throughput, latency, drops, utilization, and audit logs.
    - `/api/strategy`: Dynamic switching of slicing algorithms (`static`, `rule_based`, `ai_assisted`) without interrupting active socket threads.
    - `/api/slices/configure_static`: Rebalancing the 100 Mbps pool from user sliders.
    - `/api/simulate_scenario` & `/api/simulate_spike`: Chaos traffic injection.
    - `/api/dhcp/*`, `/api/dns/*`, `/api/multicast/*`: Networking protocol management.
    - `/api/ml/*` & `/api/train`: ML model selection and historical model retraining.
    - `/api/chat`: Natural language context-aware AI assistant.
- **Computer Networks Concepts**:
  - RESTful HTTP/1.1 API over TCP port 8000.
  - Separation of Control Plane (API routes) and Data Plane (underlying sockets).

---

#### 2. `backend/real_network.py`
- **Purpose**: The core data plane module. Ingests real physical Wi-Fi network adapter counters, measures live internet latency, and enforces Token-Bucket socket shaping.
- **How it is Implemented**:
  - **`TokenBucketShaper` Class**: Implements mathematical token replenishment `tokens = min(capacity, tokens + elapsed * rate)`. Packets are only allowed through if sufficient tokens exist; otherwise, packets are dropped.
  - **`RealNetworkSlice` Class**: Represents an active 5G slice bound to a specific port, token bucket, and packet counters.
  - **`RealNetworkManager` Class**: Spawns multi-threaded background workers:
    - `_traffic_worker_loop`: Pushes real 1400-byte UDP packets through the Token-Bucket shaper to local ports `9101`–`9103` every 100ms.
    - `_tcp_server_loop`: Runs a concurrent TCP stream server on port `9105`.
    - `_monitor_loop`: Samples physical adapter I/O counters via `psutil.net_io_counters()`, measures true internet RTT ping via TCP socket handshakes, and logs snapshots to SQLite.
  - **Disconnection Handling**: Probes live DNS endpoints (`8.8.8.8:53`, `1.1.1.1:53`). If offline, pauses socket workers, drops throughput to strictly `0.0 Mbps`, and records `[NETWORK DISCONNECTED]` logs.
  - **Handover Detection**: Periodically parses `netsh wlan show interfaces` for SSID changes, dynamically adjusting slice allocations to match the new radio link speed.
- **Computer Networks Concepts**:
  - **Token-Bucket Rate Limiting (RFC 2697 / RFC 2698)**.
  - **TCP Handshake RTT (Round Trip Time) Measurement**.
  - **BSD Sockets (`socket.SOCK_STREAM` for TCP, `socket.SOCK_DGRAM` for UDP)**.
  - **Maximum Transmission Unit (MTU)**: Packet size set to 1400 bytes to prevent IP fragmentation.
  - **Wireless LAN Telemetry (IEEE 802.11 link rates, RSSI signal quality, channel frequencies)**.

---

#### 3. `backend/database.py`
- **Purpose**: Persistent storage layer managing time-series network metrics, QoS violation audit trails, and administrative action logs.
- **How it is Implemented**:
  - Configured with **SQLAlchemy 2.0 ORM** connected to local SQLite (`network_logs.db`).
  - **`NetworkLog` Table**: Stores timestamp, slice name, throughput (Mbps), packets processed, packets dropped, latency (ms), capacity utilization (%), allocated bandwidth, and operational strategy every 1 second.
  - **`ActionLog` Table**: Stores timestamp, log level (`INFO`, `WARNING`, `AI-ACTION`, `HANDOVER`, `DISCONNECT`), and event descriptions.
  - Provides thread-safe session factories (`sessionmaker`) with automatic rollbacks and connection pooling.
- **Computer Networks Concepts**:
  - Network Performance Telemetry & Time-Series Logging.
  - QoS Audit Trail and SLA Violation History Tracking.

---

#### 4. `backend/ai_assistant.py`
- **Purpose**: Natural-language operational assistant capable of diagnosing connection health, slice packet drops, and bandwidth reallocations.
- **How it is Implemented**:
  - Pulls current telemetry state directly from memory (`simulation_state`) and queries the last 20 SQLite snapshots.
  - If a Google Gemini API key is configured in `.env`, constructs a rich system prompt containing live network telemetry and queries the LLM.
  - If offline or no key is provided, falls back to a deterministic rule-based heuristic parser that answers questions about Wi-Fi signal, packet drops, bandwidth splits, and slice health.
- **Computer Networks Concepts**:
  - Autonomous Network Diagnostics & Cognitive Network Management.

---

#### 5. `backend/simulation/slices.py`
- **Purpose**: Defines standardized data structures and SLA targets for 5G service tiers.
- **How it is Implemented**:
  - Defines the `Slice` class containing `allocated_bandwidth`, `current_usage`, `packet_queue`, `latency_sum`, `packets_processed`, and `packets_dropped`.
  - Instantiates the 3 standard 5G slices:
    - `low_latency` (URLLC): SLA target < 15 ms latency, highest QoS priority.
    - `high_bandwidth` (eMBB): SLA target > 40 Mbps, bulk data transfer.
    - `general` (mMTC): SLA target best-effort delivery for IoT/browsing.
- **Computer Networks Concepts**:
  - **3GPP 5G Network Slicing Specifications (TS 23.501)**.
  - **QoS Class Identifiers (QCI) & 5G QoS Identifiers (5QI)**.

---

#### 6. `backend/simulation/allocation.py`
- **Purpose**: The Resource Allocation Engine that executes dynamic bandwidth rebalancing across the 100 Mbps pool.
- **How it is Implemented**:
  - **`allocate_static()`**: Strictly enforces static allocations configured by user sliders.
  - **`allocate_rule_based(snapshot)`**: Reactive heuristic algorithm:
    - If URLLC utilization > 85% or dropped packets > 0: Borrows bandwidth from general slice or eMBB.
    - If eMBB utilization > 90%: Borrows idle headroom from general slice.
    - If traffic stabilizes: Returns borrowed bandwidth to baseline.
  - **`allocate_ai_assisted(prediction)`**: Proactive allocation:
    - Receives predicted demand vectors from `MLEngine` and shifts bandwidth proportionally before queues fill up.
- **Computer Networks Concepts**:
  - **Dynamic Bandwidth Allocation (DBA)**.
  - **SLA Enforcement & Congestion Avoidance**.
  - **Proactive vs. Reactive Network Control**.

---

#### 7. `backend/simulation/ml_engine.py`
- **Purpose**: Multi-model Machine Learning suite for traffic forecasting and model benchmarking.
- **How it is Implemented**:
  - Implements 4 regression algorithms via Scikit-Learn:
    1. **Decision Tree Regressor** (`max_depth=5`): Fast, interpretable non-linear splits.
    2. **Linear Regression**: Baseline parametric model.
    3. **Random Forest Regressor** (`n_estimators=15`): Ensemble bagging to reduce prediction variance.
    4. **Gradient Boosting Regressor** (`n_estimators=15`): Sequential boosting to minimize residual errors.
  - `train_from_db()`: Extracts historical slice snapshots from SQLite, builds feature matrices (lagged throughput, drops, latency), trains all 4 models, and evaluates **R² Score** and **Mean Squared Error (MSE)**.
  - `predict_demand()`: Predicts traffic demand for the next 10 seconds.
- **Computer Networks Concepts**:
  - Predictive Traffic Engineering (PTE).
  - Machine Learning for Autonomous Network Optimization.

---

#### 8. `backend/simulation/traffic_generator.py` & `monitor.py`
- **Purpose**: Drives packet traffic and collects metrics in standalone synthetic simulation mode.
- **How it is Implemented**:
  - `traffic_generator.py` uses Poisson-distributed packet arrivals to simulate realistic bursty network traffic across slices.
  - `monitor.py` runs a 1-second daemon thread collecting slice statistics, resetting interval counters, and calculating running averages.
- **Computer Networks Concepts**:
  - **Poisson Traffic Arrival Modeling & Queuing Theory (M/M/1 queues)**.

---

#### 9. `backend/simulation/dhcp.py`
- **Purpose**: Dynamic Host Configuration Protocol server simulating dynamic IP provisioning for virtual 5G User Equipment (UEs).
- **How it is Implemented**:
  - Manages an IPv4 address pool: `192.168.1.100` to `192.168.1.250` with subnet `255.255.255.0` and gateway `192.168.1.1`.
  - Binds leased IP addresses to client virtual MAC addresses (`AA:BB:CC:DD:EE:11`).
  - Assigns dynamic Time-To-Live (TTL) lease expirations and allows IP renewals.
- **Computer Networks Concepts**:
  - **DHCP DORA Process (Discover, Offer, Request, Acknowledge) [RFC 2131]**.
  - **IPv4 Subnetting & Address Pool Management**.
  - **MAC-to-IP Binding & Lease Expiration Mechanics**.

---

#### 10. `backend/simulation/dns.py`
- **Purpose**: 5G Slice Domain Name System directory mapping human-readable FQDNs to slice IP and port socket endpoints.
- **How it is Implemented**:
  - Pre-configures 5G slice domain records:
    - `urllc.slice.5g` &rarr; `127.0.0.1:9101` (A_SRV record)
    - `embb.slice.5g` &rarr; `127.0.0.1:9102` (A_SRV record)
    - `mmtc.slice.5g` &rarr; `127.0.0.1:9103` (A_SRV record)
    - `orchestrator.5g` &rarr; `127.0.0.1:8000` (A record)
  - `resolve(domain)`: Returns IP, port, and record type, or returns `NXDOMAIN` if not found.
  - Supports dynamic record registration via `add_record()`.
- **Computer Networks Concepts**:
  - **Domain Name System Resolution (RFC 1035)**.
  - **DNS A and Service (SRV) Record Structures**.
  - **5G Service-Based Architecture (SBA) Network Repository Function (NRF) Emulation**.

---

#### 11. `backend/simulation/multicast.py`
- **Purpose**: Internet Group Management Protocol (IGMP) multicast group controller for 5G control-plane slice signaling.
- **How it is Implemented**:
  - Manages Class D IPv4 multicast address `224.0.0.100` on port `9999`.
  - Tracks subscribed slice worker nodes (`slice_node_1`, `orchestrator_node`).
  - Broadcasts slice reallocation signals (`broadcast_signal`) to all members simultaneously without sending individual unicast packets.
- **Computer Networks Concepts**:
  - **IPv4 Multicast Addressing (Class D: 224.0.0.0/4) [RFC 1112]**.
  - **Internet Group Management Protocol (IGMP)**.
  - **One-to-Many Control-Plane Signaling**.

---

## 3. Computer Networks (CN) Concepts Summary Matrix

| Concept | File Location | How It Is Implemented |
|---|---|---|
| **Token-Bucket Shaping** | `real_network.py` | Mathematical token generation and burst control throttling socket transmission. |
| **BSD Sockets** | `real_network.py` | Multi-threaded TCP stream server (`:9105`) and UDP datagram sockets (`:9101-9103`). |
| **TCP RTT Latency** | `real_network.py` | Non-blocking TCP connection handshake to `8.8.8.8:53` measuring millisecond delay. |
| **Wi-Fi 802.11 Telemetry**| `real_network.py` | Extracts real SSID, RSSI signal percentage, Tx/Rx link rates, and radio bands. |
| **Packet Queuing & Drops**| `simulation/slices.py` | Simulates buffer overflows and tracks packet loss when throughput exceeds capacity. |
| **Dynamic QoS Slicing** | `simulation/allocation.py`| Partitions 100 Mbps pool into URLLC, eMBB, and mMTC slices with priority rules. |
| **IPv4 DHCP Server** | `simulation/dhcp.py` | Leases `192.168.1.100–250` IP pool with MAC address bindings and lease TTL. |
| **5G DNS Resolution** | `simulation/dns.py` | Resolves FQDNs like `urllc.slice.5g` to IP:Port endpoints with SRV records. |
| **IGMP Multicast** | `simulation/multicast.py` | Broadcasts control signals to Class D group `224.0.0.100:9999` across slice nodes. |
| **Transport Protocols** | `real_network.py` | Uses UDP for low-latency URLLC/mMTC and TCP for high-reliability eMBB streams. |
