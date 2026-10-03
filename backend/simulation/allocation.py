import time
from database import save_action_log

class ResourceAllocationEngine:
    def __init__(self, slices_dict, db_path="network_logs.db"):
        self.slices = slices_dict
        self.total_bandwidth = 100 # Mbps total pool
        self.db_path = db_path
        self.custom_static_config = {
            "low_latency": 30,
            "high_bandwidth": 50,
            "general": 20
        }
        self.last_logged_allocation = {}

    def set_custom_static_config(self, config: dict):
        total = sum(config.values())
        if total <= 0:
            return False, "Total bandwidth must be greater than 0"
        
        # Normalize to 100 Mbps pool if not exactly 100
        if total != self.total_bandwidth:
            scale = self.total_bandwidth / total
            config = {k: round(v * scale, 1) for k, v in config.items()}
            # Adjust rounding difference on largest
            diff = self.total_bandwidth - sum(config.values())
            max_k = max(config, key=config.get)
            config[max_k] = round(config[max_k] + diff, 1)

        self.custom_static_config = config
        msg = f"Custom Static Pool applied: Low-Latency={config.get('low_latency')}M, High-BW={config.get('high_bandwidth')}M, General={config.get('general')}M"
        save_action_log(self.db_path, "CONFIG", msg)
        self.allocate_static()
        return True, msg

    def allocate_static(self):
        changed = False
        for key, val in self.custom_static_config.items():
            if key in self.slices and self.slices[key].allocated_bandwidth != val:
                changed = True
                self.slices[key].allocated_bandwidth = val
        if changed:
            save_action_log(
                self.db_path,
                "STATIC-ALLOC",
                f"Static allocations updated: Low-Latency={self.slices['low_latency'].allocated_bandwidth}M, High-BW={self.slices['high_bandwidth'].allocated_bandwidth}M, General={self.slices['general'].allocated_bandwidth}M"
            )

    def allocate_rule_based(self, monitor_snapshot):
        if not monitor_snapshot or "slices" not in monitor_snapshot:
            return
        
        latest = monitor_snapshot["slices"]
        
        # Rule 1: Low-Latency constraint relief (URLLC has highest SLA priority)
        if latest["low_latency"]["utilization"] > 85 or latest["low_latency"]["packets_dropped"] > 0:
            donor = None
            if latest["general"]["utilization"] < 60 and self.slices["general"].allocated_bandwidth > 10:
                donor = "general"
            elif latest["high_bandwidth"]["utilization"] < 70 and self.slices["high_bandwidth"].allocated_bandwidth > 25:
                donor = "high_bandwidth"
                
            if donor:
                shift_mbps = 5
                self.slices[donor].allocated_bandwidth -= shift_mbps
                self.slices["low_latency"].allocated_bandwidth += shift_mbps
                save_action_log(
                    self.db_path,
                    "RULE-ENGINE",
                    f"Rule Engine shifted {shift_mbps} Mbps from {donor.replace('_', ' ')} to Low-Latency (URLLC Protection)"
                )
                return

        # Rule 2: High-Bandwidth heavy load (eMBB burst)
        if latest["high_bandwidth"]["utilization"] > 90 and latest["general"]["utilization"] < 40:
            if self.slices["general"].allocated_bandwidth > 12:
                shift_mbps = 4
                self.slices["general"].allocated_bandwidth -= shift_mbps
                self.slices["high_bandwidth"].allocated_bandwidth += shift_mbps
                save_action_log(
                    self.db_path,
                    "RULE-ENGINE",
                    f"Rule Engine shifted {shift_mbps} Mbps from General to High-Bandwidth (eMBB Load Surge)"
                )
                return

        # Rule 3: Rebalance back towards baseline if all utilization is low
        if (latest["low_latency"]["utilization"] < 40 and 
            latest["high_bandwidth"]["utilization"] < 50 and 
            self.slices["low_latency"].allocated_bandwidth > 35):
            excess = self.slices["low_latency"].allocated_bandwidth - 30
            shift = min(excess, 3)
            self.slices["low_latency"].allocated_bandwidth -= shift
            self.slices["high_bandwidth"].allocated_bandwidth += shift
            save_action_log(
                self.db_path,
                "RULE-ENGINE",
                f"Rule Engine returned {shift} Mbps from idle Low-Latency to High-Bandwidth"
            )

    def allocate_ai_assisted(self, predicted_demands):
        if not predicted_demands:
            return
        
        total_predicted = sum(predicted_demands.values())
        if total_predicted == 0:
            self.allocate_static()
            return
            
        new_allocations = {}
        # Ensure minimum bandwidth (min 5 Mbps) to prevent total starvation
        min_reserve = 5.0
        remaining_pool = self.total_bandwidth - (min_reserve * len(self.slices))
        
        for key in self.slices.keys():
            share = (predicted_demands.get(key, 0) / total_predicted) * remaining_pool
            new_allocations[key] = round(min_reserve + share, 1)

        # Normalize sum to exactly total_bandwidth
        current_sum = sum(new_allocations.values())
        diff = round(self.total_bandwidth - current_sum, 1)
        # Add difference to slice with highest predicted demand
        highest_slice = max(predicted_demands, key=predicted_demands.get)
        new_allocations[highest_slice] = round(new_allocations[highest_slice] + diff, 1)

        # Check if significant change occurred before updating and logging
        significant_change = False
        for k in self.slices.keys():
            old_val = self.slices[k].allocated_bandwidth
            new_val = new_allocations[k]
            if abs(old_val - new_val) >= 1.5:
                significant_change = True
                break

        if significant_change:
            for k in self.slices.keys():
                self.slices[k].allocated_bandwidth = new_allocations[k]
                
            msg = (f"AI Predictive Optimization: Low-Latency={new_allocations['low_latency']}M, "
                   f"High-BW={new_allocations['high_bandwidth']}M, General={new_allocations['general']}M "
                   f"(Predicted Loads: LL={predicted_demands.get('low_latency',0):.1f}M, "
                   f"HB={predicted_demands.get('high_bandwidth',0):.1f}M, "
                   f"Gen={predicted_demands.get('general',0):.1f}M)")
            save_action_log(self.db_path, "AI-ACTION", msg)
