"""
NetSlice Comprehensive Automated Test Suite.
Verifies all 12 required test specifications from Section 15 of the Master Implementation Prompt:
- Test 1: Resource budget (sum <= total_bandwidth, non-negative)
- Test 2: Minimum and maximum limits respected
- Test 3: Infeasible configuration detection & conflict reporting
- Test 4: Demand burst detection and proactive reallocation
- Test 5: Idle capacity redistribution
- Test 6: Overload handling without exceeding budget
- Test 7: Prediction failure fallback without crashing
- Test 8: Application profile to slice classification
- Test 9: Telemetry accuracy and valid measurements
- Test 10: API integration endpoints
- Test 11: Experiment fairness (identical workloads and seeds)
- Test 12: Regression testing (DHCP, DNS, Multicast, Sockets)
"""

import sys
import os
import unittest
import json
import urllib.request
import urllib.error

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from simulation.slices import NetworkSlice, initialize_slices
from simulation.allocation import ResourceAllocationEngine
from simulation.ml_engine import MLEngine
from simulation.application_profiles import profile_registry
from simulation.traffic_generator import TrafficGenerator
from simulation.experiment_runner import simulate_strategy_run, run_fair_experiment_comparison
from simulation.dhcp import dhcp_server
from simulation.dns import dns_server
from simulation.multicast import multicast_mgr

class TestNetSliceSystem(unittest.TestCase):

    def setUp(self):
        self.slices = initialize_slices()
        self.alloc_engine = ResourceAllocationEngine(self.slices, db_path=None)

    def test_01_resource_budget_invariants(self):
        """Test 1: All slice allocations are non-negative and sum does not exceed total bandwidth."""
        # Test across multiple arbitrary demand distributions
        test_cases = [
            {"low_latency": 20, "high_bandwidth": 40, "general": 10},
            {"low_latency": 60, "high_bandwidth": 80, "general": 30},
            {"low_latency": 5, "high_bandwidth": 5, "general": 5},
            {"low_latency": 0, "high_bandwidth": 100, "general": 0}
        ]
        for dem in test_cases:
            self.alloc_engine.allocate_ai_assisted(dem)
            total = sum(s.allocated_bandwidth for s in self.slices.values())
            self.assertAlmostEqual(total, self.alloc_engine.total_bandwidth, places=1,
                                   msg=f"Total allocation {total} exceeded {self.alloc_engine.total_bandwidth}")
            for k, s in self.slices.items():
                self.assertGreaterEqual(s.allocated_bandwidth, 0.0, msg=f"Slice {k} allocation was negative!")

    def test_02_min_max_limits(self):
        """Test 2: Every slice respects feasible configured limits."""
        limits = {
            "low_latency": {"min": 15.0, "max": 50.0},
            "high_bandwidth": {"min": 20.0, "max": 70.0},
            "general": {"min": 8.0, "max": 40.0}
        }
        success, msg = self.alloc_engine.set_slice_limits(limits)
        self.assertTrue(success, msg)

        # Allocate with extreme low demands
        self.alloc_engine.allocate_ai_assisted({"low_latency": 1, "high_bandwidth": 1, "general": 1})
        for k, lim in limits.items():
            self.assertGreaterEqual(self.slices[k].allocated_bandwidth, lim["min"] - 0.1)
            self.assertLessEqual(self.slices[k].allocated_bandwidth, lim["max"] + 0.1)

    def test_03_infeasible_configuration(self):
        """Test 3: If mandatory minimums exceed the budget, system reports configuration conflict."""
        infeasible_limits = {
            "low_latency": {"min": 50.0, "max": 80.0},
            "high_bandwidth": {"min": 40.0, "max": 90.0},
            "general": {"min": 30.0, "max": 50.0}  # 50 + 40 + 30 = 120 > 100
        }
        feasible, msg = self.alloc_engine.check_configuration_feasibility(limits=infeasible_limits)
        self.assertFalse(feasible, "Infeasible configuration was incorrectly marked feasible!")
        self.assertIn("Infeasible configuration conflict", msg)

        # Ensure engine rejects it
        success, err = self.alloc_engine.set_slice_limits(infeasible_limits)
        self.assertFalse(success)

    def test_04_demand_burst_detection(self):
        """Test 4: A simulated burst in gaming demand shifts capacity to low-latency slice."""
        # Initial baseline allocation
        self.alloc_engine.allocate_static()
        initial_ll = self.slices["low_latency"].allocated_bandwidth
        
        # Gaming burst: LL demand surges to 50 Mbps while others remain low
        burst_demands = {"low_latency": 50.0, "high_bandwidth": 15.0, "general": 8.0}
        self.alloc_engine.allocate_ai_assisted(burst_demands)
        new_ll = self.slices["low_latency"].allocated_bandwidth
        
        self.assertGreater(new_ll, initial_ll, "Low-latency slice was not allocated extra capacity during gaming burst!")
        self.assertAlmostEqual(sum(s.allocated_bandwidth for s in self.slices.values()), 100.0, places=1)

    def test_05_idle_capacity_redistribution(self):
        """Test 5: System redistributes eligible unused resources according to allocation policy."""
        # When Low-Latency is completely idle, capacity flows toward active slices
        idle_demands = {"low_latency": 2.0, "high_bandwidth": 70.0, "general": 10.0}
        self.alloc_engine.allocate_ai_assisted(idle_demands)
        
        hb_alloc = self.slices["high_bandwidth"].allocated_bandwidth
        ll_alloc = self.slices["low_latency"].allocated_bandwidth
        
        # High bandwidth should receive the bulk of spare capacity
        self.assertGreater(hb_alloc, 50.0)
        # LL should remain at or near its guaranteed minimum (10.0)
        self.assertGreaterEqual(ll_alloc, self.alloc_engine.slice_limits["low_latency"]["min"])

    def test_06_overload_protection(self):
        """Test 6: When total demand exceeds capacity (170M vs 100M), priority and guarantees are preserved without exceeding budget."""
        overload_demands = {"low_latency": 50.0, "high_bandwidth": 80.0, "general": 40.0}
        self.alloc_engine.allocate_ai_assisted(overload_demands)
        
        total = sum(s.allocated_bandwidth for s in self.slices.values())
        self.assertAlmostEqual(total, 100.0, places=1)
        for k in self.slices.keys():
            self.assertGreaterEqual(self.slices[k].allocated_bandwidth, self.alloc_engine.slice_limits[k]["min"])

    def test_07_prediction_failure_fallback(self):
        """Test 7: Missing or failed ML model triggers documented fallback without crashing."""
        ml = MLEngine(db_path=None)
        # Completely untrained engine
        self.assertFalse(ml.is_trained)
        
        # Prediction on empty or anomalous snapshot
        preds_empty = ml.predict_demand({})
        self.assertEqual(preds_empty, {})
        
        # Fallback prediction on valid snapshot
        snapshot = {
            "slices": {
                "low_latency": {"throughput_mbps": 12.0, "avg_latency": 0.01, "utilization": 40, "packets_dropped": 0},
                "high_bandwidth": {"throughput_mbps": 30.0, "avg_latency": 0.03, "utilization": 60, "packets_dropped": 0},
                "general": {"throughput_mbps": 10.0, "avg_latency": 0.02, "utilization": 50, "packets_dropped": 0}
            }
        }
        preds = ml.predict_demand(snapshot)
        self.assertIn("low_latency", preds)
        self.assertGreater(preds["low_latency"], 12.0)  # Heuristic headroom applied
        
        # Allocator handles fallback seamlessly
        self.alloc_engine.allocate_ai_assisted(preds)
        total = sum(s.allocated_bandwidth for s in self.slices.values())
        self.assertAlmostEqual(total, 100.0, places=1)

    def test_08_traffic_classification_profiles(self):
        """Test 8: Each configured application profile maps to the expected logical slice."""
        profiles = profile_registry.get_all()
        self.assertEqual(len(profiles), 8, "Expected exactly 8 application profiles!")
        
        # Verify canonical mappings
        self.assertEqual(profiles["online_gaming"]["preferred_slice"], "low_latency")
        self.assertEqual(profiles["video_calling"]["preferred_slice"], "low_latency")
        self.assertEqual(profiles["video_streaming"]["preferred_slice"], "high_bandwidth")
        self.assertEqual(profiles["reels_short_video"]["preferred_slice"], "high_bandwidth")
        self.assertEqual(profiles["large_downloads"]["preferred_slice"], "high_bandwidth")
        self.assertEqual(profiles["messaging"]["preferred_slice"], "general")
        self.assertEqual(profiles["web_browsing"]["preferred_slice"], "general")
        self.assertEqual(profiles["background_transfers"]["preferred_slice"], "general")
        
        # Verify custom reconfiguration
        success = profile_registry.update_profile("web_browsing", {"preferred_slice": "low_latency"})
        self.assertTrue(success)
        self.assertEqual(profile_registry.get_profile("web_browsing")["preferred_slice"], "low_latency")
        # Reset back
        profile_registry.reset_defaults()
        self.assertEqual(profile_registry.get_profile("web_browsing")["preferred_slice"], "general")

    def test_09_telemetry_accuracy(self):
        """Test 9: Measured values are computed from packet processing rather than random numbers."""
        test_slice = NetworkSlice("URLLC", 20.0)
        packet_size = 12000
        # Process 100 packets
        for _ in range(100):
            test_slice.process_packet(packet_size)
            
        self.assertEqual(test_slice.packets_processed, 100)
        self.assertEqual(test_slice.current_usage, 100 * packet_size)
        self.assertGreater(test_slice.latency_sum, 0.0)
        avg_lat = test_slice.latency_sum / test_slice.packets_processed
        self.assertGreater(avg_lat, 0.005)

    def test_10_api_integration(self):
        """Test 10: Backend API routes respond successfully with valid schemas."""
        from main import get_application_profiles, get_allocation_decisions, get_slice_limits
        
        resp_prof = get_application_profiles()
        self.assertEqual(resp_prof["status"], "success")
        self.assertIn("profiles", resp_prof)
        self.assertEqual(len(resp_prof["profiles"]), 8)
        
        resp_dec = get_allocation_decisions()
        self.assertEqual(resp_dec["status"], "success")
        self.assertIn("decisions", resp_dec)
        
        resp_limits = get_slice_limits()
        self.assertEqual(resp_limits["status"], "success")
        self.assertIn("limits", resp_limits)

    def test_11_experiment_fairness(self):
        """Test 11: All 3 strategies execute under identical workload and total capacity in comparative benchmark."""
        comp = run_fair_experiment_comparison("gaming_burst", duration_ticks=10, seed=12345, db_path=None)
        strategies = comp["strategies"]
        
        self.assertIn("static", strategies)
        self.assertIn("rule_based", strategies)
        self.assertIn("ai_assisted", strategies)
        
        # Verify AI strategy computes prediction metrics
        self.assertIsNotNone(strategies["ai_assisted"]["prediction_mae"])
        self.assertIsNotNone(strategies["ai_assisted"]["prediction_rmse"])
        
        # Verify trade-offs summary exists
        self.assertIn("latency_reduction_pct", comp["tradeoffs_summary"])

    def test_12_regression_protocols(self):
        """Test 12: DHCP leasing, DNS resolution, and IPv4 multicast continue to function without regressions."""
        # DHCP
        lease = dhcp_server.request_ip("AA:BB:CC:DD:EE:FE", "low_latency")
        self.assertIsNotNone(lease)
        self.assertTrue(lease["ip"].startswith("192.168.1."))
        
        # DNS
        res = dns_server.resolve("urllc.slice.5g")
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["resolved_ip"], "127.0.0.1")
        self.assertEqual(res["slice"], "Low-Latency")
        
        # Multicast
        status = multicast_mgr.get_status()
        self.assertEqual(status["group_ip"], "224.0.0.100")
        self.assertEqual(status["total_subscribers"], 3)

if __name__ == "__main__":
    unittest.main()
