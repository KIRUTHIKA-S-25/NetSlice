import time
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

# Database & Analytics Imports
from database import (
    DEFAULT_DB_PATH,
    init_db,
    save_action_log,
    get_recent_history,
    get_action_logs,
    get_analytics_summary,
    save_experiment_result,
    get_experiment_results
)

# Simulation & Real Network Imports
from simulation.slices import initialize_slices
from simulation.traffic_generator import TrafficGenerator
from simulation.monitor import MetricsCollector
from simulation.allocation import ResourceAllocationEngine
from simulation.ml_engine import MLEngine
from simulation.application_profiles import profile_registry
from simulation.experiment_runner import run_fair_experiment_comparison
from ai_assistant import generate_ai_response
from real_network import get_available_interfaces, RealNetworkManager, get_wifi_details, measure_real_network_probe
from gateway_adapter import GatewayConfig, create_gateway_adapter, EnforcementStatus
from device_manager import DeviceManager, MetricConfidence, ClassificationSource

app = FastAPI(title="AI-Assisted Network Slicing API", version="2.2")

# Initialize database
init_db(DEFAULT_DB_PATH)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global State
default_gw_config = GatewayConfig(
    mode="simulation",
    adapter_type="dry_run",
    interface="Wi-Fi",
    parent_bandwidth_mbps=100.0,
    operator_authorized=False,
    dry_run=True,
    db_path=DEFAULT_DB_PATH
)

simulation_state = {
    "is_running": False,
    "strategy": "ai_assisted",
    "mode": "real_network", # "simulation" | "real_network" | "real_network_monitor" | "real_network_enforce"
    "active_interface": "Wi-Fi",
    "slices": None,
    "traffic_gen": None,
    "monitor": None,
    "real_net_mgr": None,
    "allocation_engine": None,
    "ml_engine": MLEngine(db_path=DEFAULT_DB_PATH),
    "gateway_config": default_gw_config,
    "gateway_adapter": create_gateway_adapter(default_gw_config),
    "device_manager": DeviceManager(db_path=DEFAULT_DB_PATH),
    "custom_static": {
        "low_latency": 30.0,
        "high_bandwidth": 50.0,
        "general": 20.0
    }
}

def init_idle_state():
    """Initializes network interface detection and slices in normal standby/idle mode."""
    interfaces = get_available_interfaces()
    wifi_iface = next((i for i in interfaces if i.get("wifi_details") or "Wi-Fi" in i["name"]), None)
    iface_name = wifi_iface["name"] if wifi_iface else (interfaces[0]["name"] if interfaces else "Wi-Fi")
    simulation_state["active_interface"] = iface_name
    simulation_state["mode"] = "real_network"
    simulation_state["strategy"] = "ai_assisted"
    simulation_state["is_running"] = False  # Normal idle: only runs when user clicks 'Start Monitoring'
    simulation_state["slices"] = initialize_slices()
    simulation_state["allocation_engine"] = ResourceAllocationEngine(simulation_state["slices"], db_path="network_logs.db")
    
    # Configure gateway adapter
    simulation_state["gateway_config"].interface = iface_name
    simulation_state["allocation_engine"].set_gateway_adapter(simulation_state["gateway_adapter"])
    
    if simulation_state["custom_static"]:
        simulation_state["allocation_engine"].set_custom_static_config(simulation_state["custom_static"])

@app.on_event("startup")
def on_app_startup():
    init_idle_state()

class ConfigPayload(BaseModel):
    strategy: str
    mode: Optional[str] = "simulation" # "simulation" or "real_network"
    interface: Optional[str] = "Wi-Fi"
    custom_static: Optional[Dict[str, float]] = None

class ModePayload(BaseModel):
    mode: str
    interface: Optional[str] = "Wi-Fi"

class SpikePayload(BaseModel):
    slice_name: str
    multiplier: float

class ScenarioPayload(BaseModel):
    scenario: str

class StaticAllocationPayload(BaseModel):
    low_latency: float
    high_bandwidth: float
    general: float

class StrategyPayload(BaseModel):
    strategy: str

class ChatPayload(BaseModel):
    message: str

@app.post("/api/strategy")
def set_strategy(payload: StrategyPayload):
    valid = ["static", "rule_based", "ai_assisted"]
    if payload.strategy not in valid:
        return {"status": "error", "message": f"Strategy must be one of {valid}"}
    simulation_state["strategy"] = payload.strategy
    if payload.strategy == "static" and simulation_state["allocation_engine"]:
        simulation_state["allocation_engine"].allocate_static()
    save_action_log(
        "network_logs.db",
        "STRATEGY",
        f"Active slicing resource allocation strategy switched to: {payload.strategy.upper().replace('_', ' ')}"
    )
    return {"status": "success", "strategy": simulation_state["strategy"]}

@app.get("/api/status")
def get_system_status():
    interfaces = get_available_interfaces()
    current_iface = simulation_state["active_interface"]
    if interfaces and not any(i["name"] == current_iface for i in interfaces):
        wifi_match = next((i for i in interfaces if i.get("wifi_details") or "Wi-Fi" in i["name"]), interfaces[0])
        current_iface = wifi_match["name"]
        simulation_state["active_interface"] = current_iface
        
    is_real = simulation_state["mode"] == "real_network"
    is_online = (
        simulation_state["real_net_mgr"].is_online
        if (is_real and simulation_state["real_net_mgr"])
        else True
    )

    return {
        "is_running": simulation_state["is_running"],
        "is_online": is_online,
        "strategy": simulation_state["strategy"],
        "mode": simulation_state["mode"],
        "active_interface": current_iface,
        "detected_interfaces": interfaces,
        "ml_trained": simulation_state["ml_engine"].is_trained,
        "ml_info": simulation_state["ml_engine"].training_info,
        "custom_static": simulation_state["custom_static"]
    }

@app.get("/api/network/interfaces")
def list_network_interfaces():
    """
    Returns detected physical and virtual network interfaces on Windows.
    """
    interfaces = get_available_interfaces()
    return {"status": "success", "interfaces": interfaces}

@app.post("/api/network/mode")
def set_network_mode(payload: ModePayload):
    simulation_state["mode"] = payload.mode
    if payload.interface:
        simulation_state["active_interface"] = payload.interface
    save_action_log(
        "network_logs.db",
        "CONFIG",
        f"Network operational mode set to: {payload.mode.upper()} on interface '{simulation_state['active_interface']}'"
    )
    return {
        "status": "success",
        "mode": simulation_state["mode"],
        "interface": simulation_state["active_interface"]
    }

@app.post("/api/start")
def start_simulation(payload: ConfigPayload):
    if simulation_state["is_running"]:
        stop_simulation()
        
    simulation_state["strategy"] = payload.strategy
    simulation_state["mode"] = payload.mode or "simulation"
    if payload.interface:
        simulation_state["active_interface"] = payload.interface

    if payload.custom_static:
        simulation_state["custom_static"] = payload.custom_static

    if simulation_state["mode"] == "real_network":
        # REAL-TIME NETWORK ENGINE
        r_mgr = RealNetworkManager(
            interface_name=simulation_state["active_interface"],
            db_path="network_logs.db"
        )
        simulation_state["real_net_mgr"] = r_mgr
        simulation_state["slices"] = r_mgr.slices
        simulation_state["allocation_engine"] = ResourceAllocationEngine(simulation_state["slices"], db_path="network_logs.db")
        r_mgr.set_allocation_engine(simulation_state["allocation_engine"])
        
        if simulation_state["custom_static"]:
            simulation_state["allocation_engine"].set_custom_static_config(simulation_state["custom_static"])
            
        r_mgr.start()
        simulation_state["is_running"] = True
        
        save_action_log(
            "network_logs.db",
            "SYSTEM",
            f"REAL-TIME NETWORK started under {payload.strategy.upper()} strategy on {simulation_state['active_interface']} (Sockets: Ports 9101-9103)."
        )
    else:
        # SYNTHETIC SIMULATION ENGINE
        simulation_state["slices"] = initialize_slices()
        simulation_state["traffic_gen"] = TrafficGenerator(simulation_state["slices"], db_path="network_logs.db")
        simulation_state["allocation_engine"] = ResourceAllocationEngine(simulation_state["slices"], db_path="network_logs.db")
        
        if simulation_state["custom_static"]:
            simulation_state["allocation_engine"].set_custom_static_config(simulation_state["custom_static"])
            
        simulation_state["monitor"] = MetricsCollector(
            simulation_state["slices"],
            get_strategy_fn=lambda: simulation_state["strategy"],
            db_path="network_logs.db"
        )
        
        simulation_state["traffic_gen"].start()
        simulation_state["monitor"].start()
        simulation_state["is_running"] = True
        
        save_action_log(
            "network_logs.db",
            "SYSTEM",
            f"Simulation started under {payload.strategy.upper()} strategy."
        )
    
    return {
        "status": "success",
        "message": f"Engine started in {simulation_state['mode']} mode with {payload.strategy} strategy",
        "mode": simulation_state["mode"],
        "interface": simulation_state["active_interface"],
        "allocations": {k: s.allocated_bandwidth for k, s in simulation_state["slices"].items()}
    }

@app.post("/api/stop")
def stop_simulation():
    if not simulation_state["is_running"]:
        return {"status": "error", "message": "Engine is not running"}
        
    if simulation_state["mode"] == "real_network" and simulation_state["real_net_mgr"]:
        simulation_state["real_net_mgr"].stop()
    else:
        if simulation_state["traffic_gen"]:
            simulation_state["traffic_gen"].stop()
        if simulation_state["monitor"]:
            simulation_state["monitor"].stop()
        
    simulation_state["is_running"] = False
    save_action_log("network_logs.db", "SYSTEM", "Engine stopped by administrator.")
    return {"status": "success", "message": "Engine stopped"}

@app.get("/api/metrics")
def get_metrics():
    is_real = simulation_state["mode"] == "real_network"
    
    # When user has not clicked 'Start Monitoring', return clean, truthful idle state
    if not simulation_state["is_running"]:
        allocations = (
            {k: s.allocated_bandwidth for k, s in simulation_state["slices"].items()}
            if simulation_state.get("slices")
            else simulation_state.get("custom_static", {"low_latency": 30.0, "high_bandwidth": 50.0, "general": 20.0})
        )
        idle_slices = {
            "low_latency": {
                "slice_name": "low_latency",
                "allocated_bandwidth": allocations.get("low_latency", 30.0),
                "throughput_mbps": 0.0,
                "packets_processed": 0,
                "packets_dropped": 0,
                "avg_latency": None,
                "avg_latency_ms": None,
                "p95_latency_ms": None,
                "avg_jitter_ms": 0.0,
                "loss_rate": 0.0,
                "utilization": 0.0,
                "qos_violations": [],
                "qos_status": "Waiting for data",
                "provenance": {
                    "throughput": {"value": 0.0, "unit": "Mbps", "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring inactive; click Start Monitoring to stream traffic."},
                    "latency": {"value": None, "unit": "ms", "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring inactive; no active RTT sample recorded."},
                    "drops": {"value": 0, "unit": "pkts", "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring inactive; drop counter inactive."},
                    "utilization": {"value": 0.0, "unit": "%", "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring inactive."}
                }
            },
            "high_bandwidth": {
                "slice_name": "high_bandwidth",
                "allocated_bandwidth": allocations.get("high_bandwidth", 50.0),
                "throughput_mbps": 0.0,
                "packets_processed": 0,
                "packets_dropped": 0,
                "avg_latency": None,
                "avg_latency_ms": None,
                "p95_latency_ms": None,
                "avg_jitter_ms": 0.0,
                "loss_rate": 0.0,
                "utilization": 0.0,
                "qos_violations": [],
                "qos_status": "Waiting for data",
                "provenance": {
                    "throughput": {"value": 0.0, "unit": "Mbps", "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring inactive; click Start Monitoring to stream traffic."},
                    "latency": {"value": None, "unit": "ms", "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring inactive; no active RTT sample recorded."},
                    "drops": {"value": 0, "unit": "pkts", "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring inactive; drop counter inactive."},
                    "utilization": {"value": 0.0, "unit": "%", "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring inactive."}
                }
            },
            "general": {
                "slice_name": "general",
                "allocated_bandwidth": allocations.get("general", 20.0),
                "throughput_mbps": 0.0,
                "packets_processed": 0,
                "packets_dropped": 0,
                "avg_latency": None,
                "avg_latency_ms": None,
                "p95_latency_ms": None,
                "avg_jitter_ms": 0.0,
                "loss_rate": 0.0,
                "utilization": 0.0,
                "qos_violations": [],
                "qos_status": "Waiting for data",
                "provenance": {
                    "throughput": {"value": 0.0, "unit": "Mbps", "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring inactive; click Start Monitoring to stream traffic."},
                    "latency": {"value": None, "unit": "ms", "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring inactive; no active RTT sample recorded."},
                    "drops": {"value": 0, "unit": "pkts", "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring inactive; drop counter inactive."},
                    "utilization": {"value": 0.0, "unit": "%", "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring inactive."}
                }
            }
        }
        gw_status = simulation_state["gateway_adapter"].status if simulation_state.get("gateway_adapter") else "UNCONFIGURED"
        gw_enforced = simulation_state["gateway_adapter"].enforced_allocations if simulation_state.get("gateway_adapter") else {}
        gw_mode = simulation_state["gateway_config"].mode if simulation_state.get("gateway_config") else simulation_state["mode"]
        
        wifi_info = get_wifi_details()
        probe_res = measure_real_network_probe()
        
        devices_list = simulation_state["device_manager"].get_all_devices(
            allocations=allocations,
            enforced_allocations=gw_enforced,
            predicted_demands={},
            live_rtt=probe_res.get("rtt_ms") or 10.0
        ) if simulation_state.get("device_manager") else []
        
        telemetry_status = {
            "interface": simulation_state["active_interface"],
            "download_mbps": {"value": 0.0, "unit": "Mbps", "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring stopped; active interface counter paused."},
            "upload_mbps": {"value": 0.0, "unit": "Mbps", "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring stopped; active interface counter paused."},
            "aggregate_mbps": {"value": 0.0, "unit": "Mbps", "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring stopped."},
            "wifi": {
                "ssid": wifi_info.get("ssid"),
                "signal": wifi_info.get("signal", "0%"),
                "rx_rate": wifi_info.get("rx_rate", "0"),
                "tx_rate": wifi_info.get("tx_rate", "0"),
                "band": wifi_info.get("band", "N/A"),
                "status": "MEASURED" if wifi_info.get("is_connected") else "UNAVAILABLE",
                "source": "netsh_wlan_interfaces"
            },
            "probe_rtt": probe_res
        }
        
        return {
            "status": "idle",
            "is_running": False,
            "is_online": (wifi_info.get("is_connected", False) or probe_res.get("rtt_ms") is not None),
            "data": {"timestamp": time.time(), "slices": idle_slices},
            "slices": idle_slices,
            "history": [],
            "allocations": allocations,
            "requested_allocations": simulation_state.get("custom_static", allocations),
            "calculated_allocations": allocations,
            "submitted_allocations": gw_enforced,
            "configured_allocations": allocations,
            "verified_enforcement_status": gw_status,
            "enforced_allocations": gw_enforced,
            "enforcement_status": gw_status,
            "gateway_mode": gw_mode,
            "gateway_info": simulation_state["gateway_config"].to_dict() if simulation_state.get("gateway_config") else {},
            "devices": devices_list,
            "logs": get_action_logs("network_logs.db", limit=25),
            "strategy": simulation_state["strategy"],
            "mode": simulation_state["mode"],
            "interface": simulation_state["active_interface"],
            "custom_static": simulation_state["custom_static"],
            "ml_info": simulation_state["ml_engine"].training_info,
            "active_apps": [],
            "dominant_app": "Monitoring Inactive (Click 'Start Monitoring')",
            "sla_guard": {"compliance": None, "violations_prevented": 0, "status": "NO_OBSERVATIONS", "last_event": "Monitoring stopped: Waiting for active traffic"},
            "energy_cost": {"spectrum_saved_mbps": 0.0, "energy_saved_kwh": 0.0, "cost_saved_usd": 0.0, "co2_saved_kg": 0.0, "efficiency_score": 0.0, "status": "UNAVAILABLE", "source": "monitoring_inactive", "description": "Monitoring stopped; active savings calculation inactive"},
            "phy_mbps": 0.0,
            "telemetry": telemetry_status
        }

    history_source = (
        simulation_state["real_net_mgr"].metrics_history 
        if is_real and simulation_state["real_net_mgr"] 
        else (simulation_state["monitor"].metrics_history if simulation_state["monitor"] else [])
    )
    is_online = (
        simulation_state["real_net_mgr"].is_online
        if is_real and simulation_state["real_net_mgr"]
        else True
    )

    if not history_source:
        allocations = {k: s.allocated_bandwidth for k, s in simulation_state["slices"].items()}
        gw_status = simulation_state["gateway_adapter"].status if simulation_state.get("gateway_adapter") else "UNCONFIGURED"
        gw_enforced = simulation_state["gateway_adapter"].enforced_allocations if simulation_state.get("gateway_adapter") else {}
        gw_mode = simulation_state["gateway_config"].mode if simulation_state.get("gateway_config") else simulation_state["mode"]
        devices_list = simulation_state["device_manager"].get_all_devices(
            allocations=allocations,
            enforced_allocations=gw_enforced,
            predicted_demands={},
            live_rtt=10.0
        ) if simulation_state.get("device_manager") else []
        return {
            "status": "idle",
            "is_running": True,
            "is_online": is_online,
            "data": None,
            "history": [],
            "allocations": allocations,
            "requested_allocations": simulation_state.get("custom_static", allocations),
            "calculated_allocations": allocations,
            "submitted_allocations": gw_enforced,
            "configured_allocations": allocations,
            "verified_enforcement_status": gw_status,
            "enforced_allocations": gw_enforced,
            "enforcement_status": gw_status,
            "gateway_mode": gw_mode,
            "gateway_info": simulation_state["gateway_config"].to_dict() if simulation_state.get("gateway_config") else {},
            "devices": devices_list,
            "logs": get_action_logs("network_logs.db", limit=25),
            "strategy": simulation_state["strategy"],
            "mode": simulation_state["mode"],
            "interface": simulation_state["active_interface"],
            "custom_static": simulation_state["custom_static"],
            "ml_info": simulation_state["ml_engine"].training_info,
            "active_apps": [],
            "dominant_app": "Waiting for first sample...",
            "sla_guard": {"compliance": None, "violations_prevented": 0, "status": "WAITING_DATA", "last_event": "Waiting for first sample..."},
            "energy_cost": {"spectrum_saved_mbps": 0.0, "energy_saved_kwh": 0.0, "cost_saved_usd": 0.0, "efficiency_score": 0.0, "status": "UNAVAILABLE", "description": "Waiting for initial sample"},
            "telemetry": None
        }
        
    latest = history_source[-1]
    strategy = simulation_state["strategy"]
    engine = simulation_state["allocation_engine"]
    pred = None
    
    if engine and is_online:
        if strategy == "static":
            engine.allocate_static()
        elif strategy == "rule_based":
            engine.allocate_rule_based(latest)
        elif strategy == "ai_assisted":
            pred = simulation_state["ml_engine"].predict_demand(latest)
            engine.allocate_ai_assisted(pred)

    # In Real Network mode, sync shaper rates with current slice allocations
    if is_real and simulation_state["slices"]:
        for k, s in simulation_state["slices"].items():
            if hasattr(s, "set_allocated_bandwidth"):
                s.set_allocated_bandwidth(s.allocated_bandwidth)
        
    history = history_source[-60:]
    action_logs = get_action_logs("network_logs.db", limit=30)
    allocations = {k: s.allocated_bandwidth for k, s in simulation_state["slices"].items()}
    gw_status = simulation_state["gateway_adapter"].status if simulation_state.get("gateway_adapter") else "UNCONFIGURED"
    gw_enforced = simulation_state["gateway_adapter"].enforced_allocations if simulation_state.get("gateway_adapter") else {}
    gw_mode = simulation_state["gateway_config"].mode if simulation_state.get("gateway_config") else simulation_state["mode"]
    
    # Update device throughputs from live physical/virtual slices
    live_rtt_val = latest.get("live_rtt", 12.0) or 12.0
    if simulation_state.get("device_manager"):
        devices_list = simulation_state["device_manager"].get_all_devices(
            allocations=allocations,
            enforced_allocations=gw_enforced,
            predicted_demands=pred or {},
            live_rtt=live_rtt_val
        )
    else:
        devices_list = []

    # Telemetry data packaging
    if is_real and latest.get("telemetry"):
        telemetry_payload = latest["telemetry"]
    else:
        # Simulation mode or fallback
        total_sim_mbps = round(sum(s.get("throughput_mbps", 0) for s in latest.get("slices", {}).values()), 2)
        telemetry_payload = {
            "interface": simulation_state["active_interface"],
            "download_mbps": {"value": 0.0, "unit": "Mbps", "status": "SIMULATED", "source": "simulation_engine", "description": "Synthetic simulation mode"},
            "upload_mbps": {"value": 0.0, "unit": "Mbps", "status": "SIMULATED", "source": "simulation_engine", "description": "Synthetic simulation mode"},
            "aggregate_mbps": {"value": total_sim_mbps, "unit": "Mbps", "status": "SIMULATED", "source": "simulation_engine", "description": "Synthetic aggregate simulation throughput"},
            "wifi": {"ssid": "Synthetic Slicing Environment", "signal": "100%", "status": "SIMULATED", "source": "simulation_engine"},
            "probe_rtt": {"value": None, "unit": "ms", "target": "Simulated Network", "status": "SIMULATED", "source": "simulation_engine"}
        }
        
    return {
        "status": "active",
        "is_online": is_online,
        "data": latest,
        "history": history,
        "allocations": allocations,
        "requested_allocations": simulation_state.get("custom_static", allocations),
        "calculated_allocations": allocations,
        "submitted_allocations": gw_enforced,
        "configured_allocations": allocations,
        "verified_enforcement_status": gw_status,
        "predicted_demands": pred,
        "enforced_allocations": gw_enforced,
        "enforcement_status": gw_status,
        "gateway_mode": gw_mode,
        "gateway_info": simulation_state["gateway_config"].to_dict() if simulation_state.get("gateway_config") else {},
        "devices": devices_list,
        "strategy": strategy,
        "mode": simulation_state["mode"],
        "interface": simulation_state["active_interface"],
        "logs": action_logs,
        "ml_info": simulation_state["ml_engine"].training_info,
        "active_apps": latest.get("active_apps", []),
        "dominant_app": latest.get("dominant_app", "Normal Traffic"),
        "sla_guard": latest.get("sla_guard", {}),
        "energy_cost": latest.get("energy_cost", {}),
        "phy_mbps": latest.get("phy_mbps", 0.0),
        "telemetry": telemetry_payload
    }

@app.post("/api/network/simulate-disconnect")
def toggle_simulate_disconnect(payload: Optional[Dict] = None):
    simulate = payload.get("simulate") if payload else None
    if simulation_state["real_net_mgr"]:
        res = simulation_state["real_net_mgr"].toggle_simulated_disconnect(simulate)
        return {
            "status": "success",
            "simulated_disconnect": res,
            "is_online": simulation_state["real_net_mgr"].is_online
        }
    return {"status": "error", "message": "Real network manager not active"}

@app.get("/api/history")
def get_history(limit: int = Query(60, ge=1, le=500), slice_name: Optional[str] = None):
    records = get_recent_history("network_logs.db", limit=limit, slice_name=slice_name)
    return {"status": "success", "count": len(records), "data": records}

@app.get("/api/analytics/summary")
def get_summary():
    summary = get_analytics_summary("network_logs.db")
    return {"status": "success", "summary": summary}

@app.post("/api/simulate_spike")
def simulate_spike(payload: SpikePayload):
    if not simulation_state["is_running"]:
        return {"status": "error", "message": "Engine is not currently running"}
    
    if simulation_state["mode"] == "real_network":
        r_mgr = simulation_state["real_net_mgr"]
        if r_mgr and payload.slice_name in r_mgr.traffic_profiles:
            curr = r_mgr.traffic_profiles[payload.slice_name]
            new_val = curr * payload.multiplier
            r_mgr.update_profile(payload.slice_name, new_val)
            return {
                "status": "success",
                "message": f"Real socket traffic spiked on {payload.slice_name} to {new_val / 1_000_000:.1f} Mbps",
                "new_profile_mbps": new_val / 1_000_000
            }
    else:
        tg = simulation_state["traffic_gen"]
        if tg and payload.slice_name in tg.traffic_profiles:
            curr = tg.traffic_profiles[payload.slice_name]
            new_val = curr * payload.multiplier
            tg.update_profile(payload.slice_name, new_val)
            return {
                "status": "success",
                "message": f"Spiked traffic on {payload.slice_name} to {new_val / 1_000_000:.1f} Mbps",
                "new_profile_mbps": new_val / 1_000_000
            }
    return {"status": "error", "message": "Slice not found"}

@app.post("/api/simulate_scenario")
def simulate_scenario(payload: ScenarioPayload):
    if not simulation_state["is_running"]:
        return {"status": "error", "message": "Engine is not currently running"}
        
    if simulation_state["mode"] == "real_network":
        r_mgr = simulation_state["real_net_mgr"]
        if r_mgr:
            profiles = r_mgr.apply_scenario(payload.scenario)
            return {
                "status": "success",
                "scenario": payload.scenario,
                "mode": "real_network",
                "profiles_mbps": {k: v / 1_000_000 for k, v in profiles.items()}
            }
    else:
        tg = simulation_state["traffic_gen"]
        if tg:
            profiles = tg.apply_scenario(payload.scenario)
            return {
                "status": "success",
                "scenario": payload.scenario,
                "mode": "simulation",
                "profiles_mbps": {k: v / 1_000_000 for k, v in profiles.items()}
            }
    return {"status": "error", "message": "Traffic generator not active"}

@app.post("/api/slices/configure_static")
def configure_static_allocation(payload: StaticAllocationPayload):
    alloc_dict = {
        "low_latency": payload.low_latency,
        "high_bandwidth": payload.high_bandwidth,
        "general": payload.general
    }
    simulation_state["custom_static"] = alloc_dict
    
    if simulation_state["is_running"] and simulation_state["allocation_engine"]:
        success, msg = simulation_state["allocation_engine"].set_custom_static_config(alloc_dict)
        return {
            "status": "success" if success else "error",
            "message": msg,
            "allocations": simulation_state["allocation_engine"].custom_static_config
        }
    return {
        "status": "success",
        "message": "Custom static allocations saved for next run.",
        "allocations": alloc_dict
    }

# Networking Protocols & Multi-Model Imports
from simulation.dhcp import dhcp_server
from simulation.dns import dns_server
from simulation.multicast import multicast_mgr

class DHCPRequestPayload(BaseModel):
    mac: str
    slice_type: str

class DHCPReleasePayload(BaseModel):
    mac: str

class DNSResolvePayload(BaseModel):
    domain: str

class DNSAddRecordPayload(BaseModel):
    domain: str
    ip: str
    port: int
    slice_name: str

class MulticastBroadcastPayload(BaseModel):
    sender: str = "orchestrator"
    event_type: str = "SLICE_REALLOCATION_SIGNAL"
    message: str

class MLModelSelectionPayload(BaseModel):
    model_type: str # decision_tree, linear_regression, random_forest, gradient_boosting

@app.post("/api/train")
def train_model():
    ml_engine = simulation_state["ml_engine"]
    result = ml_engine.train_from_db()
    return result

@app.post("/api/ml/model")
def select_ml_model(payload: MLModelSelectionPayload):
    ml_engine = simulation_state["ml_engine"]
    res = ml_engine.set_model_type(payload.model_type)
    return res

@app.get("/api/ml/status")
def get_ml_status():
    ml_engine = simulation_state["ml_engine"]
    return {
        "active_model": ml_engine.selected_model_type,
        "is_trained": ml_engine.is_trained,
        "training_info": ml_engine.training_info,
        "comparison": ml_engine.comparison_metrics
    }

# --- DHCP SIMULATION ENDPOINTS ---
@app.get("/api/dhcp/leases")
def get_dhcp_leases():
    return {"status": "success", "leases": dhcp_server.get_active_leases()}

@app.post("/api/dhcp/request")
def request_dhcp_ip(payload: DHCPRequestPayload):
    try:
        lease = dhcp_server.request_ip(payload.mac, payload.slice_type)
        return {"status": "success", "lease": lease}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/dhcp/release")
def release_dhcp_ip(payload: DHCPReleasePayload):
    try:
        res = dhcp_server.release_ip(payload.mac)
        return {"status": "success", "result": res}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/dhcp/simulate_bulk")
def simulate_bulk_dhcp():
    """Simulates 4 diverse real-world virtual UE nodes leasing IP addresses across slices."""
    nodes = [
        ("4A:5B:6C:7D:8E:01", "low_latency"),     # Autonomous Robot Controller
        ("4A:5B:6C:7D:8E:02", "high_bandwidth"),   # 4K AR/VR Surveillance Drone
        ("4A:5B:6C:7D:8E:03", "high_bandwidth"),   # 8K Mobile Telepresence Display
        ("4A:5B:6C:7D:8E:04", "general"),          # Smart Grid Utility Meter
    ]
    created = []
    for mac, slice_type in nodes:
        lease = dhcp_server.request_ip(mac, slice_type)
        created.append(lease)
    return {"status": "success", "leases": dhcp_server.get_active_leases()}

@app.post("/api/sla/trigger_self_heal")
def trigger_sla_self_heal():
    if simulation_state["mode"] == "real_network" and simulation_state["real_net_mgr"]:
        res = simulation_state["real_net_mgr"].trigger_self_heal_demo("low_latency")
        return res
    return {"status": "error", "message": "Real network manager not active"}

# --- DNS SIMULATION ENDPOINTS ---
@app.get("/api/dns/records")
def get_dns_records():
    return {"status": "success", "records": dns_server.get_records(), "history": dns_server.get_query_history()}

@app.post("/api/dns/resolve")
def resolve_dns_domain(payload: DNSResolvePayload):
    result = dns_server.resolve(payload.domain)
    return result

@app.post("/api/dns/add")
def add_dns_record(payload: DNSAddRecordPayload):
    res = dns_server.add_record(payload.domain, payload.ip, payload.port, payload.slice_name)
    return res

# --- IPv4 MULTICAST ENDPOINTS ---
@app.get("/api/multicast/status")
def get_multicast_status():
    return {"status": "success", "multicast": multicast_mgr.get_status()}

@app.post("/api/multicast/broadcast")
def broadcast_multicast_signal(payload: MulticastBroadcastPayload):
    msg = multicast_mgr.broadcast_signal(payload.sender, payload.event_type, payload.message)
    return {"status": "success", "broadcast": msg}

@app.get("/api/logs")
def get_logs(limit: int = 50):
    logs = get_action_logs("network_logs.db", limit=limit)
    return {"status": "success", "logs": logs}

@app.post("/api/chat")
def chat_with_bot(payload: ChatPayload):
    reply = generate_ai_response(
        payload.message,
        simulation_state=simulation_state,
        db_path="network_logs.db"
    )
    return {"reply": reply}

# --- APPLICATION PROFILES & QoS CONFIGURATION ---
class ProfileUpdatePayload(BaseModel):
    profile_id: str
    updates: Dict[str, Any]

class ExperimentPayload(BaseModel):
    scenario: Optional[str] = "gaming_burst"
    duration_ticks: Optional[int] = 20
    seed: Optional[int] = 42

class SliceLimitsPayload(BaseModel):
    limits: Dict[str, Dict[str, float]]

@app.get("/api/application-profiles")
def get_application_profiles():
    """Returns the 8 QoS application profiles and their current parameters."""
    return {
        "status": "success",
        "profiles": profile_registry.get_all()
    }

@app.post("/api/application-profiles/configure")
def configure_application_profile(payload: ProfileUpdatePayload):
    """Updates QoS parameters for a specified application profile."""
    success = profile_registry.update_profile(payload.profile_id, payload.updates)
    if not success:
        return {"status": "error", "message": f"Profile '{payload.profile_id}' not found"}
    save_action_log(
        "network_logs.db",
        "CONFIG",
        f"Updated QoS Application Profile '{payload.profile_id}': {payload.updates}"
    )
    return {"status": "success", "profile": profile_registry.get_profile(payload.profile_id)}

@app.post("/api/application-profiles/reset")
def reset_application_profiles():
    profile_registry.reset_defaults()
    return {"status": "success", "message": "Application profiles reset to defaults"}

# --- FAIR EXPERIMENTAL EVALUATION RUNNER ---
@app.post("/api/experiments/compare")
def compare_strategies_experiment(payload: ExperimentPayload):
    """
    Executes a fair 3-strategy evaluation (Static vs Rule-Based vs AI-Assisted)
    under an identical reproducible workload with the same random seed.
    """
    result = run_fair_experiment_comparison(
        scenario_name=payload.scenario or "gaming_burst",
        duration_ticks=payload.duration_ticks or 20,
        seed=payload.seed or 42,
        ml_engine=simulation_state["ml_engine"],
        db_path="network_logs.db"
    )
    save_action_log(
        "network_logs.db",
        "EXPERIMENT",
        f"Completed fair 3-strategy comparison under scenario '{payload.scenario}'. Latency reduction: {result['tradeoffs_summary']['latency_reduction_pct']}%"
    )
    return {"status": "success", "experiment": result}

@app.get("/api/experiments/history")
def get_experiment_history(limit: int = 15):
    """Returns past benchmark experiment results stored in SQLite."""
    results = get_experiment_results("network_logs.db", limit=limit)
    return {"status": "success", "experiments": results}

# --- ALLOCATION DECISIONS & SLA LIMITS ---
def ensure_allocation_engine():
    if simulation_state.get("allocation_engine") is None:
        if simulation_state.get("slices") is None:
            simulation_state["slices"] = initialize_slices()
        simulation_state["allocation_engine"] = ResourceAllocationEngine(simulation_state["slices"], db_path="network_logs.db")
    return simulation_state["allocation_engine"]

@app.get("/api/allocation/decisions")
def get_allocation_decisions(limit: int = 25):
    """Returns recent explainable allocation decisions recorded by the engine."""
    engine = ensure_allocation_engine()
    return {"status": "success", "decisions": engine.get_decision_history(limit=limit)}

@app.get("/api/allocation/limits")
def get_slice_limits():
    """Returns current per-slice SLA limits (min, max, priority)."""
    engine = ensure_allocation_engine()
    return {
        "status": "success",
        "limits": engine.get_slice_limits(),
        "feasibility": engine.check_configuration_feasibility()[1]
    }

@app.post("/api/allocation/limits")
def update_slice_limits(payload: SliceLimitsPayload):
    """Updates slice limits and validates budget feasibility."""
    engine = ensure_allocation_engine()
    success, msg = engine.set_slice_limits(payload.limits)
    if not success:
        return {"status": "error", "message": msg}
    return {"status": "success", "message": msg, "limits": engine.get_slice_limits()}

# --- REAL-NETWORK INTEGRATION GATEWAY & DEVICE APIs ---

class GatewayConfigPayload(BaseModel):
    mode: Optional[str] = "simulation" # "simulation" | "real_network_monitor" | "real_network_enforce"
    adapter_type: Optional[str] = "dry_run" # "linux_tc" | "dry_run" | "local_shaper"
    interface: Optional[str] = "Wi-Fi"
    parent_bandwidth_mbps: Optional[float] = 100.0
    operator_authorized: Optional[bool] = False
    dry_run: Optional[bool] = True
    ssh_host: Optional[str] = None
    ssh_user: Optional[str] = None

class LabDevicePayload(BaseModel):
    device_id: str
    name: str
    mac_address: str
    ip_address: str
    assigned_slice: str
    application_profile: str
    classification_source: Optional[str] = "Explicit Operator Label"

class DryRunPayload(BaseModel):
    allocations: Optional[Dict[str, float]] = None

@app.get("/api/gateway/status")
def get_gateway_status():
    """Returns current gateway integration status, adapter mode, and audit trail."""
    gw_config = simulation_state.get("gateway_config")
    gw_adapter = simulation_state.get("gateway_adapter")
    
    return {
        "status": "success",
        "mode": gw_config.mode if gw_config else simulation_state["mode"],
        "adapter_type": gw_config.adapter_type if gw_config else "dry_run",
        "interface": gw_config.interface if gw_config else simulation_state["active_interface"],
        "parent_bandwidth_mbps": gw_config.parent_bandwidth_mbps if gw_config else 100.0,
        "operator_authorized": gw_config.operator_authorized if gw_config else False,
        "dry_run": gw_config.dry_run if gw_config else True,
        "enforcement_status": gw_adapter.status if gw_adapter else EnforcementStatus.UNCONFIGURED,
        "enforced_allocations": gw_adapter.enforced_allocations if gw_adapter else {},
        "privilege_check": gw_adapter.check_privileges() if gw_adapter else (True, "Unconfigured"),
        "audit_log": gw_adapter.command_audit_log[-15:] if gw_adapter else []
    }

@app.post("/api/gateway/config")
def update_gateway_config(payload: GatewayConfigPayload):
    """
    Configures Real-Network Gateway adapter settings, operating mode,
    and operator authorization flags.
    """
    # 1. Update config model
    gw_config = simulation_state.get("gateway_config")
    if not gw_config:
        gw_config = GatewayConfig(
            mode=payload.mode or "simulation",
            adapter_type=payload.adapter_type or "dry_run",
            interface=payload.interface or simulation_state["active_interface"],
            parent_bandwidth_mbps=payload.parent_bandwidth_mbps or 100.0,
            operator_authorized=payload.operator_authorized or False,
            dry_run=payload.dry_run if payload.dry_run is not None else True,
            ssh_host=payload.ssh_host,
            ssh_user=payload.ssh_user,
            db_path=DEFAULT_DB_PATH
        )
        simulation_state["gateway_config"] = gw_config
    else:
        if payload.mode:
            gw_config.mode = payload.mode
            simulation_state["mode"] = payload.mode
        if payload.adapter_type:
            gw_config.adapter_type = payload.adapter_type
        if payload.interface:
            gw_config.interface = payload.interface
            simulation_state["active_interface"] = payload.interface
        if payload.parent_bandwidth_mbps:
            gw_config.parent_bandwidth_mbps = payload.parent_bandwidth_mbps
        if payload.operator_authorized is not None:
            gw_config.operator_authorized = payload.operator_authorized
        if payload.dry_run is not None:
            gw_config.dry_run = payload.dry_run
        if payload.ssh_host is not None:
            gw_config.ssh_host = payload.ssh_host
        if payload.ssh_user is not None:
            gw_config.ssh_user = payload.ssh_user

    # 2. Re-create or re-attach gateway adapter
    new_adapter = create_gateway_adapter(gw_config, real_network_manager=simulation_state.get("real_net_mgr"))
    simulation_state["gateway_adapter"] = new_adapter
    
    if simulation_state.get("allocation_engine"):
        simulation_state["allocation_engine"].set_gateway_adapter(new_adapter)
        
    save_action_log(
        DEFAULT_DB_PATH,
        "GATEWAY-CONFIG",
        f"Gateway configuration updated: Mode={gw_config.mode}, Adapter={gw_config.adapter_type}, Interface={gw_config.interface}, Authorized={gw_config.operator_authorized}, DryRun={gw_config.dry_run}"
    )
    
    return {
        "status": "success",
        "message": f"Gateway configured in {gw_config.mode} mode using {gw_config.adapter_type} adapter",
        "config": gw_config.to_dict(),
        "enforcement_status": new_adapter.status
    }

@app.post("/api/gateway/dry-run")
def run_gateway_dry_run(payload: Optional[DryRunPayload] = None):
    """
    Executes a dry-run validation against proposed or active allocations.
    Returns generated Linux tc commands without making system modifications.
    """
    adapter = simulation_state.get("gateway_adapter")
    if not adapter:
        adapter = create_gateway_adapter(simulation_state["gateway_config"])
        simulation_state["gateway_adapter"] = adapter

    allocations = (
        payload.allocations
        if payload and payload.allocations
        else {k: s.allocated_bandwidth for k, s in simulation_state["slices"].items()}
        if simulation_state.get("slices")
        else {"low_latency": 30.0, "high_bandwidth": 50.0, "general": 20.0}
    )

    valid, val_msg = adapter.validate_configuration(allocations)
    cmds = adapter.generate_tc_commands(allocations, is_initial=True)
    rollback_cmds = adapter.generate_rollback_commands()

    return {
        "status": "success" if valid else "validation_error",
        "valid": valid,
        "message": val_msg,
        "allocations": allocations,
        "interface": simulation_state["gateway_config"].interface,
        "generated_tc_commands": cmds,
        "rollback_commands": rollback_cmds,
        "parent_bandwidth_mbps": simulation_state["gateway_config"].parent_bandwidth_mbps
    }

@app.post("/api/gateway/rollback")
def rollback_gateway():
    """
    Rolls back traffic control rules on the gateway and cleans up qdiscs.
    """
    adapter = simulation_state.get("gateway_adapter")
    if not adapter:
        return {"status": "error", "message": "No active gateway adapter attached"}

    success, msg = adapter.rollback()
    return {
        "status": "success" if success else "error",
        "message": msg,
        "enforcement_status": adapter.status
    }

# --- DEVICE MANAGEMENT & TRAFFIC CLASSIFICATION APIs ---

@app.get("/api/devices")
def get_lab_devices():
    """Returns all registered physical/lab devices with truthful metric indicators."""
    dm = simulation_state.get("device_manager")
    if not dm:
        return {"status": "success", "devices": []}

    allocations = (
        {k: s.allocated_bandwidth for k, s in simulation_state["slices"].items()}
        if simulation_state.get("slices")
        else {"low_latency": 30.0, "high_bandwidth": 50.0, "general": 20.0}
    )
    enforced = simulation_state["gateway_adapter"].enforced_allocations if simulation_state.get("gateway_adapter") else {}
    devices = dm.get_all_devices(allocations=allocations, enforced_allocations=enforced)
    return {"status": "success", "devices": devices}

@app.post("/api/devices")
def add_lab_device(payload: LabDevicePayload):
    """Registers or updates a physical/lab device with explicit classification labels."""
    dm = simulation_state.get("device_manager")
    if not dm:
        dm = DeviceManager(db_path=DEFAULT_DB_PATH)
        simulation_state["device_manager"] = dm

    dev = dm.register_device(
        device_id=payload.device_id,
        name=payload.name,
        mac_address=payload.mac_address,
        ip_address=payload.ip_address,
        assigned_slice=payload.assigned_slice,
        application_profile=payload.application_profile,
        classification_source=payload.classification_source or ClassificationSource.EXPLICIT_LABEL
    )
    return {"status": "success", "message": f"Registered device '{dev.name}'", "device_id": dev.device_id}

@app.delete("/api/devices/{device_id}")
def delete_lab_device(device_id: str):
    """Removes a device from the lab device inventory."""
    dm = simulation_state.get("device_manager")
    if not dm:
        return {"status": "error", "message": "Device manager not initialized"}

    success = dm.remove_device(device_id)
    if success:
        return {"status": "success", "message": f"Device '{device_id}' removed."}
    return {"status": "error", "message": f"Device '{device_id}' not found."}


