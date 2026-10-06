import pandas as pd
import numpy as np
import time
from sklearn.tree import DecisionTreeRegressor
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_squared_error, r2_score
from database import get_session, NetworkLog, save_action_log

class MLEngine:
    def __init__(self, db_path="network_logs.db"):
        self.db_path = db_path
        self.selected_model_type = "decision_tree"  # Options: decision_tree, linear_regression, random_forest, gradient_boosting
        
        # Dictionary holding model instances per algorithm and per slice
        self.algorithm_factories = {
            "decision_tree": lambda: DecisionTreeRegressor(max_depth=5, min_samples_split=3),
            "linear_regression": lambda: LinearRegression(),
            "random_forest": lambda: RandomForestRegressor(n_estimators=15, max_depth=5, random_state=42),
            "gradient_boosting": lambda: GradientBoostingRegressor(n_estimators=15, max_depth=3, random_state=42)
        }
        
        # Current active models per slice
        self.models = {
            "low_latency": self.algorithm_factories[self.selected_model_type](),
            "high_bandwidth": self.algorithm_factories[self.selected_model_type](),
            "general": self.algorithm_factories[self.selected_model_type]()
        }
        
        self.is_trained = False
        self.comparison_metrics = {}  # Comparison of all algorithms
        self.training_info = {
            "trained_at": None,
            "sample_count": 0,
            "scores": {},
            "active_model": self.selected_model_type,
            "status": "Untrained (Using heuristic baseline)"
        }

    def set_model_type(self, model_type: str):
        if model_type not in self.algorithm_factories:
            return {"success": False, "message": f"Unsupported model type '{model_type}'"}
        
        self.selected_model_type = model_type
        # Re-instantiate slice models
        self.models = {
            "low_latency": self.algorithm_factories[model_type](),
            "high_bandwidth": self.algorithm_factories[model_type](),
            "general": self.algorithm_factories[model_type]()
        }
        self.is_trained = False
        self.training_info["active_model"] = model_type
        self.training_info["status"] = f"Switched to {model_type} (Needs retraining)"
        return {"success": True, "active_model": model_type}

    def train_from_db(self):
        """
        Loads historical traffic from SQLite network_logs table, trains all algorithms for comparison,
        and fits the currently selected model algorithm.
        """
        session = get_session(self.db_path)
        try:
            records = session.query(
                NetworkLog.timestamp,
                NetworkLog.slice_name,
                NetworkLog.throughput_mbps
            ).order_by(NetworkLog.timestamp.asc()).all()

            if not records or len(records) < 15:
                return {
                    "success": False,
                    "message": f"Insufficient historical data ({len(records)} records). Run simulation for at least 15-20 seconds first.",
                    "sample_count": len(records)
                }

            df = pd.DataFrame([{
                "timestamp": r[0],
                "slice_name": r[1],
                "throughput_mbps": r[2]
            } for r in records])

            scores = {}
            comparison = {}
            total_samples = 0

            for slice_key in ["low_latency", "high_bandwidth", "general"]:
                slice_df = df[df["slice_name"] == slice_key].copy()
                if len(slice_df) >= 10:
                    slice_df["next_throughput"] = slice_df["throughput_mbps"].shift(-1)
                    clean_df = slice_df.dropna()
                    
                    if len(clean_df) >= 8:
                        X = clean_df[["throughput_mbps"]].values
                        y = clean_df["next_throughput"].values
                        total_samples += len(clean_df)

                        # Fit and compare all supported models
                        slice_comparison = {}
                        for algo_name, factory in self.algorithm_factories.items():
                            m = factory()
                            m.fit(X, y)
                            preds = m.predict(X)
                            r2 = r2_score(y, preds)
                            mse = mean_squared_error(y, preds)
                            slice_comparison[algo_name] = {
                                "r2_score": round(max(0.0, float(r2)), 4),
                                "mse": round(float(mse), 4)
                            }
                        comparison[slice_key] = slice_comparison

                        # Fit current selected active model for inference
                        active_m = self.models[slice_key]
                        active_m.fit(X, y)
                        active_r2 = active_m.score(X, y)
                        scores[slice_key] = round(max(0.0, float(active_r2)), 3)

            if total_samples > 0:
                self.is_trained = True
                self.comparison_metrics = comparison
                self.training_info = {
                    "trained_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "sample_count": total_samples,
                    "scores": scores,
                    "active_model": self.selected_model_type,
                    "comparison": comparison,
                    "status": f"Trained on SQLite Logs using {self.selected_model_type}"
                }
                save_action_log(
                    self.db_path,
                    "ML-ENGINE",
                    f"ML Models ({self.selected_model_type}) trained on {total_samples} snapshots! Fit scores: {scores}"
                )
                return {
                    "success": True,
                    "message": f"Successfully trained models on {total_samples} samples across 3 slices.",
                    "details": self.training_info
                }
            else:
                return {
                    "success": False,
                    "message": "Not enough per-slice transitions to train.",
                    "sample_count": 0
                }
        except Exception as e:
            print(f"Training error: {e}")
            return {"success": False, "message": f"Training failed: {str(e)}"}
        finally:
            session.close()

    def predict_demand(self, current_monitor_snapshot):
        if not current_monitor_snapshot or "slices" not in current_monitor_snapshot:
            return {}
            
        predictions = {}
        for slice_key, metrics in current_monitor_snapshot["slices"].items():
            current_throughput = metrics["throughput_mbps"]
            if self.is_trained and slice_key in self.models:
                try:
                    pred = self.models[slice_key].predict([[current_throughput]])[0]
                    # Keep positive and add a 5% proactive headroom
                    predictions[slice_key] = max(1.0, float(pred * 1.05))
                except Exception:
                    predictions[slice_key] = max(1.0, current_throughput * 1.1)
            else:
                # Fallback heuristic prediction (15% growth trend anticipation)
                predictions[slice_key] = max(1.0, current_throughput * 1.15)
                
        return predictions
