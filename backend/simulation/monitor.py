import threading
import time
import os
from database import save_snapshot_logs, save_action_log

class MetricsCollector:
    def __init__(self, slices_dict, get_strategy_fn=None, db_path="network_logs.db"):
        self.slices = slices_dict
        self.get_strategy_fn = get_strategy_fn or (lambda: "static")
        self.is_running = False
        self.thread = None
        self.metrics_history = []
        self.db_path = db_path

    def start(self):
        self.is_running = True
        self.thread = threading.Thread(target=self._collect_metrics, daemon=True)
        self.thread.start()

    def stop(self):
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=2.0)

    def _collect_metrics(self):
        while self.is_running:
            time.sleep(1.0) # Collect every second
            timestamp = time.time()
            snapshot = {"timestamp": timestamp, "slices": {}}
            strategy = self.get_strategy_fn()
            
            for key, net_slice in self.slices.items():
                avg_latency = 0.0
                if net_slice.packets_processed > 0:
                    avg_latency = net_slice.latency_sum / net_slice.packets_processed
                    
                throughput_bps = net_slice.current_usage
                throughput_mbps = throughput_bps / 1_000_000
                utilization = (throughput_mbps / net_slice.allocated_bandwidth) * 100 if net_slice.allocated_bandwidth > 0 else 100
                
                slice_info = {
                    "slice_name": key,
                    "allocated_bandwidth": net_slice.allocated_bandwidth,
                    "throughput_mbps": throughput_mbps,
                    "packets_processed": net_slice.packets_processed,
                    "packets_dropped": net_slice.packets_dropped,
                    "avg_latency": avg_latency,
                    "avg_latency_ms": avg_latency * 1000,
                    "utilization": utilization
                }
                snapshot["slices"][key] = slice_info
                
                # Check for critical alerts to log
                if net_slice.packets_dropped > 0:
                    save_action_log(
                        self.db_path,
                        "WARNING",
                        f"QoS Violation: {net_slice.name} dropped {net_slice.packets_dropped} packets! Utilization={utilization:.1f}%"
                    )
                elif utilization > 95:
                    save_action_log(
                        self.db_path,
                        "WARNING",
                        f"Congestion Alert: {net_slice.name} at {utilization:.1f}% capacity ({throughput_mbps:.1f}/{net_slice.allocated_bandwidth} Mbps)"
                    )
                
                # Reset slice for next interval
                net_slice.reset_interval()
                
            self.metrics_history.append(snapshot)
            # Keep last 60 ticks in memory for fast chart retrieval
            if len(self.metrics_history) > 60:
                self.metrics_history.pop(0)
                
            # Write to SQLite database via SQLAlchemy
            try:
                save_snapshot_logs(self.db_path, timestamp, snapshot["slices"], strategy=strategy)
            except Exception as e:
                print("DB Write Error:", e)
