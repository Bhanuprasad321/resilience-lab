# resilience-lab ("Mini Store")

A hands-on engineering lab to learn and demonstrate four system design concepts: **scalability**, **availability**, **reliability**, and **single points of failure (SPOF)** by building a small e-commerce backend, deliberately breaking it, fixing it, and **measuring** the difference.

> **Note**: This is a local simulation on Docker Compose for educational and portfolio demonstration. It is not intended to be a production-ready system.

---

## Phase 1: Baseline (`v1-baseline`)

Phase 1 establishes the single-instance baseline before any distributed scaling or resilience patterns are added:
- **Single Express instance** constrained to `0.5` CPU cores (`cpus: "0.5"`).
- **Single MongoDB instance** with persistent volume and healthcheck.
- **In-memory sessions** (`MemoryStore`).
- **50,000 seeded products** with multi-sentence descriptions.
- **Deliberately unindexed search path**: `GET /products?search=...` performs a full collection scan (`COLLSCAN`) with regex over 50,000 records.
- **Load test runner (`scripts/load-test.js`)**: Uses `autocannon` to record throughput, latency distribution (p50, p99), and error rates.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Docker Compose v2+)
- [Node.js 20+](https://nodejs.org/) (for running host-side scripts and tests)

---

## Quick Start: Build & Run

### 1. Configure Environment
Copy the example environment configuration:
```bash
cp .env.example .env
```

### 2. Start Services via Docker Compose
Build and launch MongoDB and the Express app container:
```bash
docker compose up --build -d
```

Verify container status and health:
```bash
docker compose ps
```
The `mongo` container will transition to `healthy`, after which `resilience-app` will start listening on port `3000`.

---

## Seeding the Database (50,000 Products)

MongoDB exposes port `27017` on `localhost`. Seeding is idempotent (it automatically drops existing products before re-populating).

You can run the seed script in either of two ways:

### Option A: From the Host (Recommended)
Install root dependencies and run:
```bash
npm install
npm run seed
```
*(Uses `mongodb://localhost:27017/resilience_lab`)*

### Option B: Inside the Container
Run directly within the Docker network:
```bash
docker compose run --rm -e MONGO_URI=mongodb://mongo:27017/resilience_lab app node ../scripts/seed.js
```

---

## Verifying the Endpoints

Test that the service is running properly:

### 1. Health Check
```bash
curl -i http://localhost:3000/health
```
*Response includes `X-Instance-Id` header (container hostname) and process status.*

### 2. List Products (Fast Path)
```bash
curl -i "http://localhost:3000/products?limit=5"
```

### 3. Search Products (Unindexed Slow Path)
```bash
curl -i "http://localhost:3000/products?search=wireless&limit=5"
```

### 4. Auth, Cart & Checkout Flow
```bash
# Login to create in-memory session (save cookie jar)
curl -c cookies.txt -b cookies.txt -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice"}'

# Get first product ID
PRODUCT_ID=$(curl -s "http://localhost:3000/products?limit=1" | grep -o '"_id":"[^"]*' | cut -d'"' -f4)

# Add item to cart
curl -c cookies.txt -b cookies.txt -X POST http://localhost:3000/cart \
  -H "Content-Type: application/json" \
  -d "{\"productId\": \"$PRODUCT_ID\", \"quantity\": 2}"

# View cart
curl -c cookies.txt -b cookies.txt http://localhost:3000/cart

# Checkout (converts cart to Order with price snapshots, clears cart)
curl -c cookies.txt -b cookies.txt -X POST http://localhost:3000/checkout
```

---

## Running the Load Test

Run autocannon to benchmark the fast list path vs. the unindexed search path:
```bash
npm run test:load
```
> **Note**: For load testing, `LOG_LEVEL=warn` is recommended to prevent console I/O from skewing benchmarks.

The load test will:
1. Run a 5-second warm-up against `/health`.
2. Benchmark `GET /products?limit=20` (20 connections, 20s).
3. Benchmark `GET /products?search=wireless` (20 connections, 20s).
4. Save machine-readable output to:
   - `results/data/baseline-list.json`
   - `results/data/baseline-search.json`
5. Print a comparative summary table directly to the console.

---

## Repository Structure

```
resilience-lab/
├── docker-compose.yml        # Orchestration with CPU limits and Mongo healthcheck
├── .env.example              # Environment variables template
├── package.json              # Root dependencies & runner scripts (seed, test:load)
├── README.md                 # Project guide and Phase 1 documentation
├── app/
│   ├── Dockerfile            # Multi-stage/alpine container running Node 20
│   ├── package.json          # App runtime dependencies (express, mongoose, pino)
│   ├── server.js             # Bootstrap, session store, middleware, error handling
│   ├── config.js             # Centralized config
│   ├── db.js                 # Mongoose connection with error handling
│   ├── middleware/
│   │   ├── instanceId.js     # Header X-Instance-Id injection
│   │   └── logger.js         # Structured Pino logging with request IDs
│   ├── models/
│   │   ├── Product.js        # Deliberately unindexed schema for search
│   │   └── Order.js          # Order schema with item price snapshots
│   └── routes/
│       ├── health.js         # GET /health
│       ├── products.js       # GET /products (?search= & ?limit=) and GET /products/:id
│       ├── auth.js           # POST /auth/login
│       ├── cart.js           # GET /cart & POST /cart
│       └── checkout.js       # POST /checkout
├── scripts/
│   ├── seed.js               # Idempotent 50,000 product generator
│   └── load-test.js          # Autocannon baseline benchmark suite
├── docs/
│   └── experiments.md        # Experiment hypothesis and results log
└── results/
    └── data/                 # Machine-readable benchmark outputs (.json)
```
