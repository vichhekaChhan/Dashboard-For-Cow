# Dashboard For Cow (WalkScale System) 🐄

A real-time hardware integration dashboard designed to monitor and log walk-over weight scale readings for cows. Built for seamless IoT-to-Web communication, this dashboard ingests data from load cell sensors via microcontrollers (like ESP32/LoRa) and visualizes the analytics instantly.

## 🚀 Features
- **Real-Time Data Streams**: Live updates fed through Socket.io and React state without needing page refreshes.
- **Analytics & Graphs**: Interactive line and area charts visualizing cow weights historically using `recharts`.
- **Simulation Mode**: Built-in mock data generator to test layout and network stability before hardware deployment.
- **PostgreSQL Persistence**: Bulletproof relational database storage persisting scale metrics securely.
- **Dockerized Architecture**: One-command deployment spinning up the Database, Backend API, and Frontend Vite server.

## 🛠️ Tech Stack
* **Frontend**: React (Vite), Ant Design, Recharts, Socket.io-client
* **Backend**: Node.js, Express, Socket.io
* **Database**: PostgreSQL
* **Infrastructure**: Docker & Docker Compose

## 📦 Quick Start (Docker)

1. Make sure [Docker Desktop](https://www.docker.com/products/docker-desktop/) is installed and running.
2. Clone the repository:
   ```bash
   git clone https://github.com/vichhekaChhan/Dashboard-For-Cow.git
   cd Dashboard-For-Cow
   ```
3. Start the entire application cluster:
   ```bash
   docker compose up -d --build
   ```
4. Access the dashboard:
   Open your browser and navigate to `http://localhost:5174`

## 📡 API Contract (Hardware Ingestion)
Microcontrollers send a `POST` request to the backend to log a reading.

**Endpoint**: `POST http://<SERVER_IP>:3001/api/weight-log`
**Payload**:
```json
{
  "device_id": "NODE-01",
  "weight_kg": 542.5,
  "timestamp": "2026-05-08T12:00:00.000Z"
}
```