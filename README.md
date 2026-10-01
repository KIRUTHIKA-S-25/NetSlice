# AI-Assisted Network Slicing and Resource Allocation

**IMPORTANT NOTE:** This project is a **software-based simulation**. It does **not** analyze, monitor, or capture your actual physical Wi-Fi or home network traffic. It creates a secure, self-contained mock virtual network in Python to demonstrate how 5G/6G network slicing concepts work.

---

## 1. Problem Statement
In modern 5G and 6G networks, a single shared physical infrastructure must carry wildly different types of applications—from lag-sensitive cloud gaming to bandwidth-heavy 4K video streaming. **Network Slicing** solves this by dividing the network into virtual "slices" tailored for specific needs. 

However, because the total resource pool (like bandwidth) is limited, distributing it effectively is a major challenge. 
- **Static allocation** wastes resources when a slice is idle.
- **Rule-based allocation** only reacts *after* a slice gets congested and packets start dropping, breaking Quality of Service (QoS).

## 2. Proposed Solution
This project introduces an **AI-Assisted Dynamic Allocation System**. Instead of waiting for congestion, the system:
1. **Monitors** virtual traffic metrics (latency, throughput, packet drops) across slices in real-time.
2. **Predicts** upcoming traffic demands using a lightweight Machine Learning model (Decision Trees).
3. **Reallocates** bandwidth *before* congestion occurs, ensuring delay-sensitive slices get the resources they need to maintain QoS, while maximizing overall utilization.

## 3. System Architecture & Functionalities

The project is divided into four distinct layers:

### A. Virtual Network & Simulation Layer (Python)
- **Logical Slices:** Simulates three network slices: 
  - **Low-Latency:** High priority, strict latency limits (e.g., VoIP, Gaming).
  - **High-Bandwidth:** Requires massive throughput (e.g., Video Streaming).
  - **General-Purpose:** Normal web browsing traffic.
- **Traffic Generator:** Simulates clients generating varying levels of TCP/UDP-like packet traffic over time.

### B. Intelligence & Allocation Layer (Python / Scikit-Learn)
- **Metrics Collector:** Continuously polls the slices to calculate throughput, utilization, average latency, and dropped packets.
- **ML Engine:** Uses Scikit-Learn (Decision Tree Regressor) to analyze historical usage patterns and predict future bandwidth demand.
- **Allocation Engine:** Dynamically shifts bandwidth limits between slices based on the selected strategy (Static, Rule-Based, or AI-Assisted).

### C. Control Layer (FastAPI)
- **REST APIs:** A Python backend server that controls the simulation state. It exposes endpoints to start the simulation, stop it, and stream live metrics to the frontend.

### D. Presentation Layer (React + Vite)
- **Premium Dashboard:** A modern, glassmorphism-styled React web application.
- **Live Monitoring:** Fetches data from the FastAPI backend every second to display real-time network conditions for all three slices simultaneously.

## 4. Tech Stack Used
*   **Backend & Simulation:** Python
*   **API Framework:** FastAPI, Uvicorn
*   **Machine Learning:** Scikit-Learn, Pandas, NumPy
*   **Frontend UI:** React, Vite
*   **Styling:** Modern Vanilla CSS (CSS Variables, Flexbox/Grid, Glassmorphism)

## 5. How to Run the Project

If the servers are not already running, you can launch them with the following commands:

**Start Backend (API & Simulation):**
```bash
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

**Start Frontend (Dashboard):**
```bash
cd frontend
npm run dev
```

Then, open **http://localhost:5173** in your web browser. Select an allocation strategy from the dropdown and click "Start Simulation" to watch the real-time AI resource allocation in action!
