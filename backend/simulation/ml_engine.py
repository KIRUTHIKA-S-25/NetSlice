import pandas as pd
import numpy as np
from sklearn.tree import DecisionTreeRegressor
from sklearn.linear_model import LinearRegression
from database import get_session, NetworkLog, save_action_log

class MLEngine:
    def __init__(self, db_path="network_logs.db"):
        self.db_path = db_path
        self.models = {
            "low_latency": DecisionTreeRegressor(max_depth=5, min_samples_split=3),
            "high_bandwidth": DecisionTreeRegressor(max_depth=5, min_samples_split=3),
            "general": DecisionTreeRegressor(max_depth=5, min_samples_split=3)
        }
        self.is_trained = False
        self.training_info = {
            "trained_at": None,
            "sample_count": 0,
            "scores": {},
            "status": "Untrained (Using heuristic baseline)"
        }

    def train_from_db(self):
        """
        Loads historical traffic from the SQLite network_logs table and retrains
        the DecisionTreeRegressor models.
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
            total_samples = 0

            for slice_key in self.models.keys():
                slice_df = df[df["slice_name"] == slice_key].copy()
                if len(slice_df) >= 10:
                    # Target is the next interval's throughput
                    slice_df["next_throughput"] = slice_df["throughput_mbps"].shift(-1)
                    clean_df = slice_df.dropna()
                    
                    if len(clean_df) >= 8:
                        X = clean_df[["throughput_mbps"]].values
                        y = clean_df["next_throughput"].values
                        
                        self.models[slice_key].fit(X, y)
                        r2 = self.models[slice_key].score(X, y)
                        scores[slice_key] = round(max(0.0, float(r2)), 3)
                        total_samples += len(clean_df)

            if total_samples > 0:
                self.is_trained = True
                import time
                self.training_info = {
                    "trained_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "sample_count": total_samples,
                    "scores": scores,
                    "status": "Trained on Historical SQLite Logs"
                }
                save_action_log(
                    self.db_path,
                    "ML-ENGINE",
                    f"Decision Tree Models retrained on {total_samples} database snapshots! Slice R² fit: {scores}"
                )
                return {
                    "success": True,
                    "message": f"Successfully retrained models on {total_samples} samples across 3 slices.",
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
