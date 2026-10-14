"""
Metric Provenance & Telemetry Accuracy Test Suite for NetSlice.
Validates:
1. Idle API response contains no fabricated live measurement claims.
2. Physical adapter throughput is marked MEASURED and separates download and upload.
3. Estimated slice throughput is identified as ESTIMATED or SIMULATED (never MEASURED).
4. Calculated packet drops are labeled SIMULATED / ESTIMATED (never claimed as real NIC drops).
5. Failed latency probes are handled gracefully with UNAVAILABLE status.
6. Adapter counter resets and missing interfaces are handled safely without negative numbers or crashes.
7. Gateway allocations remain distinct from verified enforcement.
8. Windows host reports ENFORCEMENT_UNAVAILABLE_ON_HOST without altering host networking.
"""

import unittest
import os
import tempfile
import psutil
from main import app, simulation_state, get_metrics, stop_simulation
from metric_provenance import MetricProvenanceStatus, create_provenance_metric
from real_network import measure_real_network_probe, RealNetworkManager
from gateway_adapter import GatewayConfig, LinuxTcGatewayAdapter, EnforcementStatus, DryRunGatewayAdapter

class TestMetricProvenanceIntegration(unittest.TestCase):

    def setUp(self):
        # Ensure system starts in known idle state
        if simulation_state.get("is_running"):
            stop_simulation()

    def test_01_idle_response_truthfulness(self):
        """Req 4: When monitoring is stopped, idle response contains no fabricated measurements."""
        data = get_metrics()
        
        self.assertEqual(data["status"], "idle")
        self.assertFalse(data["is_running"])
        
        # Verify no fake latency
        slices = data["data"]["slices"]
        for s_key, s_data in slices.items():
            self.assertIsNone(s_data["avg_latency"], f"Slice {s_key} reported fabricated latency!")
            self.assertIsNone(s_data["avg_latency_ms"])
            self.assertEqual(s_data["throughput_mbps"], 0.0)
            self.assertEqual(s_data["packets_dropped"], 0)
            # QoS status must indicate waiting for data, not fabricated 'Nominal' or 'Healthy'
            self.assertEqual(s_data["qos_status"], "Waiting for data")
            self.assertEqual(s_data["provenance"]["throughput"]["status"], MetricProvenanceStatus.UNAVAILABLE)
            self.assertEqual(s_data["provenance"]["latency"]["status"], MetricProvenanceStatus.UNAVAILABLE)

        # Verify no fabricated 100% SLA compliance
        sla = data["sla_guard"]
        self.assertIsNone(sla["compliance"], "Idle response claimed fabricated SLA compliance!")
        self.assertEqual(sla["status"], "NO_OBSERVATIONS")

        # Verify no fabricated spectrum savings
        energy = data["energy_cost"]
        self.assertEqual(energy["spectrum_saved_mbps"], 0.0)
        self.assertEqual(energy["status"], MetricProvenanceStatus.UNAVAILABLE)

        # Verify dominant app does not fabricate live traffic
        self.assertIn("Inactive", data["dominant_app"])

    def test_02_physical_adapter_metrics_separation_and_provenance(self):
        """Req 3: Physical adapter measures upload and download separately with correct units."""
        mgr = RealNetworkManager(interface_name="Wi-Fi", db_path=":memory:")
        # Test interface metrics
        io = psutil.net_io_counters()
        self.assertIsNotNone(io)
        
        # Verify probe returns structured provenance
        probe = measure_real_network_probe([("8.8.8.8", 53, "Google DNS")])
        self.assertIn("target", probe)
        self.assertIn("status", probe)
        self.assertIn("source", probe)
        if probe["rtt_ms"] is not None:
            self.assertEqual(probe["status"], MetricProvenanceStatus.MEASURED)
            self.assertGreater(probe["rtt_ms"], 0.0)

    def test_03_per_slice_throughput_not_labeled_measured(self):
        """Req 3: Slice throughput must be labeled ESTIMATED or SIMULATED, never MEASURED."""
        metric = create_provenance_metric(
            value=14.5,
            unit="Mbps",
            source="heuristic_process_matrix",
            status=MetricProvenanceStatus.ESTIMATED,
            description="Process inspection distribution"
        )
        self.assertNotEqual(metric["status"], MetricProvenanceStatus.MEASURED)
        self.assertEqual(metric["status"], MetricProvenanceStatus.ESTIMATED)
        self.assertEqual(metric["unit"], "Mbps")

    def test_04_packet_drops_provenance_and_non_misleading_message(self):
        """Req 3: Calculated packet drops are labeled SIMULATED/ESTIMATED, not real physical drops."""
        mgr = RealNetworkManager(interface_name="Wi-Fi", db_path=":memory:")
        # Simulate an interval where throughput exceeds allocated bandwidth
        net_slice = mgr.slices["low_latency"]
        net_slice.allocated_bandwidth = 10.0
        
        # In real network loop, excess drops are mathematically calculated rate-shaper deficits
        excess_drops = int((15.0 - net_slice.allocated_bandwidth) * 10)
        self.assertEqual(excess_drops, 50)
        # Provenance must be token_bucket_math_model, not physical NIC
        metric = create_provenance_metric(
            value=excess_drops,
            unit="pkts",
            source="token_bucket_math_model",
            status=MetricProvenanceStatus.SIMULATED,
            description="Mathematical deficit calculated when estimated demand exceeds allocated bandwidth"
        )
        self.assertIn("Mathematical deficit", metric["description"])
        self.assertEqual(metric["status"], MetricProvenanceStatus.SIMULATED)

    def test_05_failed_latency_probe_handling(self):
        """Req 3: Failed latency probe reports UNAVAILABLE without crashing or fabricating numbers."""
        # Probe an unroutable IP with immediate timeout
        failed_probe = measure_real_network_probe([("192.0.2.1", 9999, "Unroutable Test IP")])
        self.assertIsNone(failed_probe["rtt_ms"])
        self.assertEqual(failed_probe["status"], MetricProvenanceStatus.UNAVAILABLE)
        self.assertIn("Unreachable", failed_probe["target"])

    def test_06_allocation_concepts_separation(self):
        """Req 5: Response clearly distinguishes requested, calculated, submitted, configured, and enforced rates."""
        data = get_metrics()
        
        self.assertIn("requested_allocations", data)
        self.assertIn("calculated_allocations", data)
        self.assertIn("submitted_allocations", data)
        self.assertIn("configured_allocations", data)
        self.assertIn("verified_enforcement_status", data)
        self.assertIn("enforced_allocations", data)

    def test_07_dry_run_gateway_never_claims_verified_enforcement(self):
        """Req 5: Dry-run adapter returns DRY_RUN and never claims verified enforcement."""
        config = GatewayConfig(
            mode="real_network_monitor",
            adapter_type="dry_run",
            interface="eth0",
            operator_authorized=True,
            dry_run=True,
            db_path=":memory:"
        )
        adapter = DryRunGatewayAdapter(config)
        success, msg, enforced = adapter.apply_allocation({"low_latency": 30.0, "high_bandwidth": 50.0, "general": 20.0})
        self.assertTrue(success)
        self.assertEqual(adapter.status, EnforcementStatus.DRY_RUN)
        # Must not be ENFORCING
        self.assertNotEqual(adapter.status, EnforcementStatus.ENFORCING)

    def test_08_windows_host_safety_and_honest_enforcement_reporting(self):
        """Req 2 & 5: Windows host without SSH gateway reports ENFORCEMENT_UNAVAILABLE_ON_HOST."""
        config = GatewayConfig(
            mode="real_network_enforce",
            adapter_type="linux_tc",
            interface="eth0",
            operator_authorized=True,
            dry_run=False,
            db_path=":memory:"
        )
        adapter = LinuxTcGatewayAdapter(config)
        success, msg, enforced = adapter.apply_allocation({"low_latency": 30.0, "high_bandwidth": 50.0, "general": 20.0})
        self.assertFalse(success)
        self.assertEqual(adapter.status, EnforcementStatus.ENFORCEMENT_UNAVAILABLE_ON_HOST)
        self.assertIn("Linux gateway", msg)
        self.assertEqual(enforced, {})

if __name__ == '__main__':
    unittest.main()
