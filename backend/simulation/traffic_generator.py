import threading
import time
import random
from database import save_action_log

class TrafficGenerator:
    def __init__(self, slices_dict, db_path="network_logs.db", seed=None):
        self.slices = slices_dict
        self.db_path = db_path
        self.is_running = False
        self.thread = None
        self.seed = seed
        self.rng = random.Random(seed)
        
        # Base traffic profiles in bits per second
        self.base_profiles = {
            "low_latency": 10_000_000,   # 10 Mbps base
            "high_bandwidth": 30_000_000, # 30 Mbps base
            "general": 10_000_000         # 10 Mbps base
        }
        self.traffic_profiles = dict(self.base_profiles)
        self.active_scenario = "normal"

    def set_seed(self, seed: int):
        self.seed = seed
        self.rng = random.Random(seed)

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
        
        # 7 Canonical Evaluation Scenarios
        if scenario_name in ["gaming_burst", "fleet_surge"]:
            # Sudden gaming/interactive traffic burst on Low-Latency slice
            self.traffic_profiles["low_latency"] = 45_000_000
            self.traffic_profiles["high_bandwidth"] = 25_000_000
            self.traffic_profiles["general"] = 10_000_000
            save_action_log(self.db_path, "SCENARIO", "Scenario: Sudden Low-Latency Interactive Gaming Burst (45 Mbps on LL slice)!")
            
        elif scenario_name in ["streaming_heavy", "streaming_burst"]:
            # Streaming-heavy workload on High-Bandwidth slice
            self.traffic_profiles["high_bandwidth"] = 75_000_000
            self.traffic_profiles["low_latency"] = 10_000_000
            self.traffic_profiles["general"] = 10_000_000
            save_action_log(self.db_path, "SCENARIO", "Scenario: Streaming-Heavy 4K UHD Workload (75 Mbps on High-BW slice)!")
            
        elif scenario_name in ["download_congestion", "dos_attack"]:
            # Bulk download congestion saturating capacity
            self.traffic_profiles["high_bandwidth"] = 80_000_000
            self.traffic_profiles["general"] = 20_000_000
            self.traffic_profiles["low_latency"] = 10_000_000
            save_action_log(self.db_path, "SCENARIO", "Scenario: Large File Download Congestion (80 Mbps High-BW + 20 Mbps General)!")
            
        elif scenario_name in ["mixed_concurrent", "balanced_high"]:
            # Multiple concurrent applications across all slices
            self.traffic_profiles["low_latency"] = 35_000_000
            self.traffic_profiles["high_bandwidth"] = 45_000_000
            self.traffic_profiles["general"] = 20_000_000
            save_action_log(self.db_path, "SCENARIO", "Scenario: Multiple Concurrent Applications (LL: 35M, HB: 45M, Gen: 20M)!")
            
        elif scenario_name == "overload":
            # Total demand strictly exceeds total network capacity (170 Mbps vs 100 Mbps)
            self.traffic_profiles["low_latency"] = 50_000_000
            self.traffic_profiles["high_bandwidth"] = 80_000_000
            self.traffic_profiles["general"] = 40_000_000
            save_action_log(self.db_path, "SCENARIO", "Scenario: Extreme System Overload (170 Mbps demand against 100 Mbps capacity)!")
            
        elif scenario_name == "idle_low":
            # Low-demand conditions with abundant idle resources
            self.traffic_profiles["low_latency"] = 5_000_000
            self.traffic_profiles["high_bandwidth"] = 10_000_000
            self.traffic_profiles["general"] = 5_000_000
            save_action_log(self.db_path, "SCENARIO", "Scenario: Low-Demand Conditions (Total load only 20 Mbps)!")
            
        else:  # "normal" baseline
            self.traffic_profiles = dict(self.base_profiles)
            save_action_log(self.db_path, "SCENARIO", "Scenario Reset: Normal network baseline (LL: 10M, HB: 30M, Gen: 10M).")
            
        return self.traffic_profiles

    def _generate_traffic(self):
        while self.is_running:
            # Simulate 10 times a second for smoother packet streams
            for slice_key, net_slice in self.slices.items():
                demand = self.traffic_profiles[slice_key]
                # Dynamic variation (+- 10%) using seeded generator
                variation = self.rng.uniform(0.90, 1.10)
                current_demand = demand * variation
                
                # Demand for this 0.1s interval
                interval_demand = current_demand / 10.0 
                
                # Standard packet size (12,000 bits)
                packet_size = 12000
                num_packets = int(interval_demand / packet_size)
                
                for _ in range(num_packets):
                    net_slice.process_packet(packet_size)
                    
            time.sleep(0.1)
