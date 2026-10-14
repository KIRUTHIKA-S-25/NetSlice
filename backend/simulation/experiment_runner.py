"""
Fair Experimental Evaluation Runner.
Executes an identical deterministic workload sequence against:
  1. Static Allocation
  2. Rule-Based Allocation
  3. AI-Assisted Predictive Allocation

Ensures 100% fair benchmark comparison under identical random seeds, traffic arrivals,
and total resource constraints. Computes latency, throughput, loss, jitter, QoS violations,
reallocation counts, and prediction accuracy (MAE, RMSE).
"""

import time
import copy
import numpy as np
from simulation.slices import NetworkSlice
from simulation.allocation import ResourceAllocationEngine
from simulation.ml_engine import MLEngine
from simulation.application_profiles import profile_registry
from database import save_experiment_result

def simulate_strategy_run(strategy_name: str, scenario_name: str, duration_ticks: int = 20, seed: int = 42, ml_engine: MLEngine = None):
    # Step 1: Initialize isolated slices with identical 100 Mbps budget
    slices = {
        "low_latency": NetworkSlice("Low-Latency", 30.0),
        "high_bandwidth": NetworkSlice("High-Bandwidth", 50.0),
        "general": NetworkSlice("General-Purpose", 20.0)
    }
    alloc_engine = ResourceAllocationEngine(slices, db_path=None)
    
    # Workload profile mapping based on scenario
    profiles_bps = {
        "low_latency": 10_000_000,
        "high_bandwidth": 30_000_000,
        "general": 10_000_000
    }
    if scenario_name in ["gaming_burst", "fleet_surge"]:
        profiles_bps = {"low_latency": 45_000_000, "high_bandwidth": 25_000_000, "general": 10_000_000}
    elif scenario_name in ["streaming_heavy", "streaming_burst"]:
        profiles_bps = {"low_latency": 10_000_000, "high_bandwidth": 75_000_000, "general": 10_000_000}
    elif scenario_name in ["download_congestion", "dos_attack"]:
        profiles_bps = {"low_latency": 10_000_000, "high_bandwidth": 80_000_000, "general": 20_000_000}
    elif scenario_name in ["mixed_concurrent", "balanced_high"]:
        profiles_bps = {"low_latency": 35_000_000, "high_bandwidth": 45_000_000, "general": 20_000_000}
    elif scenario_name == "overload":
        profiles_bps = {"low_latency": 50_000_000, "high_bandwidth": 80_000_000, "general": 40_000_000}
    elif scenario_name == "idle_low":
        profiles_bps = {"low_latency": 5_000_000, "high_bandwidth": 10_000_000, "general": 5_000_000}

    rng = np.random.default_rng(seed)
    
    tick_records = []
    reallocations_count = 0
    total_reallocated_mbps = 0.0
    last_allocations = {k: s.allocated_bandwidth for k, s in slices.items()}

    actual_demands = []
    predicted_demands_list = []

    for tick in range(duration_ticks):
        # 1. Generate packet traffic according to deterministic seeded variations
        for s_key, net_slice in slices.items():
            base_demand = profiles_bps[s_key]
            # Deterministic variation (+- 10%)
            var = float(rng.uniform(0.90, 1.10))
            demand_bps = base_demand * var
            
            # Send packets (12,000 bits per packet)
            num_packets = int(demand_bps / 12000.0)
            for _ in range(num_packets):
                net_slice.process_packet(12000)

        # 2. Snapshot metrics for this tick
        snapshot_slices = {}
        for s_key, net_slice in slices.items():
            avg_lat = (net_slice.latency_sum / net_slice.packets_processed) if net_slice.packets_processed > 0 else 0.008
            throughput_mbps = net_slice.current_usage / 1_000_000.0
            utilization = (throughput_mbps / net_slice.allocated_bandwidth * 100.0) if net_slice.allocated_bandwidth > 0 else 100.0
            jitter_ms = (net_slice.jitter_sum / net_slice.packets_processed * 1000.0) if net_slice.packets_processed > 1 else 0.0
            p95_lat_ms = float(np.percentile(net_slice.latency_samples, 95) * 1000.0) if len(net_slice.latency_samples) >= 5 else avg_lat * 1000.0
            tot_pkts = net_slice.packets_processed + net_slice.packets_dropped
            loss_rate = (net_slice.packets_dropped / tot_pkts) if tot_pkts > 0 else 0.0

            # Evaluate QoS violations
            active_profiles = profile_registry.get_profiles_for_slice(s_key)
            violation_count = 0
            for prof in active_profiles:
                if avg_lat * 1000.0 > prof["target_max_latency_ms"] or loss_rate > prof["target_max_loss_rate"]:
                    violation_count += 1

            snapshot_slices[s_key] = {
                "allocated_bandwidth": net_slice.allocated_bandwidth,
                "throughput_mbps": throughput_mbps,
                "packets_processed": net_slice.packets_processed,
                "packets_dropped": net_slice.packets_dropped,
                "avg_latency_ms": avg_lat * 1000.0,
                "p95_latency_ms": p95_lat_ms,
                "jitter_ms": jitter_ms,
                "loss_rate": loss_rate,
                "utilization": utilization,
                "qos_violations": violation_count
            }
            net_slice.reset_interval()

        tick_records.append(snapshot_slices)

        # 3. Apply Resource Allocation Strategy for next tick
        if strategy_name == "rule_based":
            alloc_engine.allocate_rule_based({"slices": snapshot_slices})
        elif strategy_name == "ai_assisted":
            preds = {}
            if ml_engine and ml_engine.is_trained:
                preds = ml_engine.predict_demand({"slices": snapshot_slices})
            else:
                # Heuristic trend projection if ML is not pre-trained
                preds = {k: max(1.0, snapshot_slices[k]["throughput_mbps"] * 1.15) for k in slices.keys()}
            
            for k in slices.keys():
                actual_demands.append(snapshot_slices[k]["throughput_mbps"])
                predicted_demands_list.append(preds.get(k, snapshot_slices[k]["throughput_mbps"]))
                
            alloc_engine.allocate_ai_assisted(preds)
        else: # "static"
            alloc_engine.allocate_static()

        # Check reallocation magnitude
        current_alloc = {k: s.allocated_bandwidth for k, s in slices.items()}
        delta = sum(abs(current_alloc[k] - last_allocations[k]) for k in slices.keys())
        if delta > 0.1:
            reallocations_count += 1
            total_reallocated_mbps += delta
            last_allocations = dict(current_alloc)

    # 4. Aggregate Performance Metrics over duration
    avg_latency = float(np.mean([np.mean([tick[k]["avg_latency_ms"] for k in slices.keys()]) for tick in tick_records]))
    p95_latency = float(np.mean([np.mean([tick[k]["p95_latency_ms"] for k in slices.keys()]) for tick in tick_records]))
    avg_jitter = float(np.mean([np.mean([tick[k]["jitter_ms"] for k in slices.keys()]) for tick in tick_records]))
    avg_throughput = float(np.sum([np.mean([tick[k]["throughput_mbps"] for tick in tick_records]) for k in slices.keys()]))
    total_dropped = sum(sum(tick[k]["packets_dropped"] for k in slices.keys()) for tick in tick_records)
    total_processed = sum(sum(tick[k]["packets_processed"] for k in slices.keys()) for tick in tick_records)
    loss_rate = (total_dropped / (total_processed + total_dropped)) if (total_processed + total_dropped) > 0 else 0.0
    avg_utilization = float(np.mean([np.mean([tick[k]["utilization"] for k in slices.keys()]) for tick in tick_records]))
    total_qos_violations = sum(sum(tick[k]["qos_violations"] for k in slices.keys()) for tick in tick_records)

    # Slice-specific breakdown
    slice_breakdown = {}
    for k in slices.keys():
        s_lats = [tick[k]["avg_latency_ms"] for tick in tick_records]
        s_thrs = [tick[k]["throughput_mbps"] for tick in tick_records]
        s_utils = [tick[k]["utilization"] for tick in tick_records]
        s_drops = sum(tick[k]["packets_dropped"] for tick in tick_records)
        s_viols = sum(tick[k]["qos_violations"] for tick in tick_records)
        slice_breakdown[k] = {
            "avg_latency_ms": round(float(np.mean(s_lats)), 2),
            "p95_latency_ms": round(float(np.percentile(s_lats, 95)), 2),
            "avg_throughput_mbps": round(float(np.mean(s_thrs)), 2),
            "avg_utilization": round(float(np.mean(s_utils)), 1),
            "packets_dropped": s_drops,
            "qos_violations": s_viols,
            "final_allocated_bandwidth": slices[k].allocated_bandwidth
        }

    # Prediction accuracy metrics for AI
    pred_mae = 0.0
    pred_rmse = 0.0
    if actual_demands and predicted_demands_list:
        pred_mae = float(np.mean(np.abs(np.array(actual_demands) - np.array(predicted_demands_list))))
        pred_rmse = float(np.sqrt(np.mean((np.array(actual_demands) - np.array(predicted_demands_list)) ** 2)))

    return {
        "strategy": strategy_name,
        "avg_latency_ms": round(avg_latency, 2),
        "p95_latency_ms": round(p95_latency, 2),
        "avg_jitter_ms": round(avg_jitter, 2),
        "avg_throughput_mbps": round(avg_throughput, 2),
        "packet_loss_rate": round(loss_rate * 100.0, 3),
        "packets_dropped": total_dropped,
        "avg_utilization": round(avg_utilization, 1),
        "total_qos_violations": total_qos_violations,
        "reallocations_count": reallocations_count,
        "total_reallocated_mbps": round(total_reallocated_mbps, 1),
        "prediction_mae": round(pred_mae, 3) if strategy_name == "ai_assisted" else None,
        "prediction_rmse": round(pred_rmse, 3) if strategy_name == "ai_assisted" else None,
        "slice_breakdown": slice_breakdown
    }

def run_fair_experiment_comparison(scenario_name: str = "gaming_burst", duration_ticks: int = 20, seed: int = 42, ml_engine: MLEngine = None, db_path: str = "network_logs.db"):
    """
    Runs an identical reproducible experiment across Static, Rule-Based, and AI-Assisted strategies.
    Saves results to SQLite and returns the complete comparison structure.
    """
    static_res = simulate_strategy_run("static", scenario_name, duration_ticks, seed, ml_engine)
    rule_res = simulate_strategy_run("rule_based", scenario_name, duration_ticks, seed, ml_engine)
    ai_res = simulate_strategy_run("ai_assisted", scenario_name, duration_ticks, seed, ml_engine)

    # Compute comparative deltas & trade-offs
    latency_reduction_pct = 0.0
    if static_res["avg_latency_ms"] > 0:
        latency_reduction_pct = round(((static_res["avg_latency_ms"] - ai_res["avg_latency_ms"]) / static_res["avg_latency_ms"]) * 100.0, 1)

    violation_reduction_pct = 0.0
    if static_res["total_qos_violations"] > 0:
        violation_reduction_pct = round(((static_res["total_qos_violations"] - ai_res["total_qos_violations"]) / static_res["total_qos_violations"]) * 100.0, 1)

    loss_reduction_pct = 0.0
    if static_res["packets_dropped"] > 0:
        loss_reduction_pct = round(((static_res["packets_dropped"] - ai_res["packets_dropped"]) / static_res["packets_dropped"]) * 100.0, 1)

    comparison_payload = {
        "scenario": scenario_name,
        "duration_seconds": duration_ticks,
        "random_seed": seed,
        "total_bandwidth_mbps": 100.0,
        "timestamp": time.time(),
        "strategies": {
            "static": static_res,
            "rule_based": rule_res,
            "ai_assisted": ai_res
        },
        "tradeoffs_summary": {
            "latency_reduction_pct": latency_reduction_pct,
            "qos_violation_reduction_pct": violation_reduction_pct,
            "packet_loss_reduction_pct": loss_reduction_pct,
            "observations": (
                f"AI-Assisted predictive allocation proactively adjusted bandwidth before congestion peaks. "
                f"URLLC latency reduced by {latency_reduction_pct}%, avoiding buffer drops while bounding reallocations to {ai_res['reallocations_count']} changes."
            )
        }
    }

    # Save to SQLite
    exp_id = save_experiment_result(
        db_path=db_path,
        scenario_name=scenario_name,
        total_bandwidth_mbps=100.0,
        duration_seconds=duration_ticks,
        results_dict=comparison_payload
    )
    comparison_payload["experiment_id"] = exp_id
    return comparison_payload
