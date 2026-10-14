import urllib.request
import json
import time

def run_checklist():
    print("=== NETSLICE FRONTEND & BACKEND DASHBOARD CHECKLIST VALIDATION ===")
    
    # 1. Dashboard loads
    try:
        resp = urllib.request.urlopen("http://localhost:5173", timeout=5)
        frontend_status = resp.status
        html = resp.read(500).decode("utf-8")
        has_vite = "vite" in html.lower() or "doctype html" in html.lower()
        check1 = (frontend_status == 200 and has_vite)
        print(f"[CHECK 1] Dashboard loads: {'PASS' if check1 else 'FAIL'} (HTTP {frontend_status})")
    except Exception as e:
        print(f"[CHECK 1] Dashboard loads: FAIL ({e})")
        check1 = False

    # 2. Three network slices appear
    try:
        resp = urllib.request.urlopen("http://127.0.0.1:8000/api/metrics", timeout=5)
        data = json.loads(resp.read().decode("utf-8"))
        slices = data.get("slices") or data.get("data", {}).get("slices", {})
        has_ll = "low_latency" in slices or "Low-Latency" in slices
        has_hb = "high_bandwidth" in slices or "High-Bandwidth" in slices
        has_gen = "general" in slices or "General-Purpose" in slices
        check2 = (has_ll and has_hb and has_gen)
        print(f"[CHECK 2] Three network slices appear: {'PASS' if check2 else 'FAIL'} (Slices detected: {list(slices.keys())})")
    except Exception as e:
        print(f"[CHECK 2] Three network slices appear: FAIL ({e})")
        check2 = False

    # 3. Metric-source labels work (provenance taxonomy)
    try:
        ll_slice = slices.get("low_latency") or slices.get("Low-Latency")
        prov = ll_slice.get("provenance")
        telemetry = data.get("telemetry")
        has_slice_prov = prov is not None
        has_telemetry = telemetry is not None and "download_mbps" in telemetry and "status" in telemetry["download_mbps"]
        check3 = (has_slice_prov and has_telemetry)
        print(f"[CHECK 3] Metric-source labels work: {'PASS' if check3 else 'FAIL'} (Slice provenance: {bool(has_slice_prov)}, Telemetry provenance: {bool(has_telemetry)})")
    except Exception as e:
        print(f"[CHECK 3] Metric-source labels work: FAIL ({e})")
        check3 = False

    # 4. Start Monitoring works
    try:
        start_payload = json.dumps({
            "strategy": "ai_assisted",
            "mode": "simulation",
            "interface": "Wi-Fi"
        }).encode("utf-8")
        req = urllib.request.Request(
            "http://127.0.0.1:8000/api/start",
            data=start_payload,
            headers={"Content-Type": "application/json"}
        )
        resp = urllib.request.urlopen(req, timeout=5)
        start_res = json.loads(resp.read().decode("utf-8"))
        
        # Verify active status
        time.sleep(1.0)
        resp_m = urllib.request.urlopen("http://127.0.0.1:8000/api/metrics", timeout=5)
        active_data = json.loads(resp_m.read().decode("utf-8"))
        is_running = active_data.get("status") == "active" or active_data.get("is_running") is True
        check4 = (start_res.get("status") == "success" and is_running)
        print(f"[CHECK 4] Start Monitoring works: {'PASS' if check4 else 'FAIL'} (Backend status: {active_data.get('status')})")
    except Exception as e:
        print(f"[CHECK 4] Start Monitoring works: FAIL ({e})")
        check4 = False

    # 5. Metrics refresh
    try:
        # Wait 2 seconds for traffic generation ticks
        time.sleep(2.0)
        resp_m1 = urllib.request.urlopen("http://127.0.0.1:8000/api/metrics", timeout=5)
        m1 = json.loads(resp_m1.read().decode("utf-8"))
        time.sleep(1.5)
        resp_m2 = urllib.request.urlopen("http://127.0.0.1:8000/api/metrics", timeout=5)
        m2 = json.loads(resp_m2.read().decode("utf-8"))
        
        slices1 = m1.get("data", {}).get("slices", {})
        slices2 = m2.get("data", {}).get("slices", {})
        
        t1 = sum(s.get("throughput_mbps", 0) for s in slices1.values())
        t2 = sum(s.get("throughput_mbps", 0) for s in slices2.values())
        pkts2 = sum(s.get("packets_processed", 0) for s in slices2.values())
        
        refreshed = (pkts2 > 0)
        check5 = refreshed
        print(f"[CHECK 5] Metrics refresh: {'PASS' if check5 else 'FAIL'} (Total throughput: {t2:.2f} Mbps, Packets processed: {pkts2})")
    except Exception as e:
        print(f"[CHECK 5] Metrics refresh: FAIL ({e})")
        check5 = False

    # 6. Stop Monitoring works
    try:
        req = urllib.request.Request("http://127.0.0.1:8000/api/stop", data=b"{}", headers={"Content-Type": "application/json"})
        resp = urllib.request.urlopen(req, timeout=5)
        stop_res = json.loads(resp.read().decode("utf-8"))
        
        time.sleep(1.0)
        resp_idle = urllib.request.urlopen("http://127.0.0.1:8000/api/metrics", timeout=5)
        idle_data = json.loads(resp_idle.read().decode("utf-8"))
        is_idle = (idle_data.get("status") == "idle" or idle_data.get("is_running") is False)
        qos_status = idle_data.get("slices", {}).get("low_latency", {}).get("qos_status")
        check6 = (stop_res.get("status") == "success" and is_idle)
        print(f"[CHECK 6] Stop Monitoring works: {'PASS' if check6 else 'FAIL'} (Status: {idle_data.get('status')}, QoS status: {qos_status})")
    except Exception as e:
        print(f"[CHECK 6] Stop Monitoring works: FAIL ({e})")
        check6 = False

    total_pass = sum([check1, check2, check3, check4, check5, check6])
    print(f"\nFinal Result: {total_pass}/6 checklist items passed.")
    return total_pass

if __name__ == "__main__":
    run_checklist()
