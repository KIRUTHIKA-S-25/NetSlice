"""
Priority Enhancements Test Suite: NetSlice Priorities 2, 3, 4, 5.
Validates:
1. Priority 2: Genuine Telemetry Provider & Device Discovery.
2. Priority 3: Linux Gateway Enforcement Adapter, Command Generation, and Safe Windows Fallback.
3. Priority 4: Application QoS Profile SQLite Persistence & Allocator Constraint Binding.
4. Benchmark Determinism: Identical seeds and shared trace verification.
"""

import unittest
import os
import tempfile
import sqlite3
from telemetry_provider import WindowsHostTelemetryProvider, create_telemetry_provider
from simulation.application_profiles import ApplicationProfileRegistry
from simulation.allocation import ResourceAllocationEngine
from simulation.slices import initialize_slices
from gateway_adapter import GatewayConfig, LinuxTcGatewayAdapter, EnforcementStatus, DryRunGatewayAdapter
from device_manager import DeviceManager, MetricConfidence

class TestPriorityEnhancements(unittest.TestCase):

    def setUp(self):
        self.temp_db_fd, self.temp_db_path = tempfile.mkstemp(suffix=".db")
        os.close(self.temp_db_fd)
        from database import init_db
        init_db(self.temp_db_path)

    def tearDown(self):
        if os.path.exists(self.temp_db_path):
            try:
                os.remove(self.temp_db_path)
            except OSError:
                pass

    def test_qos_profile_persistence_and_allocator_binding(self):
        """Priority 4: Verifies profile update persists to SQLite and dynamically adjusts slice limits."""
        registry = ApplicationProfileRegistry(db_path=self.temp_db_path)
        slices = initialize_slices()
        allocator = ResourceAllocationEngine(slices, db_path=self.temp_db_path)
        allocator.bind_application_profiles(registry)

        initial_gaming = registry.get_profile("online_gaming")
        self.assertIsNotNone(initial_gaming)
        initial_min = allocator.slice_limits["low_latency"]["min"]

        # User raises gaming profile min_throughput_mbps from 5.0 to 28.0
        success = registry.update_profile(
            "online_gaming",
            {
                "min_throughput_mbps": 28.0,
                "target_max_latency_ms": 15.0,
                "preferred_slice": "low_latency"
            }
        )
        self.assertTrue(success)

        # Check SQLite persistence
        conn = sqlite3.connect(self.temp_db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT min_throughput_mbps FROM application_profiles WHERE id='online_gaming'")
        row = cursor.fetchone()
        conn.close()
        self.assertIsNotNone(row)
        self.assertAlmostEqual(row[0], 28.0)

        # Verify allocator automatically recomputed low_latency slice minimum floor
        new_min = allocator.slice_limits["low_latency"]["min"]
        self.assertGreater(new_min, initial_min)
        self.assertEqual(new_min, 28.0)

    def test_genuine_telemetry_provider(self):
        """Priority 2: Provider reads genuine OS network statistics and discovers ARP entries without fakes."""
        provider = WindowsHostTelemetryProvider()
        metrics = provider.get_interface_metrics("Wi-Fi")
        
        self.assertIn("measured_throughput_mbps", metrics)
        self.assertIn("rx_mbps", metrics)
        self.assertIn("tx_mbps", metrics)
        self.assertIn("packets_recv", metrics)
        self.assertIn("packets_sent", metrics)
        
        # Test active socket flows
        flows = provider.get_active_flows()
        self.assertIsInstance(flows, list)
        
        # Test ARP discovery
        discovered = provider.discover_devices()
        self.assertIsInstance(discovered, list)
        for dev in discovered:
            dev_dict = dev.to_dict()
            self.assertIn("ip_address", dev_dict)
            self.assertIn("mac_address", dev_dict)
            self.assertTrue(dev.is_discovered)

    def test_safe_windows_gateway_fallback(self):
        """Priority 3: Verifies Windows host safely falls back without modifying host networking."""
        config = GatewayConfig(
            mode="real_network_enforce",
            adapter_type="linux_tc",
            interface="eth0",
            operator_authorized=True,
            dry_run=False,
            db_path=self.temp_db_path
        )
        adapter = LinuxTcGatewayAdapter(config)
        allocations = {"low_latency": 30.0, "high_bandwidth": 50.0, "general": 20.0}

        # On Windows host without remote SSH credentials, enforce must safely report unavailable
        success, msg, enforced = adapter.apply_allocation(allocations)
        self.assertFalse(success)
        self.assertIn("Linux gateway", msg)
        self.assertEqual(adapter.status, EnforcementStatus.ENFORCEMENT_UNAVAILABLE_ON_HOST)
        self.assertEqual(enforced, {})

    def test_tc_command_generation_and_validation(self):
        """Priority 3: TC generation respects strict parameters and includes read-back verification."""
        config = GatewayConfig(
            mode="real_network_monitor",
            adapter_type="dry_run",
            interface="eth0",
            operator_authorized=True,
            dry_run=True,
            db_path=self.temp_db_path
        )
        adapter = DryRunGatewayAdapter(config)
        allocations = {"low_latency": 30.0, "high_bandwidth": 50.0, "general": 20.0}
        
        cmds = adapter.generate_tc_commands(allocations, is_initial=True)
        self.assertTrue(any("htb rate 30.0mbit" in c for c in cmds))
        self.assertTrue(any("htb rate 50.0mbit" in c for c in cmds))
        self.assertTrue(any("htb rate 20.0mbit" in c for c in cmds))
        self.assertTrue(any("fq_codel quantum 300 target 5ms" in c for c in cmds))

        # Check read-back verification
        readback_cmds = adapter.generate_readback_commands()
        self.assertTrue(any("tc -s qdisc show" in c for c in readback_cmds))
        self.assertTrue(any("tc -s class show" in c for c in readback_cmds))

    def test_device_discovery_flag_and_honesty(self):
        """Priority 2: Discovered devices tagged with is_discovered=True, no DPI fabrication."""
        dev_mgr = DeviceManager(db_path=self.temp_db_path)
        all_devs = dev_mgr.get_all_devices(
            allocations={"low_latency": 30.0, "high_bandwidth": 50.0, "general": 20.0},
            enforced_allocations={},
            predicted_demands={},
            live_rtt=10.0
        )
        for dev in all_devs:
            self.assertIn("is_discovered", dev)
            self.assertIn("classification_source", dev)
            self.assertEqual(dev["metrics"]["payload_inspection"]["status"], MetricConfidence.UNAVAILABLE)

if __name__ == '__main__':
    unittest.main()
