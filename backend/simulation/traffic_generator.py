import threading
import time
import random

class TrafficGenerator:
    def __init__(self, slices_dict):
        self.slices = slices_dict
        self.is_running = False
        self.thread = None
        # Base traffic profiles in bits per second roughly (to be divided into packets)
        self.traffic_profiles = {
            "low_latency": 10_000_000, # 10 Mbps base
            "high_bandwidth": 30_000_000, # 30 Mbps base
            "general": 10_000_000 # 10 Mbps base
        }

    def start(self):
        self.is_running = True
        self.thread = threading.Thread(target=self._generate_traffic, daemon=True)
        self.thread.start()

    def stop(self):
        self.is_running = False
        if self.thread:
            self.thread.join()

    def update_profile(self, slice_name, demand_bps):
        if slice_name in self.traffic_profiles:
            self.traffic_profiles[slice_name] = demand_bps

    def _generate_traffic(self):
        while self.is_running:
            # We simulate 10 times a second for smoother generation
            for slice_key, net_slice in self.slices.items():
                demand = self.traffic_profiles[slice_key]
                # Add some randomness to traffic (+- 20%)
                current_demand = demand * random.uniform(0.8, 1.2)
                
                # Demand for this 0.1s interval
                interval_demand = current_demand / 10.0 
                
                # Assume standard 1500 byte (12000 bit) packets
                packet_size = 12000
                num_packets = int(interval_demand / packet_size)
                
                for _ in range(num_packets):
                    net_slice.process_packet(packet_size)
                    
            time.sleep(0.1)
