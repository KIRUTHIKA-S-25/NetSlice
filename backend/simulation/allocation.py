import time

class ResourceAllocationEngine:
    def __init__(self, slices_dict):
        self.slices = slices_dict
        self.total_bandwidth = 100 # Mbps

    def allocate_static(self):
        # 30% Low-Latency, 50% High-Bandwidth, 20% General
        self.slices["low_latency"].allocated_bandwidth = 30
        self.slices["high_bandwidth"].allocated_bandwidth = 50
        self.slices["general"].allocated_bandwidth = 20

    def allocate_rule_based(self, monitor_snapshot):
        # Adjust shares if a slice is heavily utilized (> 90%) and another is underutilized (< 50%)
        # Simple mocked logic for demonstration
        if not monitor_snapshot: return
        
        # We need the latest slice data
        latest = monitor_snapshot["slices"]
        
        # Example logic: if low_latency is constrained, try to steal from general
        if latest["low_latency"]["utilization"] > 90 and latest["general"]["utilization"] < 50:
            if self.slices["general"].allocated_bandwidth > 10:
                self.slices["general"].allocated_bandwidth -= 5
                self.slices["low_latency"].allocated_bandwidth += 5
                
        # (Additional rule logic could go here)

    def allocate_ai_assisted(self, predicted_demands):
        # predicted_demands is a dict mapping slice -> expected mbps
        if not predicted_demands: return
        
        total_predicted = sum(predicted_demands.values())
        if total_predicted == 0:
            self.allocate_static()
            return
            
        for key in self.slices.keys():
            # Proportional allocation based on predicted demand
            share = (predicted_demands.get(key, 0) / total_predicted) * self.total_bandwidth
            # Ensure minimum bandwidths (e.g., min 5 Mbps for any slice to prevent starvation)
            self.slices[key].allocated_bandwidth = max(5, share)
