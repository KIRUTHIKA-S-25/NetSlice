import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.tree import DecisionTreeRegressor
import numpy as np

class MLEngine:
    def __init__(self):
        # We will use Decision Trees or Linear Regression as they are very lightweight 
        # and won't consume much of your PC's available memory.
        self.models = {
            "low_latency": DecisionTreeRegressor(max_depth=5),
            "high_bandwidth": DecisionTreeRegressor(max_depth=5),
            "general": DecisionTreeRegressor(max_depth=5)
        }
        self.is_trained = False

    def train(self, historical_data_csv):
        # In a real scenario, we load metrics history and train.
        # For simulation, we expect data to look like:
        # timestamp, slice_name, current_throughput, next_throughput (Target)
        try:
            df = pd.read_csv(historical_data_csv)
            for slice_key in self.models.keys():
                slice_data = df[df['slice_name'] == slice_key]
                if not slice_data.empty and len(slice_data) > 10:
                    # Very simple features: just use time and current load to predict next load
                    X = slice_data[['current_throughput']].values
                    y = slice_data['next_throughput'].values
                    self.models[slice_key].fit(X, y)
            self.is_trained = True
        except Exception as e:
            print(f"Training failed: {e}")
            self.is_trained = False

    def predict_demand(self, current_monitor_snapshot):
        if not current_monitor_snapshot:
            return {}
            
        predictions = {}
        for slice_key, metrics in current_monitor_snapshot["slices"].items():
            if self.is_trained:
                # Predict next throughput based on current throughput
                current_throughput = metrics["throughput_mbps"]
                pred = self.models[slice_key].predict([[current_throughput]])[0]
                predictions[slice_key] = max(0, pred) # demand can't be negative
            else:
                # Fallback naive prediction (demand = current usage)
                predictions[slice_key] = metrics["throughput_mbps"] * 1.1 # assume 10% growth
                
        return predictions
