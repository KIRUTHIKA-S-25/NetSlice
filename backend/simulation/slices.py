import time

class NetworkSlice:
    def __init__(self, name, allocated_bandwidth_mbps):
        self.name = name
        self.allocated_bandwidth = allocated_bandwidth_mbps
        self.current_usage = 0.0
        self.packets_processed = 0
        self.packets_dropped = 0
        self.latency_sum = 0.0
        
    def process_packet(self, size_bits):
        # Extremely simplified simulation logic
        # Convert mbps to bits per second for comparison
        capacity_bps = self.allocated_bandwidth * 1_000_000
        
        # If usage exceeds capacity, we simulate a drop or delay
        if self.current_usage + size_bits > capacity_bps:
            self.packets_dropped += 1
            return False, 0.5 # Dropped, high latency penalty
            
        self.current_usage += size_bits
        self.packets_processed += 1
        
        # Base latency based on slice type (mocked)
        base_latency = 0.01 if "Low-Latency" in self.name else 0.05
        simulated_latency = base_latency + (self.current_usage / capacity_bps) * 0.02
        self.latency_sum += simulated_latency
        
        return True, simulated_latency
        
    def reset_interval(self):
        # Called every second by monitor
        self.current_usage = 0.0
        self.packets_processed = 0
        self.packets_dropped = 0
        self.latency_sum = 0.0

def initialize_slices():
    # 100 Mbps total pool as per problem statement
    return {
        "low_latency": NetworkSlice("Low-Latency", 30),
        "high_bandwidth": NetworkSlice("High-Bandwidth", 50),
        "general": NetworkSlice("General-Purpose", 20)
    }
