import threading
import time

class MetricsCollector:
    def __init__(self, slices_dict):
        self.slices = slices_dict
        self.is_running = False
        self.thread = None
        self.metrics_history = []

    def start(self):
        self.is_running = True
        self.thread = threading.Thread(target=self._collect_metrics, daemon=True)
        self.thread.start()

    def stop(self):
        self.is_running = False
        if self.thread:
            self.thread.join()

    def _collect_metrics(self):
        while self.is_running:
            time.sleep(1.0) # Collect every second
            timestamp = time.time()
            snapshot = {"timestamp": timestamp, "slices": {}}
            
            for key, net_slice in self.slices.items():
                avg_latency = 0.0
                if net_slice.packets_processed > 0:
                    avg_latency = net_slice.latency_sum / net_slice.packets_processed
                    
                throughput_bps = net_slice.current_usage
                throughput_mbps = throughput_bps / 1_000_000
                utilization = (throughput_mbps / net_slice.allocated_bandwidth) * 100 if net_slice.allocated_bandwidth > 0 else 100
                
                snapshot["slices"][key] = {
                    "throughput_mbps": throughput_mbps,
                    "packets_processed": net_slice.packets_processed,
                    "packets_dropped": net_slice.packets_dropped,
                    "avg_latency": avg_latency,
                    "utilization": utilization
                }
                
                # Reset slice for next interval
                net_slice.reset_interval()
                
            self.metrics_history.append(snapshot)
            # In a real scenario, we would write this to SQLite here
