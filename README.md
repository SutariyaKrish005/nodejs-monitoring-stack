# Node.js Express API with Docker Monitoring Stack

A production-ready REST API built with Node.js and Express, backed by MongoDB, and fully instrumented with Prometheus metrics and Grafana dashboards — all containerized with Docker Compose.

This project demonstrates end-to-end observability for a microservice: from application code to metrics collection to visual dashboards, following real-world DevOps practices.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18 (Alpine) |
| Framework | Express.js 4 |
| Database | MongoDB 7 + Mongoose 8 |
| Metrics | Prometheus + prom-client |
| Dashboards | Grafana 10 |
| Containerization | Docker + Docker Compose |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Network                        │
│                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌───────────────┐  │
│  │  Express API │────▶│   MongoDB   │     │  Prometheus   │  │
│  │  :3000      │     │   :27017    │     │  :9090        │  │
│  └──────┬──────┘     └─────────────┘     └──────▲────────┘  │
│         │                                        │           │
│         │ /metrics                    scrape every 15s       │
│         └────────────────────────────────────────┘           │
│                                              │                │
│                                    ┌─────────▼──────┐        │
│                                    │    Grafana     │        │
│                                    │    :3001       │        │
│                                    └────────────────┘        │
└─────────────────────────────────────────────────────────────┘

Host machine ports:
  API      → localhost:3000
  MongoDB  → localhost:27017
  Prometheus → localhost:9090
  Grafana  → localhost:3001
```

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) v24+
- [Docker Compose](https://docs.docker.com/compose/install/) v2.20+ (included with Docker Desktop)

That's it. No Node.js or MongoDB installation required on your machine.

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/your-username/nodejs-express-mongodb-monitoring-stack.git
cd nodejs-express-mongodb-monitoring-stack
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

The defaults in `.env` work out of the box with Docker Compose. No changes needed to get started.

### 3. Start all services

```bash
docker-compose up -d
```

Docker will:
1. Build the Express API image from the `Dockerfile`
2. Pull MongoDB, Prometheus, and Grafana images
3. Start all 4 containers on a shared network
4. Wait for MongoDB to be healthy before starting the API

### 4. Verify everything is running

```bash
docker-compose ps
```

All 4 services should show `healthy` or `running` status within ~30 seconds.

---

## Access URLs

| Service | URL | Credentials |
|---|---|---|
| Express API | http://localhost:3000 | — |
| Health Check | http://localhost:3000/api/health | — |
| Prometheus Metrics | http://localhost:3000/metrics | — |
| Prometheus UI | http://localhost:9090 | — |
| Grafana | http://localhost:3001 | admin / admin |

---

## API Endpoints

### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-08-24T10:00:00.000Z",
  "uptime": 123.45,
  "mongodb": "connected",
  "environment": "production"
}
```

---

### Get All Users

```http
GET /api/users
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "createdAt": "2024-08-24T10:00:00.000Z"
    }
  ]
}
```

---

### Create a User

```http
POST /api/users
Content-Type: application/json

{
  "name": "Alice Johnson",
  "email": "alice@example.com"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "createdAt": "2024-08-24T10:00:00.000Z"
  }
}
```

**curl example:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Johnson", "email": "alice@example.com"}'
```

---

### Prometheus Metrics

```http
GET /metrics
```

Returns all metrics in Prometheus text format (scraped automatically every 15s).

---

## Grafana Dashboard Setup

### Step 1: Open Grafana

Navigate to http://localhost:3001 and log in with `admin` / `admin`.

Prometheus is already configured as the default datasource via provisioning — no manual setup needed.

### Step 2: Create a new dashboard

1. Click **Dashboards** in the left sidebar
2. Click **New** → **New Dashboard**
3. Click **Add visualization**
4. Select **Prometheus** as the data source

### Step 3: Add panels using these PromQL queries

---

#### Panel 1 — Total HTTP Requests (Stat panel)

**Title:** Total HTTP Requests

```promql
sum(http_requests_total{job="express-api"})
```

---

#### Panel 2 — Request Rate (Time series panel)

**Title:** Requests per Second

```promql
sum(rate(http_requests_total{job="express-api"}[1m])) by (route)
```

---

#### Panel 3 — Average Response Time (Time series panel)

**Title:** Average Response Time (ms)

```promql
sum(rate(http_response_time_seconds_sum{job="express-api"}[1m]))
/
sum(rate(http_response_time_seconds_count{job="express-api"}[1m])) * 1000
```

---

#### Panel 4 — 95th Percentile Response Time (Time series panel)

**Title:** p95 Response Time (ms)

```promql
histogram_quantile(
  0.95,
  sum(rate(http_response_time_seconds_bucket{job="express-api"}[5m])) by (le, route)
) * 1000
```

---

#### Panel 5 — HTTP Status Code Breakdown (Bar chart)

**Title:** Requests by Status Code

```promql
sum(http_requests_total{job="express-api"}) by (status_code)
```

---

#### Panel 6 — Active Connections (Gauge panel)

**Title:** Active Connections

```promql
active_connections{job="express-api"}
```

---

#### Panel 7 — Service Up/Down (Stat panel)

**Title:** API Status

```promql
up{job="express-api"}
```

Set value mappings: `1` → `UP` (green), `0` → `DOWN` (red).

---

#### Panel 8 — Node.js Memory Usage (Time series panel)

**Title:** Heap Memory Used (MB)

```promql
nodejs_heap_size_used_bytes{job="express-api"} / 1024 / 1024
```

---

### Step 4: Save the dashboard

Click **Save dashboard** (top right), give it a name like `Express API Monitoring`, and click **Save**.

---

## Useful Commands

```bash
# Start all services in the background
docker-compose up -d

# View real-time logs for all services
docker-compose logs -f

# View logs for a specific service
docker-compose logs -f app

# Stop all services (keeps volumes)
docker-compose down

# Stop all services AND delete all data volumes
docker-compose down -v

# Rebuild the API image after code changes
docker-compose up -d --build app

# Check service health
docker-compose ps

# Open a shell inside the running API container
docker-compose exec app sh
```

---

## Project Structure

```
.
├── models/
│   └── User.js                              # Mongoose User schema
├── grafana/
│   └── provisioning/
│       └── datasources/
│           └── datasource.yml               # Auto-configures Prometheus in Grafana
├── .env                                     # Local environment variables (not committed)
├── .env.example                             # Template for environment variables
├── .gitignore
├── docker-compose.yml                       # Orchestrates all 4 services
├── Dockerfile                               # Builds the Express API image
├── package.json
├── prometheus.yml                           # Prometheus scrape configuration
├── README.md
└── server.js                                # Express app entry point
```

---

## What I Learned

- **Docker multi-service orchestration** — defining service dependencies, health checks, named volumes, and bridge networks in Docker Compose
- **Prometheus instrumentation** — using `prom-client` to expose counters, histograms, and gauges; understanding the scrape model
- **PromQL** — writing queries for rates, histograms, quantiles, and label-based aggregations
- **Grafana provisioning** — automatically configuring datasources via YAML instead of manual UI setup
- **Container security** — running Node.js as a non-root user, using Alpine base images, omitting devDependencies in production
- **Observability principles** — the difference between metrics, logs, and traces; how the RED method (Rate, Errors, Duration) applies to API monitoring
- **Mongoose** — schema validation, unique indexes, and handling MongoDB connection lifecycle in a containerized environment

---

## License

MIT


## Screenshots

### Grafana Dashboard

![Grafana Dashboard](https://github.com/SutariyaKrish005/nodejs-monitoring-stack/blob/main/grafana%20(1).png?raw=true)

### Prometheus Metrics

![Prometheus Targets](https://github.com/SutariyaKrish005/nodejs-monitoring-stack/blob/main/grafana%20(2).png?raw=true)
