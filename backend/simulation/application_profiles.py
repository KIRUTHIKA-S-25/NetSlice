"""
Application Profiles Module for QoS-Aware Network Slicing.
Defines 8 realistic application profiles with strict/configurable QoS parameters:
1. Online Gaming
2. Video Calling
3. Video Streaming
4. Short-Form Video & Reels
5. Large File Downloads
6. Messaging
7. Web Browsing
8. Background Transfers
"""

from typing import Dict, Any, Optional

DEFAULT_APPLICATION_PROFILES: Dict[str, Dict[str, Any]] = {
    "online_gaming": {
        "id": "online_gaming",
        "name": "Online Gaming",
        "category": "Interactive Real-Time",
        "preferred_slice": "low_latency",
        "priority": 1,
        "target_max_latency_ms": 25.0,
        "target_max_jitter_ms": 5.0,
        "target_max_loss_rate": 0.005,  # 0.5%
        "min_throughput_mbps": 5.0,
        "target_throughput_mbps": 12.0,
        "delay_sensitive": True,
        "burst_intensity": 1.4,
        "description": "Ultra-low latency, low jitter interactive multi-player network stream."
    },
    "video_calling": {
        "id": "video_calling",
        "name": "Video Calling (VoIP/Conf)",
        "category": "Interactive Media",
        "preferred_slice": "low_latency",
        "priority": 2,
        "target_max_latency_ms": 40.0,
        "target_max_jitter_ms": 10.0,
        "target_max_loss_rate": 0.010,  # 1.0%
        "min_throughput_mbps": 8.0,
        "target_throughput_mbps": 15.0,
        "delay_sensitive": True,
        "burst_intensity": 1.2,
        "description": "Bidirectional real-time video audio stream requiring tight latency bounds."
    },
    "video_streaming": {
        "id": "video_streaming",
        "name": "4K/8K Video Streaming",
        "category": "High-Throughput Streaming",
        "preferred_slice": "high_bandwidth",
        "priority": 3,
        "target_max_latency_ms": 100.0,
        "target_max_jitter_ms": 30.0,
        "target_max_loss_rate": 0.020,  # 2.0%
        "min_throughput_mbps": 25.0,
        "target_throughput_mbps": 60.0,
        "delay_sensitive": False,
        "burst_intensity": 1.6,
        "description": "Buffer-tolerant, sustained high-bitrate video delivery."
    },
    "reels_short_video": {
        "id": "reels_short_video",
        "name": "Short-Form Video & Reels",
        "category": "Burst Streaming",
        "preferred_slice": "high_bandwidth",
        "priority": 3,
        "target_max_latency_ms": 80.0,
        "target_max_jitter_ms": 20.0,
        "target_max_loss_rate": 0.020,
        "min_throughput_mbps": 15.0,
        "target_throughput_mbps": 35.0,
        "delay_sensitive": False,
        "burst_intensity": 1.8,
        "description": "Bursty clip pre-buffering with quick start requirements."
    },
    "large_downloads": {
        "id": "large_downloads",
        "name": "Large File Downloads / Updates",
        "category": "Bulk Transfer",
        "preferred_slice": "high_bandwidth",
        "priority": 5,
        "target_max_latency_ms": 300.0,
        "target_max_jitter_ms": 100.0,
        "target_max_loss_rate": 0.050,  # 5.0%
        "min_throughput_mbps": 30.0,
        "target_throughput_mbps": 80.0,
        "delay_sensitive": False,
        "burst_intensity": 1.1,
        "description": "Elastic throughput bulk transport tolerant to latency and jitter."
    },
    "messaging": {
        "id": "messaging",
        "name": "Instant Messaging & IoT Telemetry",
        "category": "Low-Throughput / Telemetry",
        "preferred_slice": "general",
        "priority": 4,
        "target_max_latency_ms": 150.0,
        "target_max_jitter_ms": 50.0,
        "target_max_loss_rate": 0.050,
        "min_throughput_mbps": 1.0,
        "target_throughput_mbps": 4.0,
        "delay_sensitive": False,
        "burst_intensity": 1.3,
        "description": "Low-volume episodic text, presence pings, and sensor telemetry."
    },
    "web_browsing": {
        "id": "web_browsing",
        "name": "Web Browsing & Search",
        "category": "Transactional Web",
        "preferred_slice": "general",
        "priority": 4,
        "target_max_latency_ms": 120.0,
        "target_max_jitter_ms": 40.0,
        "target_max_loss_rate": 0.030,
        "min_throughput_mbps": 5.0,
        "target_throughput_mbps": 15.0,
        "delay_sensitive": False,
        "burst_intensity": 1.5,
        "description": "Short burst HTTP/3 transactions, page assets, and search queries."
    },
    "background_transfers": {
        "id": "background_transfers",
        "name": "Background Cloud Sync & Backup",
        "category": "Delay-Tolerant Background",
        "preferred_slice": "general",
        "priority": 6,
        "target_max_latency_ms": 500.0,
        "target_max_jitter_ms": 200.0,
        "target_max_loss_rate": 0.100,  # 10.0%
        "min_throughput_mbps": 2.0,
        "target_throughput_mbps": 10.0,
        "delay_sensitive": False,
        "burst_intensity": 1.0,
        "description": "Scavenger class delay-tolerant synchronization consuming spare capacity."
    }
}

class ApplicationProfileRegistry:
    def __init__(self, db_path: str = "network_logs.db"):
        self.db_path = db_path
        self.listeners = []
        self.profiles = {k: dict(v) for k, v in DEFAULT_APPLICATION_PROFILES.items()}
        self._load_from_db()

    def _load_from_db(self):
        try:
            from database import load_profiles_db, init_default_profiles_db
            init_default_profiles_db(self.db_path, DEFAULT_APPLICATION_PROFILES)
            loaded = load_profiles_db(self.db_path)
            if loaded:
                for k, v in loaded.items():
                    if k in self.profiles:
                        self.profiles[k].update(v)
        except Exception as e:
            pass

    def add_listener(self, callback):
        """Adds a callback to be notified when profile parameters change."""
        if callback not in self.listeners:
            self.listeners.append(callback)

    def get_all(self) -> Dict[str, Dict[str, Any]]:
        return self.profiles

    def get_profile(self, profile_id: str) -> Optional[Dict[str, Any]]:
        return self.profiles.get(profile_id)

    def update_profile(self, profile_id: str, updates: Dict[str, Any]) -> bool:
        if profile_id not in self.profiles:
            return False
        
        allowed_keys = {
            "preferred_slice", "priority", "target_max_latency_ms",
            "target_max_jitter_ms", "target_max_loss_rate",
            "min_throughput_mbps", "target_throughput_mbps",
            "delay_sensitive", "burst_intensity"
        }
        for k, v in updates.items():
            if k in allowed_keys and v is not None:
                self.profiles[profile_id][k] = v

        # Persist to SQLite
        try:
            from database import save_profile_db
            save_profile_db(self.db_path, self.profiles[profile_id])
        except Exception:
            pass

        # Notify listeners (e.g. ResourceAllocationEngine)
        for cb in self.listeners:
            try:
                cb(profile_id, self.profiles[profile_id])
            except Exception:
                pass

        return True

    def reset_defaults(self):
        self.profiles = {k: dict(v) for k, v in DEFAULT_APPLICATION_PROFILES.items()}
        try:
            from database import save_profile_db
            for p in self.profiles.values():
                save_profile_db(self.db_path, p)
        except Exception:
            pass
        for cb in self.listeners:
            try:
                cb(None, None)
            except Exception:
                pass

    def get_profiles_for_slice(self, slice_name: str):
        return [p for p in self.profiles.values() if p["preferred_slice"] == slice_name]

# Global singleton
profile_registry = ApplicationProfileRegistry()
