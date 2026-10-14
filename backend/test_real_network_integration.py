"""
Real-Network Integration Test Suite for NetSlice.
Verifies closed-loop predictive resource management on physical/gateway topologies:
1. Mode switching (Simulation vs Real-Network Monitoring vs Real-Network Enforcement).
2. Linux tc command generation and queue discipline parameters.
3. Budget invariants and over-allocation rejection.
4. Operator authorization safety gate.
5. Safe fallback behavior when gateway is unauthorized or unavailable.
6. Automatic rollback and clean teardown.
7. Truthful metric reporting (distinguishing Measured, Predicted, Calculated, Enforced, Estimated, Unavailable).
8. Physical device registry, classification source integrity, and TLS payload honesty.
"""

import unittest
import time
from gateway_adapter import (
    GatewayConfig,
    create_gateway_adapter,
    EnforcementStatus,
    DryRunGatewayAdapter,
    LinuxTcGatewayAdapter,
    LocalShaperGatewayAdapter
)
from device_manager import (
    DeviceManager,
    MetricConfidence,
    ClassificationSource
)
from simulation.slices import initialize_slices
from simulation.allocation import ResourceAllocationEngine

class TestRealNetworkIntegration(unittest.TestCase):

    def setUp(self):
        self.config = GatewayConfig(
            mode="real_network_monitor",
            adapter_type="dry_run",
            interface="eth0",
            parent_bandwidth_mbps=100.0,
            operator_authorized=False,
            dry_run=True,
            db_path=":memory:"
        )
        self.adapter = create_gateway_adapter(self.config)
        self.slices = initialize_slices()
        self.engine = ResourceAllocationEngine(self.slices, db_path=":memory:")
        self.engine.set_gateway_adapter(self.adapter)
        self.device_mgr = DeviceManager(db_path=":memory:")

    def test_mode_differentiation(self):
        """Requirement 1 & 13: System supports distinct Simulation, Monitoring, and Enforcement modes."""
        # 1. Monitoring mode
        self.config.mode = "real_network_monitor"
        self.config.operator_authorized = False
        adapter_mon = create_gateway_adapter(self.config)
        success, msg, enforced = adapter_mon.apply_allocation({"low_latency": 30.0, "high_bandwidth": 50.0, "general": 20.0})
        self.assertTrue(success)
        self.assertEqual(adapter_mon.status, EnforcementStatus.DRY_RUN)

        # 2. Enforcement mode with dry-run
        self.config.mode = "real_network_enforce"
        self.config.operator_authorized = True
        adapter_enf = create_gateway_adapter(self.config)
        success, msg, enforced = adapter_enf.apply_allocation({"low_latency": 35.0, "high_bandwidth": 45.0, "general": 20.0})
        self.assertTrue(success)
        self.assertEqual(enforced["low_latency"], 35.0)

    def test_tc_command_generation_syntax(self):
        """Requirement 5: Verify valid Linux tc HTB qdisc, classes, and filters generation."""
        adapter = DryRunGatewayAdapter(self.config)
        allocations = {"low_latency": 30.0, "high_bandwidth": 50.0, "general": 20.0}
        cmds = adapter.generate_tc_commands(allocations, is_initial=True)
        
        # Verify root qdisc
        self.assertTrue(any("tc qdisc add dev eth0 root handle 1: htb" in c for c in cmds))
        # Verify parent container
        self.assertTrue(any("tc class add dev eth0 parent 1: classid 1:1 htb rate 100mbit" in c for c in cmds))
        # Verify slice classes
        self.assertTrue(any("classid 1:10 htb rate 30.0mbit" in c for c in cmds))
        self.assertTrue(any("classid 1:20 htb rate 50.0mbit" in c for c in cmds))
        self.assertTrue(any("classid 1:30 htb rate 20.0mbit" in c for c in cmds))
        # Verify fq_codel latency targets
        self.assertTrue(any("fq_codel quantum 300 target 5ms" in c for c in cmds))
        # Verify socket port filters
        self.assertTrue(any("dport 9101" in c for c in cmds))
        self.assertTrue(any("dport 9102" in c for c in cmds))
        self.assertTrue(any("dport 9103" in c for c in cmds))

    def test_budget_invariant_validation(self):
        """Requirement 7: Allocations strictly exceeding parent capacity are rejected."""
        adapter = DryRunGatewayAdapter(self.config)
        # 40 + 50 + 20 = 110 Mbps > 100 Mbps
        invalid_allocations = {"low_latency": 40.0, "high_bandwidth": 50.0, "general": 20.0}
        valid, msg = adapter.validate_configuration(invalid_allocations)
        self.assertFalse(valid)
        self.assertIn("exceeds parent capacity", msg)

        # Negative rate must be rejected
        negative_alloc = {"low_latency": -5.0, "high_bandwidth": 50.0, "general": 20.0}
        valid, msg = adapter.validate_configuration(negative_alloc)
        self.assertFalse(valid)

    def test_operator_authorization_safety_gate(self):
        """Requirement 8 & 9: Real enforcement is blocked if operator authorization is not granted."""
        real_config = GatewayConfig(
            mode="real_network_enforce",
            adapter_type="linux_tc",
            interface="eth0",
            operator_authorized=False, # NOT authorized!
            dry_run=False,
            db_path=":memory:"
        )
        adapter = LinuxTcGatewayAdapter(real_config)
        allocations = {"low_latency": 30.0, "high_bandwidth": 50.0, "general": 20.0}
        
        success, msg, enforced = adapter.apply_allocation(allocations)
        self.assertFalse(success)
        self.assertEqual(adapter.status, EnforcementStatus.FALLBACK_VIRTUAL)
        self.assertIn("Operator authorization NOT granted", msg)
        self.assertEqual(enforced, {})

    def test_safe_rollback_procedure(self):
        """Requirement 8 & 12: Operator rollback restores network to clean state."""
        adapter = DryRunGatewayAdapter(self.config)
        adapter.apply_allocation({"low_latency": 25.0, "high_bandwidth": 55.0, "general": 20.0})
        
        success, msg = adapter.rollback()
        self.assertTrue(success)
        self.assertEqual(adapter.status, EnforcementStatus.ROLLED_BACK)
        rollback_cmds = adapter.generate_rollback_commands()
        self.assertIn("tc qdisc del dev eth0 root", rollback_cmds[0])

    def test_allocator_to_gateway_closed_loop_sync(self):
        """Requirement 6: Allocation engine translates decisions into gateway rules."""
        # Trigger an AI allocation shift
        predicted = {"low_latency": 45.0, "high_bandwidth": 35.0, "general": 20.0}
        self.engine.allocate_ai_assisted(predicted)
        
        # Verify gateway adapter received the updated rates
        self.assertIsNotNone(self.engine.last_enforcement_status)
        self.assertTrue(self.engine.last_enforcement_status["success"])
        enforced = self.engine.last_enforcement_status["enforced_allocations"]
        self.assertAlmostEqual(sum(enforced.values()), 100.0, places=1)
        self.assertGreater(enforced["low_latency"], 30.0)

    def test_metric_truthfulness_and_classification(self):
        """Requirement 3, 4 & 14: Distinguish measured, predicted, calculated, and enforced metrics honestly."""
        devices = self.device_mgr.get_all_devices(
            allocations={"low_latency": 35.0, "high_bandwidth": 45.0, "general": 20.0},
            enforced_allocations={"low_latency": 35.0, "high_bandwidth": 45.0, "general": 20.0},
            predicted_demands={"low_latency": 40.0, "high_bandwidth": 42.0, "general": 18.0},
            live_rtt=12.5
        )
        self.assertGreaterEqual(len(devices), 3)
        dev = devices[0]
        metrics = dev["metrics"]
        
        # 1. Measured Throughput
        self.assertEqual(metrics["measured_throughput_mbps"]["status"], MetricConfidence.MEASURED)
        # 2. Predicted Demand
        self.assertEqual(metrics["predicted_demand_mbps"]["status"], MetricConfidence.PREDICTED)
        # 3. Calculated Allocation
        self.assertEqual(metrics["calculated_allocation_mbps"]["status"], MetricConfidence.CALCULATED)
        # 4. Enforced Allocation
        self.assertEqual(metrics["enforced_allocation_mbps"]["status"], MetricConfidence.ENFORCED)
        # 5. Estimated Latency
        self.assertEqual(metrics["latency_ms"]["status"], MetricConfidence.ESTIMATED)
        # 6. Honest UNAVAILABLE status for encrypted payloads (Requirement 2 & 4)
        self.assertEqual(metrics["payload_inspection"]["status"], MetricConfidence.UNAVAILABLE)
        self.assertIn("Encrypted", metrics["payload_inspection"]["value"])

    def test_device_registry_crud(self):
        """Requirement 4: Configurable device identities and application profiles."""
        new_dev = self.device_mgr.register_device(
            device_id="dev_robotic_arm_09",
            name="Precision Surgical Robot Arm",
            mac_address="AA:BB:CC:DD:EE:FF",
            ip_address="192.168.1.199",
            assigned_slice="low_latency",
            application_profile="Sub-millisecond Haptic Feedback",
            classification_source=ClassificationSource.EXPLICIT_LABEL
        )
        self.assertIn("dev_robotic_arm_09", self.device_mgr.devices)
        self.assertEqual(new_dev.classification_source, ClassificationSource.EXPLICIT_LABEL)
        
        # Test deletion
        removed = self.device_mgr.remove_device("dev_robotic_arm_09")
        self.assertTrue(removed)
        self.assertNotIn("dev_robotic_arm_09", self.device_mgr.devices)

if __name__ == '__main__':
    unittest.main()
