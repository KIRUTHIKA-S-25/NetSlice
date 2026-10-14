"""
Telemetry Provider Module for NetSlice.
Provides clean abstraction for genuine read-only network monitoring across Linux and Windows hosts.
Extracts real device observations from ARP neighbor tables, socket connections, and OS I/O counters.
Never fabricates synthetic data as live traffic.
"""

import os
import re
import subprocess
import time
import psutil
from typing import Dict, List, Optional, Any

class TelemetryDevice:
    def __init__(
        self,
        ip_address: str,
        mac_address: str,
        hostname: Optional[str] = None,
        interface: str = "Wi-Fi",
        state: str = "active",
        is_discovered: bool = True
    ):
        self.ip_address = ip_address
        self.mac_address = mac_address.upper()
        self.hostname = hostname or f"Host-{ip_address.split('.')[-1]}"
        self.interface = interface
        self.state = state
        self.is_discovered = is_discovered
        self.last_seen = time.time()
        self.active_sockets_count = 0
        self.remote_ports: List[int] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ip_address": self.ip_address,
            "mac_address": self.mac_address,
            "hostname": self.hostname,
            "interface": self.interface,
            "state": self.state,
            "is_discovered": self.is_discovered,
            "last_seen": self.last_seen,
            "active_sockets_count": self.active_sockets_count,
            "remote_ports": self.remote_ports
        }

class BaseTelemetryProvider:
    def discover_devices(self) -> List[TelemetryDevice]:
        raise NotImplementedError

    def get_interface_metrics(self, interface: str) -> Dict[str, Any]:
        raise NotImplementedError

    def get_active_flows(self) -> List[Dict[str, Any]]:
        raise NotImplementedError


class WindowsHostTelemetryProvider(BaseTelemetryProvider):
    """
    Genuine read-only telemetry provider on Windows hosts.
    Queries Windows ARP cache and psutil socket tables to observe real network participants.
    """
    def __init__(self, default_interface: str = "Wi-Fi"):
        self.default_interface = default_interface
        self.last_io = {}
        self.last_time = time.time()

    def discover_devices(self) -> List[TelemetryDevice]:
        """Reads actual ARP cache on Windows to discover devices on the local subnet."""
        devices: Dict[str, TelemetryDevice] = {}
        try:
            out = subprocess.check_output(["arp", "-a"], text=True, stderr=subprocess.DEVNULL)
            # Match IPv4 and MAC: e.g. "  192.168.1.1          e0-d5-5e-64-f2-c1     dynamic"
            pattern = re.compile(r"^\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\s+([0-9a-fA-F-]+)\s+(\w+)", re.MULTILINE)
            for match in pattern.finditer(out):
                ip = match.group(1).strip()
                mac = match.group(2).strip().replace("-", ":")
                entry_type = match.group(3).strip().lower()

                # Filter out multicast/broadcast addresses (e.g. 224.x, 239.x, 255.x)
                if ip.startswith("224.") or ip.startswith("239.") or ip.endswith(".255") or ip == "127.0.0.1":
                    continue
                if mac.lower() in ["ff:ff:ff:ff:ff:ff", "00:00:00:00:00:00"]:
                    continue

                dev = TelemetryDevice(
                    ip_address=ip,
                    mac_address=mac,
                    interface=self.default_interface,
                    state="dynamic" if "dynamic" in entry_type else "static",
                    is_discovered=True
                )
                devices[ip] = dev
        except Exception:
            pass

        # Cross-reference with active TCP/UDP socket connections from psutil
        try:
            conns = psutil.net_connections(kind='inet')
            for c in conns:
                if c.raddr:
                    r_ip, r_port = c.raddr.ip, c.raddr.port
                    if r_ip in devices:
                        devices[r_ip].active_sockets_count += 1
                        if r_port not in devices[r_ip].remote_ports and len(devices[r_ip].remote_ports) < 5:
                            devices[r_ip].remote_ports.append(r_port)
        except Exception:
            pass

        return list(devices.values())

    def get_interface_metrics(self, interface: str) -> Dict[str, Any]:
        """Measures raw physical byte counters on the designated network adapter."""
        curr_time = time.time()
        elapsed = max(0.5, curr_time - self.last_time)
        self.last_time = curr_time

        io_counters = psutil.net_io_counters(pernic=True)
        stats = io_counters.get(interface)
        if not stats:
            # Fallback to Wi-Fi or first active adapter
            for k, v in io_counters.items():
                if ("Wi-Fi" in k or "Wireless" in k or "eth" in k) and (v.bytes_recv > 0 or v.bytes_sent > 0):
                    stats = v
                    interface = k
                    break

        mbps_rx = 0.0
        mbps_tx = 0.0
        total_mbps = 0.0

        if stats:
            last = self.last_io.get(interface)
            if last:
                d_rx = max(0, stats.bytes_recv - last.bytes_recv)
                d_tx = max(0, stats.bytes_sent - last.bytes_sent)
                mbps_rx = (d_rx * 8.0) / (elapsed * 1_000_000.0)
                mbps_tx = (d_tx * 8.0) / (elapsed * 1_000_000.0)
                total_mbps = mbps_rx + mbps_tx
            self.last_io[interface] = stats

        return {
            "interface": interface,
            "measured_throughput_mbps": round(total_mbps, 2),
            "rx_mbps": round(mbps_rx, 2),
            "tx_mbps": round(mbps_tx, 2),
            "packets_recv": stats.packets_recv if stats else 0,
            "packets_sent": stats.packets_sent if stats else 0,
            "drops": (stats.dropin + stats.dropout) if stats else 0
        }

    def get_active_flows(self) -> List[Dict[str, Any]]:
        """Returns genuine active socket flows without fabricating encrypted contents."""
        flows = []
        try:
            for c in psutil.net_connections(kind='inet'):
                if c.status == 'ESTABLISHED' and c.raddr:
                    flows.append({
                        "local_ip": c.laddr.ip,
                        "local_port": c.laddr.port,
                        "remote_ip": c.raddr.ip,
                        "remote_port": c.raddr.port,
                        "pid": c.pid,
                        "status": c.status
                    })
        except Exception:
            pass
        return flows[:50]


class LinuxGatewayTelemetryProvider(BaseTelemetryProvider):
    """
    Telemetry provider for a Linux router / gateway host.
    Reads /proc/net/arp, ip neighbor, and /proc/net/dev.
    """
    def __init__(self, default_interface: str = "eth0"):
        self.default_interface = default_interface

    def discover_devices(self) -> List[TelemetryDevice]:
        devices = []
        try:
            if os.path.exists("/proc/net/arp"):
                with open("/proc/net/arp", "r") as f:
                    lines = f.readlines()[1:] # skip header
                    for line in lines:
                        parts = line.split()
                        if len(parts) >= 6:
                            ip, hw_type, flags, mac, mask, dev = parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]
                            if mac != "00:00:00:00:00:00":
                                devices.append(TelemetryDevice(
                                    ip_address=ip,
                                    mac_address=mac,
                                    interface=dev,
                                    state="active",
                                    is_discovered=True
                                ))
        except Exception:
            pass
        return devices

    def get_interface_metrics(self, interface: str) -> Dict[str, Any]:
        io_counters = psutil.net_io_counters(pernic=True)
        stats = io_counters.get(interface)
        return {
            "interface": interface,
            "packets_recv": stats.packets_recv if stats else 0,
            "packets_sent": stats.packets_sent if stats else 0,
            "drops": (stats.dropin + stats.dropout) if stats else 0
        }

    def get_active_flows(self) -> List[Dict[str, Any]]:
        return []


def create_telemetry_provider(interface: str = "Wi-Fi") -> BaseTelemetryProvider:
    """Factory creating appropriate genuine telemetry provider based on host operating system."""
    if os.name == 'posix' and os.path.exists('/proc/net/arp'):
        return LinuxGatewayTelemetryProvider(default_interface=interface)
    return WindowsHostTelemetryProvider(default_interface=interface)
