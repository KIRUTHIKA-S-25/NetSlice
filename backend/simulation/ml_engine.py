import pandas as pd
import numpy as np
import time
from sklearn.tree import DecisionTreeRegressor
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from database import get_session, NetworkLog, save_action_log

class MLEngine:
    def __init__(self, db_path="network_logs.db"):
        self.db_path = db_path
        self.selected_model_type = "decision_tree"  # decision_tree | linear_regression | random_forest | gradient_boosting
        
        self.algorithm_factories = {
            "decision_tree": lambda: DecisionTreeRegressor(max_depth=5, min_samples_split=3, random_state=42),
            "linear_regression": lambda: LinearRegression(),
            "random_forest": lambda: RandomForestRegressor(n_estimators=20, max_depth=5, random_state=42),
            "gradient_boosting": lambda: GradientBoostingRegressor(n_estimators=20, max_depth=3, random_state=42)
        }
        
        self.models = {
            "low_latency": self.algorithm_factories[self.selected_model_type](),
            "high_bandwidth": self.algorithm_factories[self.selected_model_type](),
            "general": self.algorithm_factories[self.selected_model_type]()
        }
        
        self.is_trained = False
        self.feature_names = ["throughput_mbps", "avg_latency", "utilization", "packets_dropped"]
        self.comparison_metrics = {}
        self.training_info = {
            "trained_at": None,
            "sample_count": 0,
            "scores": {},
            "active_model": self.selected_model_type,
            "status": "Untrained (Using heuristic baseline)",
            "validation_metrics": {},
            "baseline_metrics": {}
        }

    def set_model_type(self, model_type: str):
        if model_type not in self.algorithm_factories:
            return {"success": False, "message": f"Unsupported model type '{model_type}'"}
        
        self.selected_model_type = model_type
        self.models = {
            "low_latency": self.algorithm_factories[model_type](),
            "high_bandwidth": self.algorithm_factories[model_type](),
            "general": self.algorithm_factories[model_type]()
        }
        self.is_trained = False
        self.training_info["active_model"] = model_type
        self.training_info["status"] = f"Switched to {model_type} (Retrain required)"
        return {"success": True, "active_model": model_type}

    def train_from_db(self):
        """
        Loads historical telemetry from SQLite, constructs multi-feature time-ordered dataset,
        performs chronological train/validation splits, evaluates MAE, RMSE, and R2 against a
        persistence baseline, and fits the active model for future inference.
        """
        session = get_session(self.db_path)
        try:
            records = session.query(
                NetworkLog.timestamp,
                NetworkLog.slice_name,
                NetworkLog.throughput_mbps,
                NetworkLog.avg_latency,
                NetworkLog.utilization,
                NetworkLog.packets_dropped
            ).order_by(NetworkLog.timestamp.asc()).all()

            if not records or len(records) < 15:
                return {
                    "success": False,
                    "message": f"Insufficient historical telemetry ({len(records)} records). Run traffic for at least 15-20 seconds first.",
                    "sample_count": len(records)
                }

            df = pd.DataFrame([{
                "timestamp": r[0],
                "slice_name": r[1],
                "throughput_mbps": float(r[2] or 0.0),
                "avg_latency": float(r[3] or 0.0),
                "utilization": float(r[4] or 0.0),
                "packets_dropped": float(r[5] or 0.0)
            } for r in records])

            scores = {}
            comparison = {}
            validation_metrics = {}
            baseline_metrics = {}
            total_samples = 0

            for slice_key in ["low_latency", "high_bandwidth", "general"]:
                slice_df = df[df["slice_name"] == slice_key].copy()
                if len(slice_df) >= 8:
                    # Target is the next interval's throughput demand
                    slice_df["next_demand"] = slice_df["throughput_mbps"].shift(-1)
                    clean_df = slice_df.dropna().copy()
                    
                    if len(clean_df) >= 6:
                        total_samples += len(clean_df)
                        
                        # Chronological split: 75% train, 25% test/validation
                        split_idx = max(4, int(len(clean_df) * 0.75))
                        train_df = clean_df.iloc[:split_idx]
                        val_df = clean_df.iloc[split_idx:] if split_idx < len(clean_df) else clean_df.iloc[-4:]
                        
                        X_train = train_df[self.feature_names].values
                        y_train = train_df["next_demand"].values
                        X_val = val_df[self.feature_names].values
                        y_val = val_df["next_demand"].values
                        
                        # Calculate persistence baseline: next = current throughput
                        baseline_preds = val_df["throughput_mbps"].values
                        base_mae = mean_absolute_error(y_val, baseline_preds)
                        base_rmse = np.sqrt(mean_squared_error(y_val, baseline_preds))
                        baseline_metrics[slice_key] = {
                            "mae": round(float(base_mae), 3),
                            "rmse": round(float(base_rmse), 3)
                        }

                        # Fit and evaluate all algorithms
                        slice_comparison = {}
                        for algo_name, factory in self.algorithm_factories.items():
                            m = factory()
                            m.fit(X_train, y_train)
                            val_preds = m.predict(X_val)
                            
                            mae = mean_absolute_error(y_val, val_preds)
                            rmse = np.sqrt(mean_squared_error(y_val, val_preds))
                            r2 = r2_score(y_val, val_preds)
                            
                            slice_comparison[algo_name] = {
                                "mae": round(float(mae), 3),
                                "rmse": round(float(rmse), 3),
                                "r2_score": round(max(0.0, float(r2)), 4)
                            }
                        comparison[slice_key] = slice_comparison

                        # Fit selected active model on entire available clean dataset
                        active_m = self.models[slice_key]
                        X_all = clean_df[self.feature_names].values
                        y_all = clean_df["next_demand"].values
                        active_m.fit(X_all, y_all)
                        
                        # Active validation metrics
                        val_preds_active = active_m.predict(X_val)
                        active_mae = mean_absolute_error(y_val, val_preds_active)
                        active_rmse = np.sqrt(mean_squared_error(y_val, val_preds_active))
                        active_r2 = max(0.0, float(r2_score(y_val, val_preds_active)))
                        
                        scores[slice_key] = round(active_r2, 3)
                        validation_metrics[slice_key] = {
                            "mae": round(float(active_mae), 3),
                            "rmse": round(float(active_rmse), 3),
                            "r2": round(active_r2, 3)
                        }

            if total_samples > 0:
                self.is_trained = True
                self.comparison_metrics = comparison
                self.training_info = {
                    "trained_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "sample_count": total_samples,
                    "scores": scores,
                    "active_model": self.selected_model_type,
                    "validation_metrics": validation_metrics,
                    "baseline_metrics": baseline_metrics,
                    "comparison": comparison,
                    "status": f"Trained on SQLite Telemetry ({self.selected_model_type})"
                }
                save_action_log(
                    self.db_path,
                    "ML-ENGINE",
                    f"Multi-feature ML Models ({self.selected_model_type}) trained on {total_samples} samples. R2: {scores}"
                )
                return {
                    "success": True,
                    "message": f"Successfully trained {self.selected_model_type} on {total_samples} samples.",
                    "details": self.training_info
                }
            else:
                return {
                    "success": False,
                    "message": "Not enough per-slice transitions to train.",
                    "sample_count": 0
                }
        except Exception as e:
            print(f"ML Training error: {e}")
            return {"success": False, "message": f"Training failed: {str(e)}"}
        finally:
            session.close()

    def predict_demand(self, current_monitor_snapshot):
        """
        Generates near-future demand predictions per slice using multi-feature model.
        Falls back smoothly to robust heuristic if model is untrained or encounters anomalies.
        """
        if not current_monitor_snapshot or "slices" not in current_monitor_snapshot:
            return {}
            
        predictions = {}
        for slice_key, metrics in current_monitor_snapshot["slices"].items():
            current_throughput = metrics.get("throughput_mbps", 0.0)
            avg_latency = metrics.get("avg_latency", 0.0)
            utilization = metrics.get("utilization", 0.0)
            packets_dropped = metrics.get("packets_dropped", 0)
            
            if self.is_trained and slice_key in self.models:
                try:
                    feat_vector = [[current_throughput, avg_latency, utilization, packets_dropped]]
                    pred = self.models[slice_key].predict(feat_vector)[0]
                    # Enforce strict non-negative output with a 5% proactive headroom
                    predictions[slice_key] = max(1.0, float(pred * 1.05))
                except Exception as e:
                    # Robust fallback to trend heuristic
                    predictions[slice_key] = max(1.0, current_throughput * 1.12)
            else:
                # Documented baseline heuristic: 15% proactive headroom above current load
                predictions[slice_key] = max(1.0, current_throughput * 1.15)
                
        return predictions

    def evaluate_offline(self, history_records: list):
        """
        Calculates MAE and RMSE over a sequence of actual vs predicted observations.
        """
        if not history_records:
            return {"mae": 0.0, "rmse": 0.0}
        
        actuals = []
        preds = []
        for r in history_records:
            if "actual" in r and "predicted" in r:
                actuals.append(r["actual"])
                preds.append(r["predicted"])
                
        if not actuals:
            return {"mae": 0.0, "rmse": 0.0}
            
        mae = float(mean_absolute_error(actuals, preds))
        rmse = float(np.sqrt(mean_squared_error(actuals, preds)))
        return {"mae": round(mae, 3), "rmse": round(rmse, 3)}
