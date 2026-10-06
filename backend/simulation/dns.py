from typing import Dict, Optional

class DNSServer:
    def __init__(self):
        self.records: Dict[str, dict] = {
            "urllc.slice.5g": {"type": "A_SRV", "ip": "127.0.0.1", "port": 9101, "slice": "Low-Latency", "ttl": 3600},
            "embb.slice.5g":  {"type": "A_SRV", "ip": "127.0.0.1", "port": 9102, "slice": "High-Bandwidth", "ttl": 3600},
            "mmtc.slice.5g":  {"type": "A_SRV", "ip": "127.0.0.1", "port": 9103, "slice": "General-Purpose", "ttl": 3600},
            "orchestrator.5g":{"type": "A",     "ip": "127.0.0.1", "port": 8000, "slice": "Control-Plane", "ttl": 86400}
        }
        self.query_log = []

    def resolve(self, domain: str) -> dict:
        clean_domain = domain.lower().strip()
        result = {"query": domain}
        
        if clean_domain in self.records:
            record = self.records[clean_domain]
            result.update({
                "status": "SUCCESS",
                "resolved_ip": record["ip"],
                "resolved_port": record["port"],
                "record_type": record["type"],
                "slice": record.get("slice", "Unknown")
            })
        else:
            result.update({
                "status": "NXDOMAIN",
                "error": f"Domain name '{domain}' not found in 5G Slice DNS directory."
            })
            
        self.query_log.append(result)
        if len(self.query_log) > 50:
            self.query_log.pop(0)
            
        return result

    def add_record(self, domain: str, ip: str, port: int, slice_name: str, record_type: str = "A_SRV"):
        clean_domain = domain.lower().strip()
        self.records[clean_domain] = {
            "type": record_type,
            "ip": ip,
            "port": port,
            "slice": slice_name,
            "ttl": 3600
        }
        return {"status": "ADDED", "domain": clean_domain, "ip": ip, "port": port}

    def get_records(self) -> Dict[str, dict]:
        return self.records

    def get_query_history(self) -> list:
        return self.query_log

# Global DNS server instance
dns_server = DNSServer()
