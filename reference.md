# Project Enhancements & Reference Guide

This document outlines the planned next steps, architectural upgrades, and feature enhancements for the AI-Assisted Network Slicing project.

---

## 1. Database Storage for Network Analytics
**Current State:** 
Currently, the network metrics (throughput, latency, packet drops) are kept in memory and passed directly to the React frontend. Once the server restarts, this data is lost.

**Why it needs to be stored:**
- **ML Retraining:** The AI model (Decision Trees) becomes much smarter if it can learn from days or weeks of historical traffic patterns, rather than just immediate live data.
- **Reporting:** Administrators need to view historical QoS violations and overall slice performance over a given month or year.

**Proposed Implementation:**
- Integrate **SQLite** (or PostgreSQL for larger scales) in the FastAPI backend using `SQLAlchemy`.
- The `MetricsCollector` will write every 1-second snapshot to a `network_logs` table.
- Create new API endpoints (e.g., `/api/history`) so the frontend can query past analytics.

---

## 2. Integrated AI Assistant Bot
**Current State:**
Users must understand the dashboard numbers on their own.

**Why it's needed:**
- If an admin notices that the "Low-Latency" slice is dropping packets, they might have questions like *"Why is latency spiking right now?"* or *"How do I fix the general slice's bandwidth limit?"*
- An integrated AI bot can analyze the current database logs and give instant, actionable suggestions.

**Proposed Implementation:**
- Add a Chatbot widget to the bottom-right corner of the React Dashboard.
- Connect it to an LLM API (like OpenAI, Gemini, or a local LLaMA model).
- Give the AI read-access to the current `monitor_snapshot` so it can give contextual advice (e.g., *"I see the High-Bandwidth slice is at 98% utilization. I suggest manually increasing its static cap to 60 Mbps."*).

---

## 3. Frontend Feature Enhancements
**Current State:**
The React frontend is a sleek but basic "Glassmorphism" grid displaying the real-time stats in three cards.

**Proposed Additional Features to make it a full-fledged Admin Panel:**
1. **Live Time-Series Charts:** Instead of just text, use `Recharts` or `Chart.js` to draw moving line graphs showing latency and bandwidth over the last 60 seconds.
2. **Interactive Configuration Sliders:** Allow the user to manually drag sliders to allocate the 100 Mbps pool themselves when using the "Static" strategy.
3. **Traffic Profile Tweaker:** Add a menu to intentionally simulate traffic spikes (e.g., a "Simulate DoS Attack" button or "Start 4K Streaming Burst" button) to see how the AI reacts.
4. **Action Log / Terminal Window:** A scrolling terminal-like window on the dashboard showing exactly when the Allocation Engine shifts bandwidth (e.g., *"14:02:11 - AI shifted 5 Mbps from General to Low-Latency"*).
