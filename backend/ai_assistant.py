import os
import json
import urllib.request
import urllib.error
from dotenv import load_dotenv
from database import get_recent_history, get_analytics_summary

load_dotenv()

def query_llm_api(system_prompt: str, user_message: str):
    """
    Attempts to call Gemini or OpenAI if API keys are set in environment.
    Falls back gracefully if not configured or on network error.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    if gemini_key:
        # Try models in order of capability: best first, lite as fallback
        gemini_models = [
            "gemini-3.8-flash",
            "gemini-flash-latest",
            "gemini-flash-lite-latest",
        ]
        for model_name in gemini_models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                payload = {
                    "system_instruction": {
                        "parts": [{"text": system_prompt}]
                    },
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{"text": user_message}]
                        }
                    ],
                    "generationConfig": {
                        "temperature": 0.7,
                        "maxOutputTokens": 1024
                    }
                }
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    return data["candidates"][0]["content"]["parts"][0]["text"]
            except urllib.error.HTTPError as e:
                error_code = e.code
                print(f"Gemini {model_name} returned HTTP {error_code}, trying next model...")
                if error_code == 503:
                    continue  # Model overloaded, try next one
                else:
                    break  # Non-recoverable error (e.g. 400, 401), stop trying
            except Exception as e:
                print(f"Gemini {model_name} error:", e)
                continue

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

    # Build rich system context for the LLM
    system_context = f"""You are the NetSlice AI Assistant — a smart, friendly, and knowledgeable assistant embedded in a 5G/6G Network Slicing Dashboard application.

## YOUR DUAL ROLE:
1. **Network Expert:** You have real-time access to the network simulation/monitoring data shown below. When users ask about network performance, slices, bandwidth, latency, packet drops, or anything related to this dashboard, use the live data to give accurate, specific answers.
2. **General Knowledge Assistant:** You can also answer general questions about ANY topic — technology, science, programming, math, history, or anything else. You are NOT limited to only network questions.

## RESPONSE GUIDELINES:
- Keep answers concise and well-formatted using Markdown (bold, bullet points, code blocks).
- For network questions, always reference actual data values from the live telemetry below.
- For general questions, answer naturally and helpfully just like any smart AI assistant would.
- Use emojis sparingly for visual clarity (✅, ⚠️, 📊, etc.).
- If the simulation is not running and the user asks about live metrics, let them know and suggest starting the simulation.

## CURRENT NETWORK STATE:
- **Operating Mode:** {mode.upper()} (Interface: {active_iface})
- **Simulation Running:** {simulation_state.get('is_running', False)}
- **Active Allocation Strategy:** {strategy}
- **Total Shared Bandwidth Pool:** 100 Mbps

### Slices:
1. **Low-Latency (URLLC)** — Port 9101, target latency < 15ms (VoIP, Gaming)
2. **High-Bandwidth (eMBB)** — Port 9102 (Video Streaming, Downloads)
3. **General-Purpose (mMTC)** — Port 9103 (IoT, Web Browsing)

### Live Telemetry Analysis:
{json.dumps(analysis, indent=2)}

### Database Summary:
- Total Historical Snapshots: {summary_stats.get('total_records', 0)}
- Historical QoS Violations: {summary_stats.get('qos_violations', 0)}
- Overall Packet Drop Rate: {summary_stats.get('overall_drop_rate', 0)}%
- Total Packets Processed: {summary_stats.get('total_packets_processed', 0):,}
- Total Packets Dropped: {summary_stats.get('total_packets_dropped', 0)}
"""

    # Try the LLM API first (Gemini / OpenAI)
    llm_output = query_llm_api(system_context, user_message)
    if llm_output:
        return llm_output

    # ═══════════════════════════════════════════════════════════
    # FALLBACK: Local hardcoded reasoning (if no API key or API fails)
    # ═══════════════════════════════════════════════════════════
    msg = user_message.strip().lower()

    # 1. Polite greetings & conversational queries (e.g. "hi", "how are you", "who are you")
    is_greeting = any(g in msg for g in ["hi", "hello", "hey", "good morning", "good evening", "good afternoon"])
    is_how_are_you = any(h in msg for h in ["how are you", "how r u", "how do you do", "how's it going"])
    is_identity = any(i in msg for i in ["who are you", "what are you", "what can you do", "what do you do", "help", "what is this"])

    if is_how_are_you:
        run_status = "actively monitoring live traffic" if simulation_state.get("is_running", False) else "currently paused and on standby"
        return (
            "👋 **Hello! I'm doing great, thanks for asking!**\n\n"
            f"I am your **NetSlice Network Assistant**. Right now, I am {run_status} on your 100 Mbps bandwidth pool.\n\n"
            "**Here is how I can help you:**\n"
            "- 📊 **Check Performance:** Ask me *'How is the network doing?'* or *'How is my Wi-Fi?'*\n"
            "- ⚠️ **Diagnose Drops:** Ask me *'Why are packets dropping?'* or *'Is there packet loss?'*\n"
            "- ⚡ **Analyze Latency:** Ask me *'What is the latency on gaming?'* or *'Is gaming lagging?'*\n"
            "- 🎛️ **Bandwidth Advice:** Ask me *'What bandwidth split do you recommend?'*\n"
            "- 🤖 **Machine Learning:** Ask me *'What is the status of the ML model?'*\n\n"
            "Feel free to ask any question about your network performance at any time!"
        )

    if is_greeting or is_identity:
        run_status = "live monitoring is running" if simulation_state.get("is_running", False) else "monitoring is paused (click 'Start Monitoring' above)"
        return (
            "👋 **Hi there! I am your NetSlice AI Network Assistant.**\n\n"
            "I'm specialized in real-time bandwidth management, 5G/6G network slicing, and QoS performance audits.\n\n"
            f"**Current Status:** {run_status}.\n\n"
            "**What you can ask me anytime:**\n"
            "1. **'How is my connection doing?'** — I'll inspect active throughput and load across all slices.\n"
            "2. **'Why are packets dropping?'** — I'll identify congested slices and suggest fixes.\n"
            "3. **'Check latency'** — I'll verify if voice/gaming latency meets your sub-15ms SLA target.\n"
            "4. **'Recommend allocations'** — I'll give exact Mbps slider suggestions.\n"
            "5. **'ML model status'** — I'll report on decision tree training and database history."
        )

    if not simulation_state.get("is_running", False):
        if any(k in msg for k in ["history", "database", "past", "record", "sample", "snapshot", "summary"]):
            return (
                f"**Database Archive Summary:**\n\n"
                f"- **Total Stored Snapshots:** `{summary_stats.get('total_records', 0)}` records in SQLite (`network_logs.db`)\n"
                f"- **Total Packets Logged:** `{summary_stats.get('total_packets_processed', 0):,}` pkts\n"
                f"- **Overall Dropped Packets:** `{summary_stats.get('total_packets_dropped', 0)}`\n"
                f"- **QoS Violations:** `{summary_stats.get('qos_violations', 0)}`\n\n"
                "Click **History** in the header to inspect individual records, or click **Start Monitoring** to begin streaming live traffic."
            )
        return (
            "Network monitoring is currently **paused**.\n\n"
            f"Click **Start Monitoring** in the top header to begin streaming live telemetry. "
            f"You can also ask about **database history** ({summary_stats.get('total_records', 0)} recorded snapshots) or ask general questions about how network slicing works."
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
