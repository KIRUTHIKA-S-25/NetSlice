import time
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, Float, String, Text, desc
from sqlalchemy.orm import declarative_base, sessionmaker

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

_engine = None
_SessionFactory = None

def get_engine(db_path="network_logs.db"):
    global _engine, _SessionFactory
    if _engine is None:
        _engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        Base.metadata.create_all(_engine)
        _SessionFactory = sessionmaker(bind=_engine)
    return _engine

def get_session(db_path="network_logs.db"):
    get_engine(db_path)
    return _SessionFactory()

def init_db(db_path="network_logs.db"):
    return get_engine(db_path)

def save_snapshot_logs(db_path, timestamp, slices_data, strategy="static"):
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

def save_action_log(db_path, level, message):
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

def get_recent_history(db_path="network_logs.db", limit=60, slice_name=None):
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

def get_action_logs(db_path="network_logs.db", limit=50):
    session = get_session(db_path)
    try:
        records = session.query(ActionLog).order_by(desc(ActionLog.id)).limit(limit).all()
        return [r.to_dict() for r in reversed(records)]
    except Exception as e:
        print(f"Error fetching action logs: {e}")
        return []
    finally:
        session.close()

def get_analytics_summary(db_path="network_logs.db"):
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
