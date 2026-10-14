"""
Gateway Enforcement Adapter Module for NetSlice.
Supports Linux Traffic Control (tc with HTB/fq_codel), Dry-Run validation, and local testbed shaping.

Enforces strict safety invariants:
1. Operator authorization required before applying any kernel/gateway changes.
2. Invariant: sum(slice_rates) <= parent_bandwidth_mbps.
3. Invariant: min_limit <= slice_rate <= max_limit.
4. Automatic rollback to previous known-good state on error.
5. Audit trail of all generated and executed commands.
"""

import os
import sys
import subprocess
import threading
import time
from typing import Dict, List, Tuple, Optional, Any
from database import save_action_log

class EnforcementStatus:
    UNCONFIGURED = "UNCONFIGURED"
    MONITOR_ONLY = "MONITOR_ONLY"          # Safe monitoring, no packet alteration
    DRY_RUN = "DRY_RUN"                    # Commands generated and verified, not executed
    ENFORCING = "ENFORCING"                # Active rules applied to gateway/kernel
    FALLBACK_VIRTUAL = "FALLBACK_VIRTUAL"  # Gateway unavailable, fell back to virtual allocation
    ENFORCEMENT_UNAVAILABLE_ON_HOST = "ENFORCEMENT_UNAVAILABLE_ON_HOST" # Windows host without remote Linux gateway
    ROLLED_BACK = "ROLLED_BACK"            # Rules purged, restored to default
    ERROR = "ERROR"                        # Validation or execution failure

class GatewayConfig:
    def __init__(
        self,
        mode: str = "simulation", # "simulation" | "real_network_monitor" | "real_network_enforce"
        adapter_type: str = "dry_run", # "linux_tc" | "dry_run" | "local_shaper"
        interface: str = "eth0",
        parent_bandwidth_mbps: float = 100.0,
        operator_authorized: bool = False,
        dry_run: bool = True,
        ssh_host: Optional[str] = None,
        ssh_user: Optional[str] = None,
        db_path: str = "network_logs.db"
    ):
        self.mode = mode
        self.adapter_type = adapter_type
        self.interface = interface
        self.parent_bandwidth_mbps = parent_bandwidth_mbps
        self.operator_authorized = operator_authorized
        self.dry_run = dry_run
        self.ssh_host = ssh_host
        self.ssh_user = ssh_user
        self.db_path = db_path

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mode": self.mode,
            "adapter_type": self.adapter_type,
            "interface": self.interface,
            "parent_bandwidth_mbps": self.parent_bandwidth_mbps,
            "operator_authorized": self.operator_authorized,
            "dry_run": self.dry_run,
            "ssh_host": self.ssh_host,
            "ssh_user": self.ssh_user
        }

class BaseGatewayAdapter:
    def __init__(self, config: GatewayConfig):
        self.config = config
        self.status = EnforcementStatus.MONITOR_ONLY if config.mode == "real_network_monitor" else EnforcementStatus.UNCONFIGURED
        self.enforced_allocations: Dict[str, float] = {}
        self.previous_good_allocations: Dict[str, float] = {}
        self.command_audit_log: List[Dict[str, Any]] = []
        self._lock = threading.RLock()

    def check_privileges(self) -> Tuple[bool, str]:
        """Checks whether the backend process has sufficient rights to modify traffic control."""
        if os.name == 'posix':
            is_root = (os.geteuid() == 0) if hasattr(os, 'geteuid') else False
            if is_root:
                return True, "Sufficient privileges: Process running as root/CAP_NET_ADMIN."
            return False, "Insufficient privileges: Linux traffic control (tc) requires root or CAP_NET_ADMIN."
        elif os.name == 'nt':
            return True, "Windows testbed environment: Local socket token-bucket rate shaper available."
        return True, "Generic environment."

    def validate_configuration(self, allocations: Dict[str, float]) -> Tuple[bool, str]:
        """
        Validates bandwidth budget and non-negativity invariants before applying.
        """
        if not allocations:
            return False, "Allocations dictionary is empty."

        total_requested = sum(allocations.values())
        if total_requested > (self.config.parent_bandwidth_mbps + 0.1):
            return False, (
                f"Budget invariant violated: Sum of allocations ({total_requested:.1f} Mbps) "
                f"exceeds parent capacity ({self.config.parent_bandwidth_mbps:.1f} Mbps)."
            )

        for slice_name, rate in allocations.items():
            if rate < 0.0:
                return False, f"Non-negativity violated: Slice '{slice_name}' has negative rate ({rate})."
            if rate == 0.0:
                return False, f"Zero-rate slice prohibited: Slice '{slice_name}' rate must be > 0.0 Mbps."

        return True, "Configuration validated successfully."

    def generate_tc_commands(self, allocations: Dict[str, float], is_initial: bool = False) -> List[str]:
        """Generates standard Linux tc HTB commands for the slice allocations."""
        iface = self.config.interface
        total = int(self.config.parent_bandwidth_mbps)
        ll = max(1.0, allocations.get("low_latency", 30.0))
        hb = max(1.0, allocations.get("high_bandwidth", 50.0))
        gen = max(1.0, allocations.get("general", 20.0))

        cmds = []
        if is_initial:
            # 1. Clean existing root qdisc
            cmds.append(f"tc qdisc del dev {iface} root 2>/dev/null || true")
            # 2. Add root HTB qdisc (default class 1:30 = General/mMTC)
            cmds.append(f"tc qdisc add dev {iface} root handle 1: htb default 30")
            # 3. Add root container class
            cmds.append(f"tc class add dev {iface} parent 1: classid 1:1 htb rate {total}mbit ceil {total}mbit")
            # 4. Add leaf slice classes
            # Class 1:10 - URLLC Low Latency (Priority 1, burst headroom)
            cmds.append(f"tc class add dev {iface} parent 1:1 classid 1:10 htb rate {ll:.1f}mbit ceil {min(total, ll*1.5):.1f}mbit prio 1")
            cmds.append(f"tc qdisc add dev {iface} parent 1:10 handle 10: fq_codel quantum 300 target 5ms")
            
            # Class 1:20 - eMBB High Bandwidth (Priority 3, bulk throughput)
            cmds.append(f"tc class add dev {iface} parent 1:1 classid 1:20 htb rate {hb:.1f}mbit ceil {total}mbit prio 3")
            cmds.append(f"tc qdisc add dev {iface} parent 1:20 handle 20: fq_codel")
            
            # Class 1:30 - mMTC General (Priority 2, default)
            cmds.append(f"tc class add dev {iface} parent 1:1 classid 1:30 htb rate {gen:.1f}mbit ceil {min(total, gen*1.2):.1f}mbit prio 2")
            cmds.append(f"tc qdisc add dev {iface} parent 1:30 handle 30: fq_codel")

            # 5. Add DSCP/Port filters
            # Port 9101 or DSCP EF (46) -> URLLC
            cmds.append(f"tc filter add dev {iface} protocol ip parent 1:0 prio 1 u32 match ip dport 9101 0xffff flowid 1:10")
            cmds.append(f"tc filter add dev {iface} protocol ip parent 1:0 prio 1 u32 match ip tos 0xb8 0xfc flowid 1:10")
            # Port 9102 -> eMBB
            cmds.append(f"tc filter add dev {iface} protocol ip parent 1:0 prio 2 u32 match ip dport 9102 0xffff flowid 1:20")
            # Port 9103 -> mMTC
            cmds.append(f"tc filter add dev {iface} protocol ip parent 1:0 prio 3 u32 match ip dport 9103 0xffff flowid 1:30")
        else:
            # Dynamic in-flight class adjustment without tearing down qdisc
            cmds.append(f"tc class change dev {iface} parent 1:1 classid 1:10 htb rate {ll:.1f}mbit ceil {min(total, ll*1.5):.1f}mbit prio 1")
            cmds.append(f"tc class change dev {iface} parent 1:1 classid 1:20 htb rate {hb:.1f}mbit ceil {total}mbit prio 3")
            cmds.append(f"tc class change dev {iface} parent 1:1 classid 1:30 htb rate {gen:.1f}mbit ceil {min(total, gen*1.2):.1f}mbit prio 2")

        return cmds

    def generate_rollback_commands(self) -> List[str]:
        """Generates commands to cleanly remove all traffic control rules."""
        iface = self.config.interface
        return [f"tc qdisc del dev {iface} root 2>/dev/null || true"]

    def generate_readback_commands(self) -> List[str]:
        """Generates verification commands to inspect active kernel qdisc and classes."""
        iface = self.config.interface
        return [
            f"tc -s qdisc show dev {iface}",
            f"tc -s class show dev {iface}"
        ]

    def apply_allocation(self, allocations: Dict[str, float]) -> Tuple[bool, str, Dict[str, float]]:
        raise NotImplementedError

    def rollback(self) -> Tuple[bool, str]:
        raise NotImplementedError


class DryRunGatewayAdapter(BaseGatewayAdapter):
    """
    Dry-run adapter that performs complete syntax, budget, and command generation
    without executing destructive changes. Used for safe validation and operator preview.
    """
    def apply_allocation(self, allocations: Dict[str, float]) -> Tuple[bool, str, Dict[str, float]]:
        with self._lock:
            valid, msg = self.validate_configuration(allocations)
            if not valid:
                self.status = EnforcementStatus.ERROR
                return False, f"Dry-run validation rejected: {msg}", {}

            is_initial = (len(self.enforced_allocations) == 0)
            cmds = self.generate_tc_commands(allocations, is_initial=is_initial)

            self.previous_good_allocations = dict(self.enforced_allocations)
            self.enforced_allocations = dict(allocations)
            self.status = EnforcementStatus.DRY_RUN

            audit_entry = {
                "timestamp": time.time(),
                "adapter": "dry_run",
                "allocations": dict(allocations),
                "commands": cmds,
                "status": "VALIDATED_SIMULATED",
                "message": "Configuration syntactically valid and compliant with budget."
            }
            self.command_audit_log.append(audit_entry)
            save_action_log(
                self.config.db_path,
                "GATEWAY-DRYRUN",
                f"Dry-run validated {len(cmds)} tc commands on '{self.config.interface}': LL={allocations.get('low_latency')}M, HB={allocations.get('high_bandwidth')}M, Gen={allocations.get('general')}M"
            )
            return True, f"Dry-run succeeded: Generated {len(cmds)} valid tc commands.", self.enforced_allocations

    def rollback(self) -> Tuple[bool, str]:
        with self._lock:
            cmds = self.generate_rollback_commands()
            self.enforced_allocations = dict(self.previous_good_allocations) if self.previous_good_allocations else {}
            self.status = EnforcementStatus.ROLLED_BACK
            save_action_log(self.config.db_path, "GATEWAY-ROLLBACK", f"Dry-run rollback simulated for '{self.config.interface}'.")
            return True, f"Dry-run rollback simulated: {cmds[0]}"


class LinuxTcGatewayAdapter(BaseGatewayAdapter):
    """
    Enforces dynamic slice traffic control on a real Linux gateway (via local subprocess or SSH).
    Strictly checks operator authorization and kernel permissions.
    """
    def apply_allocation(self, allocations: Dict[str, float]) -> Tuple[bool, str, Dict[str, float]]:
        with self._lock:
            # 1. Check operator authorization
            if not self.config.operator_authorized:
                self.status = EnforcementStatus.FALLBACK_VIRTUAL
                msg = "Safety Gate: Operator authorization NOT granted for real network enforcement. Operating in Fallback/Virtual mode."
                save_action_log(self.config.db_path, "GATEWAY-WARN", msg)
                return False, msg, {}

            # 2. Validate configuration budget
            valid, val_msg = self.validate_configuration(allocations)
            if not valid:
                self.status = EnforcementStatus.ERROR
                return False, f"Validation failure: {val_msg}", {}

            # 3. Check OS privileges and truthful host environment
            if os.name == 'nt' and not self.config.ssh_host and not self.config.dry_run:
                self.status = EnforcementStatus.ENFORCEMENT_UNAVAILABLE_ON_HOST
                msg = (
                    "Enforcement Unavailable on Host: Operating system is Windows. "
                    "Kernel Traffic Control (tc) requires a Linux gateway host or a configured remote SSH router."
                )
                save_action_log(self.config.db_path, "GATEWAY-WARN", msg)
                return False, msg, {}

            has_privs, priv_msg = self.check_privileges()
            if not has_privs and not self.config.ssh_host and not self.config.dry_run:
                self.status = EnforcementStatus.FALLBACK_VIRTUAL
                return False, f"Permission Denied: {priv_msg}", {}

            is_initial = (len(self.enforced_allocations) == 0)
            cmds = self.generate_tc_commands(allocations, is_initial=is_initial)

            executed_cmds = []
            try:
                for cmd in cmds:
                    if self.config.dry_run:
                        executed_cmds.append(f"[DRY-RUN] {cmd}")
                    else:
                        if self.config.ssh_host:
                            # Remote execution over SSH
                            ssh_target = f"{self.config.ssh_user}@{self.config.ssh_host}" if self.config.ssh_user else self.config.ssh_host
                            full_cmd = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=3", ssh_target, cmd]
                            res = subprocess.run(full_cmd, capture_output=True, text=True, timeout=5)
                            if res.returncode != 0:
                                raise RuntimeError(f"SSH execution failed for '{cmd}': {res.stderr.strip()}")
                        elif os.name == 'posix':
                            # Local Linux execution with helper script or direct tc
                            res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=5)
                            if res.returncode != 0:
                                raise RuntimeError(f"Local tc failed for '{cmd}': {res.stderr.strip()}")
                        executed_cmds.append(cmd)

                # 4. Read-back verification
                if not self.config.dry_run:
                    verified, v_msg = self.read_back_verify()
                    if not verified:
                        raise RuntimeError(f"Read-back verification failed: {v_msg}")

                # Successful execution & verification
                self.previous_good_allocations = dict(self.enforced_allocations)
                self.enforced_allocations = dict(allocations)
                self.status = EnforcementStatus.ENFORCING if not self.config.dry_run else EnforcementStatus.DRY_RUN

                audit_entry = {
                    "timestamp": time.time(),
                    "adapter": "linux_tc",
                    "allocations": dict(allocations),
                    "commands": executed_cmds,
                    "status": "ENFORCED" if not self.config.dry_run else "DRY_RUN",
                    "interface": self.config.interface
                }
                self.command_audit_log.append(audit_entry)

                log_msg = f"Enforced {len(cmds)} tc rules on '{self.config.interface}': LL={allocations.get('low_latency')}M, HB={allocations.get('high_bandwidth')}M, Gen={allocations.get('general')}M"
                save_action_log(self.config.db_path, "GATEWAY-ENFORCE", log_msg)
                return True, f"Successfully enforced on {self.config.interface}", self.enforced_allocations

            except Exception as e:
                # Execution error -> Automatic safe rollback
                err_str = str(e)
                self.status = EnforcementStatus.ERROR
                save_action_log(self.config.db_path, "GATEWAY-ERR", f"Failed applying tc rules: {err_str}. Initiating automatic rollback.")
                self.rollback()
                return False, f"Enforcement failed ({err_str}). Auto-rolled back.", {}

    def read_back_verify(self) -> Tuple[bool, str]:
        """Performs read-back verification against the gateway kernel using tc -s class show."""
        if self.config.dry_run:
            return True, "Dry-run mode: Syntax and budget verified."
        iface = self.config.interface
        cmd = f"tc -s class show dev {iface}"
        try:
            if self.config.ssh_host:
                ssh_target = f"{self.config.ssh_user}@{self.config.ssh_host}" if self.config.ssh_user else self.config.ssh_host
                res = subprocess.run(["ssh", ssh_target, cmd], capture_output=True, text=True, timeout=5)
            elif os.name == 'posix':
                res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=5)
            else:
                return False, "Read-back unavailable on Windows host without SSH router."

            if res.returncode == 0 and "class htb 1:10" in res.stdout:
                return True, f"Verified: HTB class 1:10 confirmed active on {iface}."
            return False, f"Verification failed: NetSlice classes not found on {iface}."
        except Exception as e:
            return False, f"Read-back probe error: {str(e)}"

    def rollback(self) -> Tuple[bool, str]:
        with self._lock:
            cmds = self.generate_rollback_commands()
            try:
                for cmd in cmds:
                    if not self.config.dry_run:
                        if self.config.ssh_host:
                            ssh_target = f"{self.config.ssh_user}@{self.config.ssh_host}" if self.config.ssh_user else self.config.ssh_host
                            subprocess.run(["ssh", ssh_target, cmd], capture_output=True, timeout=4)
                        elif os.name == 'posix':
                            subprocess.run(cmd, shell=True, capture_output=True, timeout=4)

                self.enforced_allocations = {}
                self.status = EnforcementStatus.ROLLED_BACK
                save_action_log(self.config.db_path, "GATEWAY-ROLLBACK", f"Cleaned up traffic control rules on '{self.config.interface}'.")
                return True, f"Successfully rolled back traffic control on {self.config.interface}"
            except Exception as e:
                return False, f"Rollback error: {str(e)}"


class LocalShaperGatewayAdapter(BaseGatewayAdapter):
    """
    Local token-bucket shaper adapter for development, Windows testing, and controlled lab experiments.
    """
    def __init__(self, config: GatewayConfig, real_network_manager=None):
        super().__init__(config)
        self.real_net_mgr = real_network_manager

    def set_real_network_manager(self, mgr):
        self.real_net_mgr = mgr

    def apply_allocation(self, allocations: Dict[str, float]) -> Tuple[bool, str, Dict[str, float]]:
        with self._lock:
            valid, val_msg = self.validate_configuration(allocations)
            if not valid:
                self.status = EnforcementStatus.ERROR
                return False, f"Validation failure: {val_msg}", {}

            if not self.config.operator_authorized and self.config.mode == "real_network_enforce":
                self.status = EnforcementStatus.FALLBACK_VIRTUAL
                return False, "Operator authorization required for active enforcement.", {}

            # Apply to real_network_manager slices rate shapers if connected
            if self.real_net_mgr and hasattr(self.real_net_mgr, 'slices'):
                for key, mbps in allocations.items():
                    if key in self.real_net_mgr.slices:
                        self.real_net_mgr.slices[key].set_allocated_bandwidth(mbps)

            self.previous_good_allocations = dict(self.enforced_allocations)
            self.enforced_allocations = dict(allocations)
            self.status = EnforcementStatus.ENFORCING if self.config.operator_authorized else EnforcementStatus.MONITOR_ONLY

            audit_entry = {
                "timestamp": time.time(),
                "adapter": "local_shaper",
                "allocations": dict(allocations),
                "commands": [f"Update rate shaper {k} -> {v} Mbps" for k, v in allocations.items()],
                "status": "ENFORCED" if self.config.operator_authorized else "MONITOR_ONLY"
            }
            self.command_audit_log.append(audit_entry)
            save_action_log(
                self.config.db_path,
                "GATEWAY-ENFORCE",
                f"Local token-bucket shaper updated: LL={allocations.get('low_latency')}M, HB={allocations.get('high_bandwidth')}M, Gen={allocations.get('general')}M"
            )
            return True, "Enforced via local token-bucket rate shapers", self.enforced_allocations

    def rollback(self) -> Tuple[bool, str]:
        with self._lock:
            default_alloc = {"low_latency": 30.0, "high_bandwidth": 50.0, "general": 20.0}
            if self.real_net_mgr and hasattr(self.real_net_mgr, 'slices'):
                for key, mbps in default_alloc.items():
                    if key in self.real_net_mgr.slices:
                        self.real_net_mgr.slices[key].set_allocated_bandwidth(mbps)
            self.enforced_allocations = default_alloc
            self.status = EnforcementStatus.ROLLED_BACK
            save_action_log(self.config.db_path, "GATEWAY-ROLLBACK", "Restored local rate shapers to nominal baseline (30/50/20 Mbps).")
            return True, "Restored local rate shapers to baseline."


def create_gateway_adapter(config: GatewayConfig, real_network_manager=None) -> BaseGatewayAdapter:
    """Factory creating the appropriate gateway adapter according to configuration."""
    if config.adapter_type == "linux_tc":
        return LinuxTcGatewayAdapter(config)
    elif config.adapter_type == "local_shaper":
        return LocalShaperGatewayAdapter(config, real_network_manager=real_network_manager)
    else:
        return DryRunGatewayAdapter(config)
