from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict

# Database & Analytics Imports
from database import (
    init_db,
    save_action_log,
    get_recent_history,
    get_action_logs,
    get_analytics_summary
)

# Simulation & Real Network Imports
from simulation.slices import initialize_slices
from simulation.traffic_generator import TrafficGenerator
from simulation.monitor import MetricsCollector
from simulation.allocation import ResourceAllocationEngine
from simulation.ml_engine import MLEngine
from ai_assistant import generate_ai_response
from real_network import get_available_interfaces, RealNetworkManager

app = FastAPI(title="AI-Assisted Network Slicing API", version="2.1")

# Initialize database
init_db("network_logs.db")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global State
simulation_state = {
    "is_running": False,
    "strategy": "static",
    "mode": "simulation", # "simulation" | "real_network"
    "active_interface": "Wi-Fi",
    "slices": None,
    "traffic_gen": None,
    "monitor": None,
    "real_net_mgr": None,
    "allocation_engine": None,
    "ml_engine": MLEngine(db_path="network_logs.db"),
    "custom_static": {
        "low_latency": 30.0,
        "high_bandwidth": 50.0,
        "general": 20.0
    }
}

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

class ChatPayload(BaseModel):
    message: str

@app.get("/api/status")
def get_system_status():
    interfaces = get_available_interfaces()
    return {
        "is_running": simulation_state["is_running"],
        "strategy": simulation_state["strategy"],
        "mode": simulation_state["mode"],
        "active_interface": simulation_state["active_interface"],
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
        return {"status": "error", "message": "Engine is already running"}
        
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
    history_source = (
        simulation_state["real_net_mgr"].metrics_history 
        if is_real and simulation_state["real_net_mgr"] 
        else (simulation_state["monitor"].metrics_history if simulation_state["monitor"] else [])
    )

    if not simulation_state["is_running"] or not history_source:
        return {
            "status": "idle",
            "data": None,
            "history": [],
            "logs": get_action_logs("network_logs.db", limit=25),
            "strategy": simulation_state["strategy"],
            "mode": simulation_state["mode"],
            "interface": simulation_state["active_interface"],
            "custom_static": simulation_state["custom_static"],
            "ml_info": simulation_state["ml_engine"].training_info
        }
        
    latest = history_source[-1]
    strategy = simulation_state["strategy"]
    engine = simulation_state["allocation_engine"]
    
    if engine:
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
        
    return {
        "status": "active",
        "data": latest,
        "history": history,
        "allocations": allocations,
        "strategy": strategy,
        "mode": simulation_state["mode"],
        "interface": simulation_state["active_interface"],
        "logs": action_logs,
        "ml_info": simulation_state["ml_engine"].training_info
    }

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

@app.post("/api/train")
def train_model():
    ml_engine = simulation_state["ml_engine"]
    result = ml_engine.train_from_db()
    return result

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
