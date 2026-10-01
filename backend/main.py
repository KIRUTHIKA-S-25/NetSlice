from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Simulation Imports
from simulation.slices import initialize_slices
from simulation.traffic_generator import TrafficGenerator
from simulation.monitor import MetricsCollector
from simulation.allocation import ResourceAllocationEngine
from simulation.ml_engine import MLEngine

app = FastAPI(title="Network Slicing API")

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
    "slices": None,
    "traffic_gen": None,
    "monitor": None,
    "allocation_engine": None,
    "ml_engine": MLEngine()
}

class ConfigPayload(BaseModel):
    strategy: str # "static", "rule_based", "ai_assisted"

@app.post("/api/start")
def start_simulation(payload: ConfigPayload):
    if simulation_state["is_running"]:
        return {"status": "error", "message": "Simulation already running"}
        
    simulation_state["strategy"] = payload.strategy
    simulation_state["slices"] = initialize_slices()
    
    simulation_state["traffic_gen"] = TrafficGenerator(simulation_state["slices"])
    simulation_state["monitor"] = MetricsCollector(simulation_state["slices"])
    simulation_state["allocation_engine"] = ResourceAllocationEngine(simulation_state["slices"])
    
    simulation_state["traffic_gen"].start()
    simulation_state["monitor"].start()
    simulation_state["is_running"] = True
    
    return {"status": "success", "message": f"Simulation started with {payload.strategy} strategy"}

@app.post("/api/stop")
def stop_simulation():
    if not simulation_state["is_running"]:
        return {"status": "error", "message": "Simulation not running"}
        
    simulation_state["traffic_gen"].stop()
    simulation_state["monitor"].stop()
    simulation_state["is_running"] = False
    
    return {"status": "success", "message": "Simulation stopped"}

@app.get("/api/metrics")
def get_metrics():
    if not simulation_state["is_running"] or not simulation_state["monitor"].metrics_history:
        return {"status": "idle", "data": None}
        
    # Get the latest snapshot
    latest = simulation_state["monitor"].metrics_history[-1]
    
    # Run the allocation engine based on the active strategy
    strategy = simulation_state["strategy"]
    engine = simulation_state["allocation_engine"]
    
    if strategy == "static":
        engine.allocate_static()
    elif strategy == "rule_based":
        engine.allocate_rule_based(latest)
    elif strategy == "ai_assisted":
        pred = simulation_state["ml_engine"].predict_demand(latest)
        engine.allocate_ai_assisted(pred)
        
    return {"status": "active", "data": latest, "strategy": strategy}
