import time
from typing import Dict, Set, List

class MulticastManager:
    def __init__(self, group_ip: str = "224.0.0.100", port: int = 9999):
        self.group_ip = group_ip
        self.port = port
        self.subscribers: Set[str] = {"slice_node_1", "slice_node_2", "orchestrator_node"}
        self.message_history: List[dict] = []

    def join_group(self, client_id: str) -> dict:
        self.subscribers.add(client_id)
        return {
            "status": "JOINED",
            "client_id": client_id,
            "group_ip": self.group_ip,
            "total_subscribers": len(self.subscribers)
        }

    def leave_group(self, client_id: str) -> dict:
        self.subscribers.discard(client_id)
        return {
            "status": "LEFT",
            "client_id": client_id,
            "group_ip": self.group_ip,
            "total_subscribers": len(self.subscribers)
        }

    def broadcast_signal(self, sender: str, event_type: str, message: str) -> dict:
        msg = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "sender": sender,
            "group_ip": self.group_ip,
            "event_type": event_type,
            "message": message,
            "delivered_to_count": len(self.subscribers),
            "subscribers": list(self.subscribers)
        }
        self.message_history.append(msg)
        if len(self.message_history) > 50:
            self.message_history.pop(0)
        return msg

    def get_status(self) -> dict:
        return {
            "group_ip": self.group_ip,
            "port": self.port,
            "subscribers": list(self.subscribers),
            "total_subscribers": len(self.subscribers),
            "recent_messages": self.message_history[-10:]
        }

# Global Multicast manager instance
multicast_mgr = MulticastManager()
