import os
import json
import urllib.request
import urllib.error
from database import get_recent_history, get_analytics_summary

def query_llm_api(system_prompt: str, user_message: str):
    """
    Attempts to call Gemini or OpenAI if API keys are set in environment.
    Falls back gracefully if not configured or on network error.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": f"{system_prompt}\n\nUser Question: {user_message}"}]
                    }
                ]
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            print("Gemini API call skipped or error:", e)

    if openai_key:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                "temperature": 0.4
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {openai_key}"
                }
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            print("OpenAI API call skipped or error:", e)

    return None

def analyze_network_state(current_snapshot, strategy, simulation_state):
    """
    Synthesizes current telemetry, SLA status, and recent database trends.
    """
    if not current_snapshot or "slices" not in current_snapshot:
        return {
            "status": "idle",
            "summary": "Simulation is currently stopped. No live telemetry available."
        }

    slices = current_snapshot["slices"]
    insights = []
    recommendations = []
    has_drops = False
    has_congestion = False

    for name, s in slices.items():
        slice_display = name.replace("_", " ").title()
        util = s.get("utilization", 0.0)
        drops = s.get("packets_dropped", 0)
        lat_ms = s.get("avg_latency_ms", s.get("avg_latency", 0.0) * 1000)
        cap = s.get("allocated_bandwidth", 0.0)
        tp = s.get("throughput_mbps", 0.0)

        if drops > 0:
            has_drops = True
            insights.append(f"⚠️ **{slice_display}** has dropped **{drops} packets**! Throughput ({tp:.1f} Mbps) exceeded allocated capacity ({cap:.1f} Mbps).")
            recommendations.append(f"Increase {slice_display} bandwidth by at least +{max(5, int(tp - cap + 5))} Mbps or switch to **AI-Assisted Dynamic** allocation.")
        elif util > 88:
            has_congestion = True
            insights.append(f"⚡ **{slice_display}** is under heavy load (**{util:.1f}% utilization**, {tp:.1f}/{cap:.1f} Mbps).")
            recommendations.append(f"Consider allocating an additional 5-10 Mbps to {slice_display} before packet loss occurs.")

        # Latency checks for URLLC Low-Latency slice
        if name == "low_latency" and lat_ms > 15:
            insights.append(f"⏱️ **Low-Latency (URLLC) SLA Warning:** Latency is currently **{lat_ms:.2f} ms** (Target: <15 ms).")
            recommendations.append("Prioritize Low-Latency slice resources immediately to maintain sub-15ms critical SLA.")

    return {
        "status": "active",
        "strategy": strategy,
        "insights": insights,
        "recommendations": recommendations,
        "has_drops": has_drops,
        "has_congestion": has_congestion,
        "slices": slices
    }

def generate_ai_response(user_message: str, simulation_state, db_path="network_logs.db") -> str:
    monitor = simulation_state.get("monitor")
    strategy = simulation_state.get("strategy", "static")
    latest_snapshot = None
    if monitor and monitor.metrics_history:
        latest_snapshot = monitor.metrics_history[-1]

    analysis = analyze_network_state(latest_snapshot, strategy, simulation_state)
    recent_history = get_recent_history(db_path, limit=15)
    summary_stats = get_analytics_summary(db_path)

    # Build system context for LLM or local reasoning engine
    system_context = f"""
You are the NetSlice AI Assistant, an expert network controller specialized in 5G/6G Network Slicing and QoS Optimization.
Total Shared Bandwidth Pool: 100 Mbps.
Slices:
1. Low-Latency (URLLC, Ultra-Reliable Low Latency, target <15ms)
2. High-Bandwidth (eMBB, Enhanced Mobile Broadband, video/data)
3. General-Purpose (mMTC / Best-Effort IoT)

Current System State:
- Simulation Running: {simulation_state.get('is_running', False)}
- Current Strategy: {strategy}
- Active Analysis: {json.dumps(analysis, indent=2)}
- Total Historical Snapshots in SQLite: {summary_stats.get('total_records', 0)}
- Historical QoS Violations: {summary_stats.get('qos_violations', 0)}
- Overall Packet Drop Rate: {summary_stats.get('overall_drop_rate', 0)}%
"""

    # Check if external LLM configured
    llm_output = query_llm_api(system_context, user_message)
    if llm_output:
        return llm_output

    # Intelligent contextual local reasoning engine
    msg = user_message.strip().lower()

    if not simulation_state.get("is_running", False):
        return (
            "👋 **NetSlice AI Controller here!**\n\n"
            "The network simulation is currently **idle/stopped**. "
            "Click **Start Simulation** on the top panel to begin traffic generation and monitor real-time QoS metrics.\n\n"
            f"💡 **Database Note:** SQLite has **{summary_stats.get('total_records', 0)} stored analytics records** from previous runs ready for ML retraining."
        )

    # Specific query matching
    if any(k in msg for k in ["why", "drop", "packet loss", "loss", "discard"]):
        if analysis["has_drops"]:
            lines = ["🚨 **Packet Drop Root Cause Analysis:**"]
            for ins in analysis["insights"]:
                if "dropped" in ins:
                    lines.append(f"- {ins}")
            lines.append("\n**Actionable Fix:**")
            if strategy == "static":
                lines.append("1. **Switch to AI-Assisted Dynamic:** The AI engine will proactively predict spikes and transfer bandwidth to prevent buffer overflow.")
                lines.append("2. **Adjust Manual Static Sliders:** Drag the allocation slider up to provide more headroom for the congested slice.")
            else:
                lines.append("The allocation engine is actively compensating. You can also trigger an **ML Retrain** so the Decision Tree models learn this burst pattern.")
            return "\n".join(lines)
        else:
            return (
                "✅ **Zero Packet Drops Detected!**\n\n"
                "All slices are currently operating within their allocated capacities with 0 dropped packets. "
                "Packet drops occur when slice throughput exceeds its assigned bandwidth cap (queue overflow). "
                "To test resilience, try triggering a **Simulated Traffic Spike** (e.g., DoS Attack or 4K Burst) from the Tweaker panel!"
            )

    if any(k in msg for k in ["latency", "spike", "delay", "ping", "urllc"]):
        ll_data = analysis["slices"].get("low_latency", {})
        lat = ll_data.get("avg_latency_ms", 0.0)
        return (
            f"⏱️ **Real-Time Latency Analysis:**\n\n"
            f"- **Low-Latency Slice:** `{lat:.2f} ms` (SLA Target: `< 15.0 ms`)\n"
            f"- **High-Bandwidth Slice:** `{analysis['slices'].get('high_bandwidth', {}).get('avg_latency_ms', 0.0):.2f} ms`\n"
            f"- **General Slice:** `{analysis['slices'].get('general', {}).get('avg_latency_ms', 0.0):.2f} ms`\n\n"
            + ("⚠️ *URLLC latency is elevated due to near-capacity queuing delay. Allocating more bandwidth reduces queue build-up immediately.*" if lat > 15 else "🟢 *URLLC latency is within strict ultra-reliable QoS parameters.*")
        )

    if any(k in msg for k in ["allocate", "fix", "slider", "capacity", "recommend", "how do i"]):
        lines = ["🎯 **AI Resource Allocation Recommendations:**\n"]
        for rec in analysis["recommendations"]:
            lines.append(f"- {rec}")
        if not analysis["recommendations"]:
            lines.append("- Current allocations are balanced across all slices. No adjustments required.")
        lines.append(f"\n**Current Strategy:** `{strategy.upper()}`")
        if strategy == "static":
            lines.append("Tip: Use the **Interactive Configuration Sliders** to adjust the 100 Mbps pool manually, or switch to **AI-Assisted** for automated proactive reallocation.")
        return "\n".join(lines)

    if any(k in msg for k in ["retrain", "ml", "model", "decision tree", "train"]):
        ml = simulation_state.get("ml_engine")
        status = ml.training_info if ml else {}
        return (
            f"🧠 **Machine Learning Status:**\n\n"
            f"- **Engine Status:** `{status.get('status', 'Initialized')}`\n"
            f"- **Samples Trained:** `{status.get('sample_count', 0)}`\n"
            f"- **Stored DB Snapshots:** `{summary_stats.get('total_records', 0)}` records available in SQLite\n\n"
            "Click the **Retrain AI Model** button in the dashboard header to update the Decision Tree regressors using the latest traffic history!"
        )

    if any(k in msg for k in ["status", "health", "overview", "summary", "report"]):
        ll_u = analysis["slices"].get("low_latency", {}).get("utilization", 0.0)
        hb_u = analysis["slices"].get("high_bandwidth", {}).get("utilization", 0.0)
        gen_u = analysis["slices"].get("general", {}).get("utilization", 0.0)
        return (
            f"📊 **Network Health Summary:**\n\n"
            f"- **Active Strategy:** `{strategy.upper()}`\n"
            f"- **Low-Latency Utilization:** `{ll_u:.1f}%` ({analysis['slices'].get('low_latency',{}).get('throughput_mbps',0):.1f}/{analysis['slices'].get('low_latency',{}).get('allocated_bandwidth',0)} Mbps)\n"
            f"- **High-Bandwidth Utilization:** `{hb_u:.1f}%` ({analysis['slices'].get('high_bandwidth',{}).get('throughput_mbps',0):.1f}/{analysis['slices'].get('high_bandwidth',{}).get('allocated_bandwidth',0)} Mbps)\n"
            f"- **General Purpose Utilization:** `{gen_u:.1f}%` ({analysis['slices'].get('general',{}).get('throughput_mbps',0):.1f}/{analysis['slices'].get('general',{}).get('allocated_bandwidth',0)} Mbps)\n"
            f"- **SQLite Log Entries:** `{summary_stats.get('total_records', 0)}` logged\n"
            f"- **Total Historical QoS Violations:** `{summary_stats.get('qos_violations', 0)}`\n\n"
            + ("⚠️ *SLA alerts are present. Check recommendations.*" if analysis["has_drops"] or analysis["has_congestion"] else "🟢 *Network health is nominal. All QoS guarantees are satisfied.*")
        )

    # General fallback contextual answer
    return (
        f"🤖 **NetSlice AI Assistant Response:**\n\n"
        f"I analyzed the live telemetry and SQLite database logs under **{strategy.upper()}** mode:\n"
        f"- **Low-Latency Slice:** {analysis['slices'].get('low_latency',{}).get('throughput_mbps',0):.1f} Mbps | {analysis['slices'].get('low_latency',{}).get('utilization',0):.1f}% util | {analysis['slices'].get('low_latency',{}).get('packets_dropped',0)} drops\n"
        f"- **High-Bandwidth Slice:** {analysis['slices'].get('high_bandwidth',{}).get('throughput_mbps',0):.1f} Mbps | {analysis['slices'].get('high_bandwidth',{}).get('utilization',0):.1f}% util | {analysis['slices'].get('high_bandwidth',{}).get('packets_dropped',0)} drops\n"
        f"- **General Slice:** {analysis['slices'].get('general',{}).get('throughput_mbps',0):.1f} Mbps | {analysis['slices'].get('general',{}).get('utilization',0):.1f}% util | {analysis['slices'].get('general',{}).get('packets_dropped',0)} drops\n\n"
        f"Ask me questions like:\n"
        f"- *'Why are packets dropping?'*\n"
        f"- *'How do I fix the bandwidth limit?'*\n"
        f"- *'Analyze current latency status'* \n"
        f"- *'How can I retrain the ML model?'*"
    )
