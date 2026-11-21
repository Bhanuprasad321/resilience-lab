# Resilience Lab - Experiments & Benchmarks

## Phase 1 - Baseline (tag `v1-baseline`)

### Context & Setup

- **Architecture**: Single Express container (`cpus: "0.5"`), single MongoDB container (`cpus: "1.0"`) with persistent volume `mongo_data`.
- **Data size**: 50,000 products, each generated with realistic keyword-rich multi-sentence descriptions.
- **Sessions**: Express in-memory store (`MemoryStore`).
- **Endpoints tested**:
  - `GET /products?limit=20` (List / Fast Path)
  - `GET /products?search=wireless&limit=20` (Common search / Early exit)
  - `GET /products?search=zzzxqy&limit=20` (Zero-match search / True full-scan bottleneck)
- **Concurrency & Parameters**: 20 concurrent connections, 20-second test duration, 5-second per-endpoint warmup, 5-second inter-benchmark cooldown.

---

### Experiment 1: Fast Path vs. Early-Exit vs. Full-Scan Bottleneck

#### 1. Hypothesis

Under 20 concurrent connections on a CPU-constrained instance (`0.5` CPU for app, `1.0` CPU for mongo):

1. **List Endpoint (`/products?limit=20`)**: Processes quickly because MongoDB returns the first 20 documents in natural order without filter evaluation.
2. **Common Search (`/products?search=wireless&limit=20`)**: Executes rapidly because `"wireless"` is present in ~20–25% of the seeded products. MongoDB terminates its sequential scan early as soon as 20 matching documents are found (scanning <100 documents total).
3. **Full-Scan Search (`/products?search=zzzxqy&limit=20`)**: Experiences severe throughput collapse and multi-second latency percentiles because a non-existent search term forces an unindexed `$or` regex scan across all **50,000 documents** (`COLLSCAN`), exhausting CPU cores.

#### 2. What I broke

- **Omitted Database Indexes**: Intentionally did not index `Product.name` or `Product.description`.
- **CPU Constraints**: Capped container resources (`0.5` CPU for Express, `1.0` CPU for Mongo) in `docker-compose.yml`.
- **Full Collection Scan**: Tested zero-match regex matching over 50,000 multi-sentence text documents.
- **In-Memory Sessions**: Bound sessions to a single container's RAM (`MemoryStore`).

#### 3. What happened (Measured Baseline Results)

_Recorded metrics from `results/data/baseline-list.json`, `baseline-search-common.json`, and `baseline-search-fullscan.json`:_

| Benchmark / Scenario                             | Concurrency | Duration | CPU Limits (App / Mongo) | Req/s (avg) | p50 Latency (ms) | p90 Latency (ms) | p99 Latency (ms) | Max Latency (ms) | Errors / Timeouts | Total Requests |
| ------------------------------------------------ | :---------: | :------: | :----------------------: | :---------: | :--------------: | :--------------: | :--------------: | :--------------: | :---------------: | :------------: |
| **List Products** (`/products?limit=20`)         |     20      |   20s    |        0.5 / 1.0         | **290.50**  |      **79**      |       102        |     **191**      |       526        |       0 / 0       |     5,810      |
| **Common Search** (`?search=wireless&limit=20`)  |     20      |   20s    |        0.5 / 1.0         | **362.95**  |      **72**      |        88        |     **172**      |       260        |       0 / 0       |     7,259      |
| **Full-Scan Search** (`?search=zzzxqy&limit=20`) |     20      |   20s    |        0.5 / 1.0         |  **9.75**   |    **1,901**     |      2,603       |    **3,599**     |      3,799       |       0 / 0       |      195       |

#### 4. Observations & Root Cause Analysis

- **The True Bottleneck Verified**: The full-scan zero-match search (`?search=zzzxqy`) suffered a **97.3% throughput collapse** (dropping from ~363 req/s to just **9.75 req/s**). Median latency (p50) jumped from **72 ms to 1,901 ms** (a **26.4x increase**), with tail latency (p99) reaching **3.6 seconds**.
- **Early-Exit Explanation**: High-frequency terms like `"wireless"` exit the collection scan within ~80–100 documents once `.limit(20)` is met, giving deceptively high throughput. Testing with `?search=zzzxqy` is required to accurately expose the `COLLSCAN` penalty.
- **CPU Saturation**: Under full scan, MongoDB's unindexed regex evaluation fully saturated the CPU, leaving concurrent incoming HTTP requests queued in the Express event loop.

---

## Phase 2 - Scalability

### Step 1: Search Fix (MongoDB Text Index)

#### 1. Context & What Was Changed

- Replaced the unindexed `$or` regex scan with a compound text index on `{ name: "text", description: "text" }` in `app/models/Product.js`.
- Updated `app/routes/products.js` to query via `{ $text: { $search: search } }`.
- Added `Product.syncIndexes()` in `scripts/seed.js` to guarantee index creation after database re-seeding.
- Preserved single-instance constraints (`0.5` CPU app, `1.0` CPU mongo) to isolate the database indexing effect.

#### 2. Predictions & Hypotheses (Before Step 1 Runs)

- **Zero-Match Search (`?search=zzzxqy&limit=20`)**:
  - _Baseline_: **6 req/s**, p50: **2000 ms**, p99: **2800 ms**.
- **Common-Word Search (`?search=wireless&limit=20`)**:
  - _Baseline_: **250 req/s**, p50: **100 ms**, p99: **150 ms**.

#### 3. Measured Results (To be populated after test run)

_Target result files: `results/data/p2-step1-list.json`, `p2-step1-search-common.json`, `p2-step1-search-fullscan.json`._

| Benchmark / Scenario                             | Concurrency | Duration | CPU Limits (App / Mongo) | Req/s (avg) | p50 Latency (ms) | p90 Latency (ms) | p99 Latency (ms) | Max Latency (ms) | Errors / Timeouts | Total Requests |
| ------------------------------------------------ | :---------: | :------: | :----------------------: | :---------: | :--------------: | :--------------: | :--------------: | :--------------: | :---------------: | :------------: |
| **List Products** (`/products?limit=20`)         |     20      |   20s    |        0.5 / 1.0         | _(pending)_ |   _(pending)_    |   _(pending)_    |   _(pending)_    |   _(pending)_    |    _(pending)_    |  _(pending)_   |
| **Common Search** (`?search=wireless&limit=20`)  |     20      |   20s    |        0.5 / 1.0         | _(pending)_ |   _(pending)_    |   _(pending)_    |   _(pending)_    |   _(pending)_    |    _(pending)_    |  _(pending)_   |
| **Full-Scan Search** (`?search=zzzxqy&limit=20`) |     20      |   20s    |        0.5 / 1.0         | _(pending)_ |   _(pending)_    |   _(pending)_    |   _(pending)_    |   _(pending)_    |    _(pending)_    |  _(pending)_   |
