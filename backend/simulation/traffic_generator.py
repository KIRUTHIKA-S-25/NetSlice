import threading
import time
import random
from database import save_action_log

class TrafficGenerator:
    def __init__(self, slices_dict, db_path="network_logs.db"):
        self.slices = slices_dict
        self.db_path = db_path
        self.is_running = False
        self.thread = None
        # Base traffic profiles in bits per second
        self.base_profiles = {
            "low_latency": 10_000_000,   # 10 Mbps base
            "high_bandwidth": 30_000_000, # 30 Mbps base
            "general": 10_000_000         # 10 Mbps base
        }
        self.traffic_profiles = dict(self.base_profiles)
        self.active_scenario = "normal"

    def start(self):
        self.is_running = True
        self.thread = threading.Thread(target=self._generate_traffic, daemon=True)
        self.thread.start()

    def stop(self):
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=2.0)

    def update_profile(self, slice_name, demand_bps):
        if slice_name in self.traffic_profiles:
            old_mbps = self.traffic_profiles[slice_name] / 1_000_000
            new_mbps = demand_bps / 1_000_000
            self.traffic_profiles[slice_name] = demand_bps
            save_action_log(
                self.db_path,
                "TRAFFIC",
                f"Traffic profile adjusted on {slice_name}: {old_mbps:.1f} Mbps -> {new_mbps:.1f} Mbps"
            )

    def apply_scenario(self, scenario_name: str):
        self.active_scenario = scenario_name
        if scenario_name == "dos_attack":
            # Overwhelm General slice
            self.traffic_profiles["general"] = 70_000_000
            self.traffic_profiles["low_latency"] = 12_000_000
            self.traffic_profiles["high_bandwidth"] = 25_000_000
            save_action_log(self.db_path, "SCENARIO", "Scenario Triggered: Simulated Denial of Service (DoS) attack on General-Purpose slice (70 Mbps flood)!")
        elif scenario_name == "streaming_burst":
            # Overwhelm High Bandwidth slice
            self.traffic_profiles["high_bandwidth"] = 80_000_000
            self.traffic_profiles["general"] = 10_000_000
            self.traffic_profiles["low_latency"] = 10_000_000
            save_action_log(self.db_path, "SCENARIO", "Scenario Triggered: 4K/8K Ultra-HD Video Streaming Burst (80 Mbps load on High-Bandwidth)!")
        elif scenario_name == "fleet_surge":
            # Surge on Low-Latency slice
            self.traffic_profiles["low_latency"] = 45_000_000
            self.traffic_profiles["high_bandwidth"] = 25_000_000
            self.traffic_profiles["general"] = 10_000_000
            save_action_log(self.db_path, "SCENARIO", "Scenario Triggered: Autonomous Vehicle Fleet Critical Telemetry Surge (45 Mbps on Low-Latency)!")
        elif scenario_name == "balanced_high":
            self.traffic_profiles["low_latency"] = 25_000_000
            self.traffic_profiles["high_bandwidth"] = 45_000_000
            self.traffic_profiles["general"] = 20_000_000
            save_action_log(self.db_path, "SCENARIO", "Scenario Triggered: High Concurrent Congestion across all slices (90 Mbps total load)!")
        else: # reset
            self.traffic_profiles = dict(self.base_profiles)
            save_action_log(self.db_path, "SCENARIO", "Scenario Reset: Restored normal baseline traffic profiles (LL: 10M, HB: 30M, Gen: 10M)")
        return self.traffic_profiles

    def _generate_traffic(self):
        while self.is_running:
            # Simulate 10 times a second for smoother packet streams
            for slice_key, net_slice in self.slices.items():
                demand = self.traffic_profiles[slice_key]
                # Dynamic variation (+- 15%)
                current_demand = demand * random.uniform(0.85, 1.15)
                
                # Demand for this 0.1s interval
                interval_demand = current_demand / 10.0 
                
                # Standard packet size (12,000 bits)
                packet_size = 12000
                num_packets = int(interval_demand / packet_size)
                
                for _ in range(num_packets):
                    net_slice.process_packet(packet_size)
                    
            time.sleep(0.1)
