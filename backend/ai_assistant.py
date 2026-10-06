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
    mode = simulation_state.get("mode", "simulation")
    strategy = simulation_state.get("strategy", "static")
    active_iface = simulation_state.get("active_interface", "Wi-Fi")
    
    if mode == "real_network" and simulation_state.get("real_net_mgr"):
        hist = simulation_state["real_net_mgr"].metrics_history
        latest_snapshot = hist[-1] if hist else None
    else:
        monitor = simulation_state.get("monitor")
        latest_snapshot = monitor.metrics_history[-1] if (monitor and monitor.metrics_history) else None

    analysis = analyze_network_state(latest_snapshot, strategy, simulation_state)
    recent_history = get_recent_history(db_path, limit=15)
    summary_stats = get_analytics_summary(db_path)

    # Build system context for LLM or local reasoning engine
    system_context = f"""
You are the NetSlice AI Assistant, an expert network controller specialized in 5G/6G Network Slicing and QoS Optimization.
Operating Mode: {mode.upper()} (Physical Adapter: {active_iface})
Total Shared Bandwidth Pool: 100 Mbps.
Slices:
1. Low-Latency (URLLC, Port 9101, target <15ms)
2. High-Bandwidth (eMBB, Port 9102, video/data)
3. General-Purpose (mMTC / Best-Effort IoT, Port 9103)

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
            "Hi! Network monitoring is currently **paused**.\n\n"
            f"Click **Start Monitoring** above to view live traffic metrics. "
            f"Your database currently holds **{summary_stats.get('total_records', 0)} snapshots** of previous traffic runs."
        )

    # Specific query matching
    if any(k in msg for k in ["why", "drop", "packet loss", "loss", "discard"]):
        if analysis["has_drops"]:
            lines = ["Here's what is causing the dropped packets:\n"]
            for ins in analysis["insights"]:
                if "dropped" in ins:
                    lines.append(f"- {ins}")
            lines.append("\n**Suggested Solution:**")
            if strategy == "static":
                lines.append("1. **Switch to AI Auto-Balance:** The system will dynamically shift extra bandwidth from idle slices to protect this stream.")
                lines.append("2. **Raise the manual cap:** Move the slider up for the congested slice by 10-15 Mbps to give it more buffer space.")
            else:
                lines.append("The dynamic balancer is actively shifting bandwidth to absorb this load. Retraining the model will help it anticipate this specific surge pattern sooner.")
            return "\n".join(lines)
        else:
            return (
                "**Zero packet loss detected.**\n\n"
                "All slices are currently transmitting within their allocated limits with 0 dropped packets. "
                "Packet loss typically happens when a burst exceeds the assigned slice limit. "
                "You can test how the balancer handles this by triggering a load surge from the testing panel below."
            )

    if any(k in msg for k in ["latency", "spike", "delay", "ping", "wifi", "magic", "urllc"]):
        ll_data = analysis["slices"].get("low_latency", {})
        lat = ll_data.get("avg_latency_ms", 0.0)
        wifi_tag = f" on your **{active_iface}** connection" if mode == "real_network" else ""
        return (
            f"**Latency Report{wifi_tag}:**\n\n"
            f"- **Calls & Gaming (Low-Latency):** `{lat:.1f} ms` (target: < 15 ms)\n"
            f"- **Streaming & Video:** `{analysis['slices'].get('high_bandwidth', {}).get('avg_latency_ms', 0.0):.1f} ms`\n"
            f"- **Standard Web:** `{analysis['slices'].get('general', {}).get('avg_latency_ms', 0.0):.1f} ms`\n\n"
            + ("Latency is slightly elevated due to near-capacity queuing. Allocating an extra 5 Mbps will smooth it out." if lat > 15 else "Your latency is well within optimal targets for smooth gaming and clear voice calls.")
        )

    if any(k in msg for k in ["allocate", "fix", "slider", "capacity", "recommend", "how do i", "split"]):
        lines = ["**Bandwidth Recommendations:**\n"]
        for rec in analysis["recommendations"]:
            lines.append(f"- {rec}")
        if not analysis["recommendations"]:
            lines.append("- Your current bandwidth distribution is balanced nicely across all slices. No adjustments needed.")
        lines.append(f"\n*Active policy: {strategy.replace('_', ' ').title()}*")
        return "\n".join(lines)

    if any(k in msg for k in ["retrain", "ml", "model", "decision tree", "train"]):
        ml = simulation_state.get("ml_engine")
        status = ml.training_info if ml else {}
        return (
            f"**Allocation Model Status:**\n\n"
            f"- **Status:** `{status.get('status', 'Ready')}`\n"
            f"- **Trained Snapshots:** `{status.get('sample_count', 0)}` records\n"
            f"- **Total Database History:** `{summary_stats.get('total_records', 0)}` snapshots stored in SQLite\n\n"
            "You can click **Retrain Model** in the top header whenever you want the decision tree to learn from recent traffic patterns."
        )

    if any(k in msg for k in ["status", "health", "overview", "summary", "report", "how is"]):
        ll_u = analysis["slices"].get("low_latency", {}).get("utilization", 0.0)
        hb_u = analysis["slices"].get("high_bandwidth", {}).get("utilization", 0.0)
        gen_u = analysis["slices"].get("general", {}).get("utilization", 0.0)
        wifi_tag = f" on **{active_iface}**" if mode == "real_network" else ""
        return (
            f"**Network Overview{wifi_tag}:**\n\n"
            f"- **Calls & Gaming:** `{ll_u:.0f}%` load ({analysis['slices'].get('low_latency',{}).get('throughput_mbps',0):.1f} / {analysis['slices'].get('low_latency',{}).get('allocated_bandwidth',0)} Mbps)\n"
            f"- **Streaming & Video:** `{hb_u:.0f}%` load ({analysis['slices'].get('high_bandwidth',{}).get('throughput_mbps',0):.1f} / {analysis['slices'].get('high_bandwidth',{}).get('allocated_bandwidth',0)} Mbps)\n"
            f"- **General Web:** `{gen_u:.0f}%` load ({analysis['slices'].get('general',{}).get('throughput_mbps',0):.1f} / {analysis['slices'].get('general',{}).get('allocated_bandwidth',0)} Mbps)\n\n"
            + ("Some slices are experiencing high traffic. Check the recommendations tab." if analysis["has_drops"] or analysis["has_congestion"] else "Everything is operating cleanly within normal performance targets.")
        )

    # General friendly fallback
    return (
        f"**Live Network Summary:**\n\n"
        f"- **Calls & Gaming:** {analysis['slices'].get('low_latency',{}).get('throughput_mbps',0):.1f} Mbps ({analysis['slices'].get('low_latency',{}).get('utilization',0):.0f}% capacity)\n"
        f"- **Streaming & Downloads:** {analysis['slices'].get('high_bandwidth',{}).get('throughput_mbps',0):.1f} Mbps ({analysis['slices'].get('high_bandwidth',{}).get('utilization',0):.0f}% capacity)\n"
        f"- **Standard Web:** {analysis['slices'].get('general',{}).get('throughput_mbps',0):.1f} Mbps ({analysis['slices'].get('general',{}).get('utilization',0):.0f}% capacity)\n\n"
        f"You can ask me:\n"
        f"- *'How is my Wi-Fi performing?'*\n"
        f"- *'Why are packets dropping?'*\n"
        f"- *'What is the best bandwidth split for streaming?'*\n"
        f"- *'How do I test a traffic spike?'*"
    )
