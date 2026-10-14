import os
import time
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, Float, String, Text, desc, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=15000")
    cursor.close()

DEFAULT_DB_PATH = os.environ.get("DATABASE_PATH", "network_logs.db")

Base = declarative_base()

class NetworkLog(Base):
    __tablename__ = "network_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(Float, index=True, nullable=False)
    datetime_str = Column(String(30), nullable=False)
    slice_name = Column(String(50), index=True, nullable=False)
    throughput_mbps = Column(Float, default=0.0)
    packets_processed = Column(Integer, default=0)
    packets_dropped = Column(Integer, default=0)
    avg_latency = Column(Float, default=0.0)
    utilization = Column(Float, default=0.0)
    allocated_bandwidth = Column(Float, default=0.0)
    strategy = Column(String(50), default="static")

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "datetime_str": self.datetime_str,
            "slice_name": self.slice_name,
            "throughput_mbps": round(self.throughput_mbps, 3),
            "packets_processed": self.packets_processed,
            "packets_dropped": self.packets_dropped,
            "avg_latency": round(self.avg_latency, 5),
            "avg_latency_ms": round(self.avg_latency * 1000, 2),
            "utilization": round(self.utilization, 2),
            "allocated_bandwidth": round(self.allocated_bandwidth, 2),
            "strategy": self.strategy
        }

class ActionLog(Base):
    __tablename__ = "action_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(Float, index=True, nullable=False)
    datetime_str = Column(String(30), nullable=False)
    level = Column(String(20), default="INFO")
    message = Column(Text, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "datetime_str": self.datetime_str,
            "level": self.level,
            "message": self.message
        }

class ExperimentResult(Base):
    __tablename__ = "experiment_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(Float, index=True, nullable=False)
    datetime_str = Column(String(30), nullable=False)
    scenario_name = Column(String(100), nullable=False)
    total_bandwidth_mbps = Column(Float, default=100.0)
    duration_seconds = Column(Integer, default=20)
    results_json = Column(Text, nullable=False)  # JSON-encoded dictionary

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "datetime_str": self.datetime_str,
            "scenario_name": self.scenario_name,
            "total_bandwidth_mbps": self.total_bandwidth_mbps,
            "duration_seconds": self.duration_seconds,
            "results": json.loads(self.results_json) if self.results_json else {}
        }

class ApplicationProfileModel(Base):
    __tablename__ = "application_profiles"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    category = Column(String(100), nullable=False)
    preferred_slice = Column(String(50), nullable=False)
    priority = Column(Integer, default=3)
    target_max_latency_ms = Column(Float, default=50.0)
    target_max_jitter_ms = Column(Float, default=10.0)
    target_max_loss_rate = Column(Float, default=0.01)
    min_throughput_mbps = Column(Float, default=5.0)
    target_throughput_mbps = Column(Float, default=15.0)
    delay_sensitive = Column(Integer, default=0)
    burst_intensity = Column(Float, default=1.2)
    description = Column(Text, default="")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "preferred_slice": self.preferred_slice,
            "priority": self.priority,
            "target_max_latency_ms": self.target_max_latency_ms,
            "target_max_jitter_ms": self.target_max_jitter_ms,
            "target_max_loss_rate": self.target_max_loss_rate,
            "min_throughput_mbps": self.min_throughput_mbps,
            "target_throughput_mbps": self.target_throughput_mbps,
            "delay_sensitive": bool(self.delay_sensitive),
            "burst_intensity": self.burst_intensity,
            "description": self.description
        }

_engines = {}
_session_factories = {}

def get_engine(db_path=None):
    if db_path is None or db_path == "none" or db_path is False:
        db_path = DEFAULT_DB_PATH
    if db_path not in _engines:
        eng = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False, "timeout": 15}
        )
        Base.metadata.create_all(eng)
        _engines[db_path] = eng
        _session_factories[db_path] = sessionmaker(bind=eng)
    return _engines[db_path]

def get_session(db_path=None):
    if db_path is None or db_path == "none" or db_path is False:
        db_path = DEFAULT_DB_PATH
    get_engine(db_path)
    return _session_factories[db_path]()

def init_db(db_path=None):
    return get_engine(db_path)

def save_snapshot_logs(db_path=None, timestamp=None, slices_data=None, strategy="static"):
    if db_path is None or db_path == "none" or db_path is False:
        return
    session = get_session(db_path)
    dt_str = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")
    logs = []
    try:
        for slice_key, metrics in slices_data.items():
            log = NetworkLog(
                timestamp=timestamp,
                datetime_str=dt_str,
                slice_name=slice_key,
                throughput_mbps=metrics.get("throughput_mbps", 0.0),
                packets_processed=metrics.get("packets_processed", 0),
                packets_dropped=metrics.get("packets_dropped", 0),
                avg_latency=metrics.get("avg_latency", 0.0),
                utilization=metrics.get("utilization", 0.0),
                allocated_bandwidth=metrics.get("allocated_bandwidth", 0.0),
                strategy=strategy
            )
            logs.append(log)
        session.add_all(logs)
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Error saving snapshot logs: {e}")
    finally:
        session.close()

def save_action_log(db_path=None, level="INFO", message=""):
    if db_path is None or db_path == "none" or db_path is False:
        return
    session = get_session(db_path)
    ts = time.time()
    dt_str = datetime.fromtimestamp(ts).strftime("%H:%M:%S")
    try:
        entry = ActionLog(
            timestamp=ts,
            datetime_str=dt_str,
            level=level,
            message=message
        )
        session.add(entry)
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Error saving action log: {e}")
    finally:
        session.close()

def get_recent_history(db_path=None, limit=60, slice_name=None):
    if db_path is None:
        db_path = DEFAULT_DB_PATH
    session = get_session(db_path)
    try:
        query = session.query(NetworkLog)
        if slice_name:
            query = query.filter(NetworkLog.slice_name == slice_name)
        records = query.order_by(desc(NetworkLog.id)).limit(limit).all()
        # Return in chronological order
        return [r.to_dict() for r in reversed(records)]
    except Exception as e:
        print(f"Error fetching history: {e}")
        return []
    finally:
        session.close()

def get_action_logs(db_path=None, limit=50):
    if db_path is None:
        db_path = DEFAULT_DB_PATH
    session = get_session(db_path)
    try:
        records = session.query(ActionLog).order_by(desc(ActionLog.id)).limit(limit).all()
        return [r.to_dict() for r in reversed(records)]
    except Exception as e:
        print(f"Error fetching action logs: {e}")
        return []
    finally:
        session.close()

def get_analytics_summary(db_path=None):
    if db_path is None:
        db_path = DEFAULT_DB_PATH
    session = get_session(db_path)
    try:
        logs = session.query(NetworkLog).all()
        if not logs:
            return {
                "total_records": 0,
                "total_packets_processed": 0,
                "total_packets_dropped": 0,
                "overall_drop_rate": 0.0,
                "qos_violations": 0,
                "slice_stats": {}
            }

        total_processed = sum(l.packets_processed for l in logs)
        total_dropped = sum(l.packets_dropped for l in logs)
        drop_rate = (total_dropped / (total_processed + total_dropped) * 100) if (total_processed + total_dropped) > 0 else 0.0

        # QoS violations: latency > 0.02s for low_latency or drops > 0 or utilization > 95%
        qos_violations = sum(1 for l in logs if l.packets_dropped > 0 or (l.slice_name == "low_latency" and l.avg_latency > 0.02) or l.utilization > 95)

        slice_stats = {}
        for slice_key in ["low_latency", "high_bandwidth", "general"]:
            s_logs = [l for l in logs if l.slice_name == slice_key]
            if s_logs:
                avg_throughput = sum(l.throughput_mbps for l in s_logs) / len(s_logs)
                avg_lat = (sum(l.avg_latency for l in s_logs) / len(s_logs)) * 1000
                peak_util = max(l.utilization for l in s_logs)
                drops = sum(l.packets_dropped for l in s_logs)
                slice_stats[slice_key] = {
                    "avg_throughput_mbps": round(avg_throughput, 2),
                    "avg_latency_ms": round(avg_lat, 2),
                    "peak_utilization": round(peak_util, 1),
                    "total_dropped": drops,
                    "sample_count": len(s_logs)
                }

        return {
            "total_records": len(logs),
            "total_packets_processed": total_processed,
            "total_packets_dropped": total_dropped,
            "overall_drop_rate": round(drop_rate, 2),
            "qos_violations": qos_violations,
            "slice_stats": slice_stats
        }
    except Exception as e:
        print(f"Error computing analytics summary: {e}")
        return {}
    finally:
        session.close()

def save_experiment_result(db_path=None, scenario_name="normal", total_bandwidth_mbps=100.0, duration_seconds=20, results_dict=None):
    import json
    if db_path is None:
        db_path = DEFAULT_DB_PATH
    session = get_session(db_path)
    ts = time.time()
    dt_str = datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")
    try:
        exp = ExperimentResult(
            timestamp=ts,
            datetime_str=dt_str,
            scenario_name=scenario_name,
            total_bandwidth_mbps=total_bandwidth_mbps,
            duration_seconds=duration_seconds,
            results_json=json.dumps(results_dict or {})
        )
        session.add(exp)
        session.commit()
        return exp.id
    except Exception as e:
        session.rollback()
        print(f"Error saving experiment result: {e}")
        return None
    finally:
        session.close()

def get_experiment_results(db_path=None, limit=20):
    if db_path is None:
        db_path = DEFAULT_DB_PATH
    session = get_session(db_path)
    try:
        records = session.query(ExperimentResult).order_by(desc(ExperimentResult.id)).limit(limit).all()
        return [r.to_dict() for r in records]
    except Exception as e:
        print(f"Error fetching experiment results: {e}")
        return []
    finally:
        session.close()

def load_profiles_db(db_path=None):
    """Loads all application QoS profiles from SQLite."""
    if db_path is None or db_path == "none" or db_path is False:
        db_path = DEFAULT_DB_PATH
    session = get_session(db_path)
    try:
        records = session.query(ApplicationProfileModel).all()
        return {r.id: r.to_dict() for r in records}
    except Exception as e:
        print(f"Error loading profiles from db: {e}")
        return {}
    finally:
        session.close()

def save_profile_db(db_path=None, profile_dict=None):
    """Saves or updates an application profile in SQLite."""
    if not profile_dict or not profile_dict.get("id"):
        return False
    if db_path is None or db_path == "none" or db_path is False:
        db_path = DEFAULT_DB_PATH
    session = get_session(db_path)
    try:
        p_id = profile_dict["id"]
        existing = session.query(ApplicationProfileModel).filter_by(id=p_id).first()
        if existing:
            for k, v in profile_dict.items():
                if k == "delay_sensitive":
                    setattr(existing, k, int(bool(v)))
                elif hasattr(existing, k):
                    setattr(existing, k, v)
        else:
            new_p = ApplicationProfileModel(
                id=p_id,
                name=profile_dict.get("name", p_id),
                category=profile_dict.get("category", "General"),
                preferred_slice=profile_dict.get("preferred_slice", "general"),
                priority=profile_dict.get("priority", 3),
                target_max_latency_ms=profile_dict.get("target_max_latency_ms", 50.0),
                target_max_jitter_ms=profile_dict.get("target_max_jitter_ms", 10.0),
                target_max_loss_rate=profile_dict.get("target_max_loss_rate", 0.01),
                min_throughput_mbps=profile_dict.get("min_throughput_mbps", 5.0),
                target_throughput_mbps=profile_dict.get("target_throughput_mbps", 15.0),
                delay_sensitive=int(bool(profile_dict.get("delay_sensitive", False))),
                burst_intensity=profile_dict.get("burst_intensity", 1.2),
                description=profile_dict.get("description", "")
            )
            session.add(new_p)
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        print(f"Error saving profile {profile_dict.get('id')}: {e}")
        return False
    finally:
        session.close()

def init_default_profiles_db(db_path=None, default_profiles_dict=None):
    """Seeds default application profiles if table is empty."""
    if not default_profiles_dict:
        return
    existing = load_profiles_db(db_path)
    if not existing:
        for p_id, p_data in default_profiles_dict.items():
            save_profile_db(db_path, p_data)

