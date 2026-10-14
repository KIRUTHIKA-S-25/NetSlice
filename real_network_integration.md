# Real-Network Integration Mode Specification
## Closed-Loop Predictive Resource Management on Physical Gateways & Multi-Device Testbeds

### 1. Architectural Overview & Network Topology

NetSlice provides dual-mode operation: **Simulation Mode** (Python virtual network) and **Real-Network Mode** (Monitoring & Enforcement on physical network gateways).

```
 +-------------------------------------------------------------------------------+
 |                        Controlled Lab Network Topology                        |
 +-------------------------------------------------------------------------------+

 [ Physical Devices ]              [ Access Point / Switch ]        [ Linux Gateway / Router ]
 +--------------------+            +------------------------+      +--------------------------+
 | AGV-01 (URLLC)     |---(Wi-Fi)->|                        |      | Interfaces:              |
 | IP: 192.168.1.101  |            | Managed PoE Switch /   |----->| eth0 (LAN)  eth1 (WAN)   |
 +--------------------+            | 802.11ax Wi-Fi AP      |      +--------------------------+
 | 4K Camera (eMBB)   |---(GbE)--->| (VLAN 10: URLLC        |                   |
 | IP: 192.168.1.102  |            |  VLAN 20: eMBB         |                   v
 +--------------------+            |  VLAN 30: mMTC)        |      +--------------------------+
 | IoT Cluster (mMTC) |---(Zigbee/ |                        |      | Linux Traffic Control    |
 | IP: 192.168.1.103  |    IP)---->|                        |      | (tc HTB + fq_codel)      |
 +--------------------+            +------------------------+      +--------------------------+
                                                                                |
                                                                                v
                                                                   +--------------------------+
                                                                   | NetSlice Backend Engine  |
                                                                   | (Predictive Allocator &  |
                                                                   |  Gateway Adapter)        |
                                                                   +--------------------------+
```

---

### 2. Operating Modes & Enforcement States

| Operating Mode | Network Adapter Used | Enforcement Mechanism | Safety Guarantees |
| :--- | :--- | :--- | :--- |
| **1. Simulation Mode** | Virtual Software Slices | Internal discrete tick shaper | No host network modification |
| **2. Real-Network Monitoring** | Physical Interface / Gateway | Non-intrusive `psutil` I/O & TCP RTT | Safe read-only telemetry, zero configuration changes |
| **3. Real-Network Enforcement** | Linux Gateway (`tc`) / Token Bucket | HTB leaf classes & `fq_codel` queue disciplines | Requires operator authorization, dry-run validation, and rollback support |

---

### 3. Truthful Metric Disaggregation (Academic Integrity)

To avoid misleading claims during faculty evaluation, metrics are strictly categorized:

| Metric Type | Data Source | Confidence Status | Faculty Evaluation Note |
| :--- | :--- | :--- | :--- |
| **Measured Device Traffic** | Hardware interface & socket byte counters | `MEASURED` | Direct bytes transferred per second |
| **Predicted Demand** | Scikit-learn Multi-Model Regression / EWMA | `PREDICTED` | Proactive forecast ahead of traffic bursts |
| **Calculated Allocation** | Optimization Engine (`allocation.py`) | `CALCULATED` | Normalized bandwidth meeting SLA invariants |
| **Enforced Allocation** | Gateway Kernel Class (`tc class`) | `ENFORCED` | Actual rate limit active on the gateway |
| **Latency / RTT** | Live TCP/ICMP socket probes | `ESTIMATED` | Statistical end-to-end latency estimate |
| **Payload Contents** | Network Process Header Inspection | `UNAVAILABLE` | **TLS 1.3 payloads are encrypted by design; uninspected to preserve integrity** |

> [!NOTE]
> NetSlice does **not** claim that devices sharing a Wi-Fi router are automatically sliced unless traffic is explicitly routed through the configured gateway adapter.

---

### 4. Supported Operating Systems & Privileges

1. **Linux Lab Gateway (Production / Lab Testbed):**
   - **Supported OS:** Ubuntu 22.04 LTS, Debian 12, OpenWrt 23.05, Rocky Linux 9.
   - **Required Privileges:** `CAP_NET_ADMIN` or `sudo` for `tc` execution.
   - **Supported Qdiscs:** `htb` (Hierarchical Token Bucket), `fq_codel` (Fair Queueing Controlled Delay), `cake`.

2. **Windows Development / Local Evaluation:**
   - **Supported OS:** Windows 10 / Windows 11.
   - **Mechanism:** Local socket token-bucket rate shaper + live adapter telemetry ingestion (`psutil.net_io_counters`).

---

### 5. Gateway Setup & Linux `tc` Configuration Commands

#### Step 1: Enable IP Forwarding on Gateway
```bash
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward = 1" | sudo tee -a /etc/sysctl.conf
```

#### Step 2: Initialize Root HTB Queue Discipline
```bash
# Clear existing root qdisc
sudo tc qdisc del dev eth0 root 2>/dev/null || true

# Attach HTB root qdisc with default class 1:30 (mMTC)
sudo tc qdisc add dev eth0 root handle 1: htb default 30

# Create root container class matching total interface bandwidth (e.g., 100 Mbps)
sudo tc class add dev eth0 parent 1: classid 1:1 htb rate 100mbit ceil 100mbit
```

#### Step 3: Create Slice Classes
```bash
# Slice 1: URLLC Low-Latency (30 Mbps base, 45 Mbps ceil, high priority, 5ms target latency)
sudo tc class add dev eth0 parent 1:1 classid 1:10 htb rate 30.0mbit ceil 45.0mbit prio 1
sudo tc qdisc add dev eth0 parent 1:10 handle 10: fq_codel quantum 300 target 5ms

# Slice 2: eMBB High-Bandwidth (50 Mbps base, 100 Mbps burst ceiling, bulk priority)
sudo tc class add dev eth0 parent 1:1 classid 1:20 htb rate 50.0mbit ceil 100mbit prio 3
sudo tc qdisc add dev eth0 parent 1:20 handle 20: fq_codel

# Slice 3: mMTC General-Purpose (20 Mbps base, 24 Mbps ceil, default priority)
sudo tc class add dev eth0 parent 1:1 classid 1:30 htb rate 20.0mbit ceil 24.0mbit prio 2
sudo tc qdisc add dev eth0 parent 1:30 handle 30: fq_codel
```

#### Step 4: Classify Flows via DSCP / Port Filters
```bash
# URLLC: Match Port 9101 or DSCP EF (Expedited Forwarding, 0xb8)
sudo tc filter add dev eth0 protocol ip parent 1:0 prio 1 u32 match ip dport 9101 0xffff flowid 1:10
sudo tc filter add dev eth0 protocol ip parent 1:0 prio 1 u32 match ip tos 0xb8 0xfc flowid 1:10

# eMBB: Match Port 9102
sudo tc filter add dev eth0 protocol ip parent 1:0 prio 2 u32 match ip dport 9102 0xffff flowid 1:20

# mMTC: Match Port 9103
sudo tc filter add dev eth0 protocol ip parent 1:0 prio 3 u32 match ip dport 9103 0xffff flowid 1:30
```

---

### 6. Dynamic In-Flight Allocation Updates

When NetSlice's AI engine calculates a dynamic reallocation (e.g., URLLC increases from 30 Mbps to 42 Mbps during an autonomous surge), it does **not** tear down the queue. It executes non-disruptive `class change` commands:

```bash
sudo tc class change dev eth0 parent 1:1 classid 1:10 htb rate 42.0mbit ceil 60.0mbit prio 1
sudo tc class change dev eth0 parent 1:1 classid 1:20 htb rate 38.0mbit ceil 100.0mbit prio 3
sudo tc class change dev eth0 parent 1:1 classid 1:30 htb rate 20.0mbit ceil 24.0mbit prio 2
```

---

### 7. Emergency Rollback & Teardown Procedure

To immediately purge all traffic control rules and restore the gateway interface to default unmanaged behavior:

```bash
# One-line rollback command executed by NetSlice adapter
sudo tc qdisc del dev eth0 root 2>/dev/null || true
```

*Verification:*
```bash
sudo tc qdisc show dev eth0
# Output should show default fq_codel or noqueue, with no HTB classes.
```

---

### 8. Known Limitations & Technical Constraints

1. **Physical Wi-Fi Medium Limitations:** Wi-Fi (802.11) uses a shared CSMA/CA RF medium. Traffic shaping on a gateway controls IP queueing and egress rates, but cannot modify RF contention between unmanaged stations on the same channel.
2. **Encrypted Payloads (TLS 1.3 / QUIC):** Deep packet inspection cannot inspect encrypted payloads without host agent instrumentation. Classification relies on verified device identities, port mappings, and flow statistical profiles.
3. **Hardware Offloading (TSO/GSO):** TCP Segmentation Offload can cause packet batching before `tc` shapers. In high-precision lab tests, disable TSO: `sudo ethtool -K eth0 tso off gso off`.
