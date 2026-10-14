import time
import threading
from database import save_action_log

class ResourceAllocationEngine:
    def __init__(self, slices_dict, db_path="network_logs.db"):
        self.slices = slices_dict
        self.total_bandwidth = 100.0  # Mbps total pool
        self.db_path = db_path
        
        # Slices priority & limits (SLA Contract)
        self.slice_limits = {
            "low_latency": {"min": 10.0, "max": 60.0, "priority": 1, "name": "URLLC Low-Latency"},
            "high_bandwidth": {"min": 15.0, "max": 80.0, "priority": 3, "name": "eMBB High-Bandwidth"},
            "general": {"min": 5.0, "max": 50.0, "priority": 2, "name": "mMTC General-Purpose"}
        }
        
        self.custom_static_config = {
            "low_latency": 30.0,
            "high_bandwidth": 50.0,
            "general": 20.0
        }
        
        self.min_change_threshold = 1.5  # Mbps damping / hysteresis
        self.decision_history = []
        self._lock = threading.RLock()
        self.gateway_adapter = None
        self.last_enforcement_status = {
            "success": False,
            "message": "Gateway adapter not attached",
            "enforced_allocations": {},
            "timestamp": time.time(),
            "status": "UNCONFIGURED"
        }

        self.bind_application_profiles()

    def set_gateway_adapter(self, adapter):
        with self._lock:
            self.gateway_adapter = adapter

    def bind_application_profiles(self, registry=None):
        """Binds the application profile registry to dynamically recompute slice constraints."""
        try:
            from simulation.application_profiles import profile_registry
            self.profile_registry = registry or profile_registry
            self.profile_registry.add_listener(self.on_profile_updated)
            self.recompute_limits_from_profiles(self.profile_registry)
        except Exception:
            pass

    def on_profile_updated(self, profile_id, profile_data):
        try:
            reg = getattr(self, "profile_registry", None)
            if not reg:
                from simulation.application_profiles import profile_registry
                reg = profile_registry
            self.recompute_limits_from_profiles(reg)
        except Exception:
            pass

    def recompute_limits_from_profiles(self, registry):
        """Calculates slice minimum guarantees dynamically from active application profiles."""
        with self._lock:
            all_profiles = registry.get_all()
            base_mins = {
                "low_latency": 10.0,
                "high_bandwidth": 15.0,
                "general": 5.0
            }
            calculated = {}
            for s_key in self.slice_limits.keys():
                slice_profiles = [p for p in all_profiles.values() if p.get("preferred_slice") == s_key]
                if slice_profiles:
                    peak_req = max(p.get("min_throughput_mbps", 0.0) for p in slice_profiles)
                    calculated[s_key] = max(base_mins.get(s_key, 5.0), round(peak_req, 1))
                else:
                    calculated[s_key] = base_mins.get(s_key, 5.0)

            # Ensure sum of minimums never starves dynamic redistribution pool (max 65% of total)
            total_min = sum(calculated.values())
            max_allowed_min_pool = self.total_bandwidth * 0.65
            if total_min > max_allowed_min_pool:
                scale = max_allowed_min_pool / total_min
                for s_key in calculated:
                    calculated[s_key] = round(calculated[s_key] * scale, 1)

            for s_key, val in calculated.items():
                if s_key in self.slice_limits:
                    self.slice_limits[s_key]["min"] = val

    def _sync_with_gateway(self, new_allocations: dict):
        """Translates approved slice allocations to the gateway enforcement adapter."""
        if not self.gateway_adapter:
            return
        try:
            success, msg, enforced = self.gateway_adapter.apply_allocation(new_allocations)
            self.last_enforcement_status = {
                "success": success,
                "message": msg,
                "enforced_allocations": enforced if success else {},
                "timestamp": time.time(),
                "status": getattr(self.gateway_adapter, "status", "ENFORCED" if success else "FALLBACK_VIRTUAL")
            }
        except Exception as e:
            self.last_enforcement_status = {
                "success": False,
                "message": f"Gateway sync exception: {str(e)}",
                "enforced_allocations": {},
                "timestamp": time.time(),
                "status": "ERROR"
            }

    def check_configuration_feasibility(self, limits: dict = None, total_budget: float = None) -> tuple:
        """
        Validates whether minimum slice guarantees fit within the total available bandwidth.
        Returns: (is_feasible: bool, message: str)
        """
        budget = total_budget if total_budget is not None else self.total_bandwidth
        target_limits = limits if limits is not None else self.slice_limits
        
        total_min_required = sum(v.get("min", 0.0) for v in target_limits.values())
        if total_min_required > budget:
            return (
                False,
                f"Infeasible configuration conflict: Sum of mandatory minimum slice allocations "
                f"({total_min_required:.1f} Mbps) strictly exceeds available bandwidth budget ({budget:.1f} Mbps)."
            )
        return (True, f"Configuration feasible: Total minimum required {total_min_required:.1f} Mbps <= {budget:.1f} Mbps budget.")

    def set_slice_limits(self, new_limits: dict) -> tuple:
        feasible, msg = self.check_configuration_feasibility(limits=new_limits)
        if not feasible:
            return False, msg
        
        with self._lock:
            for k, v in new_limits.items():
                if k in self.slice_limits:
                    if "min" in v and v["min"] >= 0:
                        self.slice_limits[k]["min"] = float(v["min"])
                    if "max" in v and v["max"] >= self.slice_limits[k]["min"]:
                        self.slice_limits[k]["max"] = float(v["max"])
                    if "priority" in v:
                        self.slice_limits[k]["priority"] = int(v["priority"])
        
        save_action_log(self.db_path, "CONFIG", f"Updated slice limits & SLA constraints: {self.slice_limits}")
        return True, "Slice SLA limits successfully updated."

    def get_slice_limits(self) -> dict:
        with self._lock:
            return {k: dict(v) for k, v in self.slice_limits.items()}

    def set_custom_static_config(self, config: dict):
        total = sum(config.values())
        if total <= 0:
            return False, "Total bandwidth must be greater than 0"
        
        # Normalize to total_bandwidth pool if not exactly matching
        if total != self.total_bandwidth:
            scale = self.total_bandwidth / total
            config = {k: round(v * scale, 1) for k, v in config.items()}
            diff = round(self.total_bandwidth - sum(config.values()), 1)
            max_k = max(config, key=config.get)
            config[max_k] = round(config[max_k] + diff, 1)

        self.custom_static_config = config
        msg = f"Custom Static Pool applied: Low-Latency={config.get('low_latency')}M, High-BW={config.get('high_bandwidth')}M, General={config.get('general')}M"
        save_action_log(self.db_path, "CONFIG", msg)
        self.allocate_static()
        return True, msg

    def _record_decision(self, strategy: str, decision_type: str, prev_alloc: dict, new_alloc: dict, reason: str, predicted: dict = None):
        entry = {
            "timestamp": time.time(),
            "strategy": strategy,
            "decision_type": decision_type,
            "previous_allocations": {k: round(v, 1) for k, v in prev_alloc.items()},
            "new_allocations": {k: round(v, 1) for k, v in new_alloc.items()},
            "predicted_demands": {k: round(v, 1) for k, v in (predicted or {}).items()},
            "reason": reason,
            "total_budget": self.total_bandwidth
        }
        with self._lock:
            self.decision_history.append(entry)
            if len(self.decision_history) > 100:
                self.decision_history.pop(0)

    def get_decision_history(self, limit: int = 30) -> list:
        with self._lock:
            return list(reversed(self.decision_history[-limit:]))

    def allocate_static(self):
        with self._lock:
            prev = {k: s.allocated_bandwidth for k, s in self.slices.items()}
            changed = False
            for key, val in self.custom_static_config.items():
                if key in self.slices and abs(self.slices[key].allocated_bandwidth - val) > 0.01:
                    changed = True
                    self.slices[key].allocated_bandwidth = val
            
            if changed:
                new_all = {k: s.allocated_bandwidth for k, s in self.slices.items()}
                reason = "Static baseline applied via configured proportions."
                self._record_decision("static", "MANUAL_STATIC", prev, new_all, reason)
                save_action_log(
                    self.db_path,
                    "STATIC-ALLOC",
                    f"Static allocations updated: Low-Latency={self.slices['low_latency'].allocated_bandwidth}M, High-BW={self.slices['high_bandwidth'].allocated_bandwidth}M, General={self.slices['general'].allocated_bandwidth}M"
                )
                self._sync_with_gateway(new_all)

    def allocate_rule_based(self, monitor_snapshot):
        if not monitor_snapshot or "slices" not in monitor_snapshot:
            return
        
        with self._lock:
            latest = monitor_snapshot["slices"]
            prev = {k: s.allocated_bandwidth for k, s in self.slices.items()}
            
            # Rule 1: Low-Latency constraint relief (URLLC has highest SLA priority)
            if latest["low_latency"]["utilization"] > 85 or latest["low_latency"].get("packets_dropped", 0) > 0:
                donor = None
                gen_min = self.slice_limits["general"]["min"]
                hb_min = self.slice_limits["high_bandwidth"]["min"]
                ll_max = self.slice_limits["low_latency"]["max"]
                
                if (latest["general"]["utilization"] < 65 and 
                    self.slices["general"].allocated_bandwidth - 5.0 >= gen_min and 
                    self.slices["low_latency"].allocated_bandwidth + 5.0 <= ll_max):
                    donor = "general"
                elif (latest["high_bandwidth"]["utilization"] < 70 and 
                      self.slices["high_bandwidth"].allocated_bandwidth - 5.0 >= hb_min and 
                      self.slices["low_latency"].allocated_bandwidth + 5.0 <= ll_max):
                    donor = "high_bandwidth"
                    
                if donor:
                    shift_mbps = 5.0
                    self.slices[donor].allocated_bandwidth -= shift_mbps
                    self.slices["low_latency"].allocated_bandwidth += shift_mbps
                    new_all = {k: s.allocated_bandwidth for k, s in self.slices.items()}
                    reason = f"Reactive QoS relief: Low-Latency utilization exceeded 85%, shifted {shift_mbps}M from {donor}."
                    self._record_decision("rule_based", "REACTIVE_THRESHOLD", prev, new_all, reason)
                    save_action_log(self.db_path, "RULE-ENGINE", reason)
                    self._sync_with_gateway(new_all)
                    return

            # Rule 2: High-Bandwidth heavy load (eMBB burst)
            if latest["high_bandwidth"]["utilization"] > 90 and latest["general"]["utilization"] < 40:
                gen_min = self.slice_limits["general"]["min"]
                hb_max = self.slice_limits["high_bandwidth"]["max"]
                if (self.slices["general"].allocated_bandwidth - 4.0 >= gen_min and
                    self.slices["high_bandwidth"].allocated_bandwidth + 4.0 <= hb_max):
                    shift_mbps = 4.0
                    self.slices["general"].allocated_bandwidth -= shift_mbps
                    self.slices["high_bandwidth"].allocated_bandwidth += shift_mbps
                    new_all = {k: s.allocated_bandwidth for k, s in self.slices.items()}
                    reason = f"Reactive capacity boost: High-Bandwidth utilization > 90%, shifted {shift_mbps}M from General."
                    self._record_decision("rule_based", "REACTIVE_THRESHOLD", prev, new_all, reason)
                    save_action_log(self.db_path, "RULE-ENGINE", reason)
                    self._sync_with_gateway(new_all)
                    return

            # Rule 3: Rebalance back towards baseline if all utilization is low (idle capacity return)
            if (latest["low_latency"]["utilization"] < 40 and 
                latest["high_bandwidth"]["utilization"] < 50 and 
                self.slices["low_latency"].allocated_bandwidth > 30.0):
                excess = self.slices["low_latency"].allocated_bandwidth - 30.0
                shift = min(excess, 3.0)
                if self.slices["high_bandwidth"].allocated_bandwidth + shift <= self.slice_limits["high_bandwidth"]["max"]:
                    self.slices["low_latency"].allocated_bandwidth -= shift
                    self.slices["high_bandwidth"].allocated_bandwidth += shift
                    new_all = {k: s.allocated_bandwidth for k, s in self.slices.items()}
                    reason = f"Idle capacity recovery: Returned {shift}M from underutilized Low-Latency to High-Bandwidth pool."
                    self._record_decision("rule_based", "IDLE_RECOVERY", prev, new_all, reason)
                    save_action_log(self.db_path, "RULE-ENGINE", reason)
                    self._sync_with_gateway(new_all)

    def allocate_ai_assisted(self, predicted_demands: dict):
        if not predicted_demands:
            self.allocate_static()
            return

        with self._lock:
            prev = {k: s.allocated_bandwidth for k, s in self.slices.items()}
            total_predicted = sum(predicted_demands.values())
            
            # Fallback if prediction is empty or flat-zero
            if total_predicted <= 0.01:
                self.allocate_static()
                return

            # Step 1: Assign mandatory minimum bandwidth guarantees for all slices
            new_allocations = {}
            for k in self.slices.keys():
                min_limit = self.slice_limits.get(k, {}).get("min", 5.0)
                new_allocations[k] = min_limit

            sum_min = sum(new_allocations.values())
            remaining_pool = max(0.0, self.total_bandwidth - sum_min)

            # Step 2: Priority-weighted demand projection
            # Priority weights: URLLC=1.4x, General=1.0x, eMBB=1.0x
            weights = {
                "low_latency": 1.4,
                "high_bandwidth": 1.0,
                "general": 1.0
            }
            weighted_demands = {
                k: max(0.1, predicted_demands.get(k, 1.0) * weights.get(k, 1.0))
                for k in self.slices.keys()
            }
            sum_weighted = sum(weighted_demands.values())

            # Step 3: Proportional distribution of remaining budget pool
            for k in self.slices.keys():
                share = (weighted_demands[k] / sum_weighted) * remaining_pool
                new_allocations[k] = round(new_allocations[k] + share, 1)

            # Step 4: Enforce max limits
            for k in self.slices.keys():
                max_limit = self.slice_limits.get(k, {}).get("max", 85.0)
                if new_allocations[k] > max_limit:
                    new_allocations[k] = max_limit

            # Step 5: Normalize sum strictly to total_bandwidth invariant
            current_sum = sum(new_allocations.values())
            diff = round(self.total_bandwidth - current_sum, 1)
            
            # Allocate residual difference respecting bounds
            if abs(diff) > 0.01:
                # If positive diff, give to highest demand slice under max
                # If negative diff, trim from lowest priority slice above min
                if diff > 0:
                    sorted_slices = sorted(self.slices.keys(), key=lambda x: predicted_demands.get(x, 0), reverse=True)
                    for s_k in sorted_slices:
                        room = self.slice_limits[s_k]["max"] - new_allocations[s_k]
                        if room > 0:
                            add_val = min(diff, room)
                            new_allocations[s_k] = round(new_allocations[s_k] + add_val, 1)
                            diff = round(diff - add_val, 1)
                            if abs(diff) < 0.01:
                                break
                else:
                    # Negative diff (over-allocated), trim from low priority
                    sorted_slices = sorted(self.slices.keys(), key=lambda x: self.slice_limits[x]["priority"], reverse=True)
                    for s_k in sorted_slices:
                        surplus = new_allocations[s_k] - self.slice_limits[s_k]["min"]
                        if surplus > 0:
                            sub_val = min(abs(diff), surplus)
                            new_allocations[s_k] = round(new_allocations[s_k] - sub_val, 1)
                            diff = round(diff + sub_val, 1)
                            if abs(diff) < 0.01:
                                break

            # Step 6: Enforce non-negativity and final safety bound
            for k in self.slices.keys():
                new_allocations[k] = max(0.0, new_allocations[k])

            # Step 7: Hysteresis / Stability Damping
            # Avoid frequent micro-oscillations if change is below min_change_threshold
            significant_change = False
            for k in self.slices.keys():
                if abs(self.slices[k].allocated_bandwidth - new_allocations[k]) >= self.min_change_threshold:
                    significant_change = True
                    break

            if significant_change:
                for k in self.slices.keys():
                    self.slices[k].allocated_bandwidth = new_allocations[k]

                reason = (
                    f"Proactive AI Optimization: Predicted demand shift (LL={predicted_demands.get('low_latency',0):.1f}M, "
                    f"HB={predicted_demands.get('high_bandwidth',0):.1f}M, Gen={predicted_demands.get('general',0):.1f}M). "
                    f"Enforced SLA bounds and balanced pool."
                )
                self._record_decision("ai_assisted", "PROACTIVE_PREDICTION", prev, new_allocations, reason, predicted_demands)
                save_action_log(self.db_path, "AI-ACTION", reason)
                self._sync_with_gateway(new_allocations)
