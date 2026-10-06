import time
import random
from typing import Dict, List, Optional

class DHCPServer:
    def __init__(self, subnet: str = "192.168.1.0/24", start_ip: int = 100, end_ip: int = 250):
        self.subnet = subnet
        self.ip_pool = [f"192.168.1.{i}" for i in range(start_ip, end_ip + 1)]
        self.leases: Dict[str, dict] = {}  # mac_address -> lease_info
        self.lease_duration: int = 300  # 5 minutes in seconds

    def request_ip(self, mac_address: str, slice_type: str) -> dict:
        now = time.time()
        # Clean expired leases
        self._clean_expired(now)

        # If device already has an active lease, extend/renew it
        if mac_address in self.leases:
            self.leases[mac_address]["expires_at"] = now + self.lease_duration
            self.leases[mac_address]["status"] = "RENEWED"
            return self.leases[mac_address]

        # Find allocated IPs
        allocated_ips = {v["ip"] for v in self.leases.values()}
        available_ips = [ip for ip in self.ip_pool if ip not in allocated_ips]

        if not available_ips:
            raise Exception("DHCP Address Pool Exhausted!")

        ip = random.choice(available_ips)
        lease_info = {
            "mac": mac_address,
            "ip": ip,
            "slice": slice_type,
            "leased_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now)),
            "expires_at": now + self.lease_duration,
            "lease_duration_sec": self.lease_duration,
            "status": "ALLOCATED"
        }
        self.leases[mac_address] = lease_info
        return lease_info

    def release_ip(self, mac_address: str) -> dict:
        if mac_address in self.leases:
            released = self.leases.pop(mac_address)
            return {"status": "RELEASED", "ip": released["ip"], "mac": mac_address}
        return {"status": "NOT_FOUND", "mac": mac_address}

    def get_active_leases(self) -> List[dict]:
        self._clean_expired(time.time())
        return list(self.leases.values())

    def _clean_expired(self, current_time: float):
        self.leases = {k: v for k, v in self.leases.items() if v["expires_at"] > current_time}

# Global DHCP server instance
dhcp_server = DHCPServer()
