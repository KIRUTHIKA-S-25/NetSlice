import time
import numpy as np

class NetworkSlice:
    def __init__(self, name, allocated_bandwidth_mbps):
        self.name = name
        self.allocated_bandwidth = allocated_bandwidth_mbps
        self.current_usage = 0.0
        self.packets_processed = 0
        self.packets_dropped = 0
        self.latency_sum = 0.0
        self.last_latency = 0.0
        self.jitter_sum = 0.0
        self.latency_samples = []
        
    def process_packet(self, size_bits):
        capacity_bps = max(100_000, self.allocated_bandwidth * 1_000_000)
        
        # If usage exceeds capacity, simulate buffer overflow / packet drop
        if self.current_usage + size_bits > capacity_bps:
            self.packets_dropped += 1
            return False, 0.5  # Dropped packet penalty
            
        self.current_usage += size_bits
        self.packets_processed += 1
        
        # Base latency based on 5G slice class
        base_latency = 0.008 if "Low-Latency" in self.name else (0.040 if "High-Bandwidth" in self.name else 0.025)
        # Queuing delay scales with load utilization
        queuing_delay = (self.current_usage / capacity_bps) * 0.020
        simulated_latency = base_latency + queuing_delay
        
        self.latency_sum += simulated_latency
        
        if self.last_latency > 0:
            jitter = abs(simulated_latency - self.last_latency)
            self.jitter_sum += jitter
        self.last_latency = simulated_latency
        
        if len(self.latency_samples) < 300:
            self.latency_samples.append(simulated_latency)
        
        return True, simulated_latency
        
    def reset_interval(self):
        self.current_usage = 0.0
        self.packets_processed = 0
        self.packets_dropped = 0
        self.latency_sum = 0.0
        self.jitter_sum = 0.0
        self.latency_samples = []

def initialize_slices():
    return {
        "low_latency": NetworkSlice("Low-Latency", 30.0),
        "high_bandwidth": NetworkSlice("High-Bandwidth", 50.0),
        "general": NetworkSlice("General-Purpose", 20.0)
    }
