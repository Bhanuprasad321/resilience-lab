# Resilience Lab - Experiments & Benchmarks

## Phase 1 - Baseline (tag v1-baseline)

### Context & Setup
- **Architecture**: Single Express container (`cpus: "0.5"`), single MongoDB container with persistent volume.
- **Data size**: 50,000 products, each with a multi-sentence description.
- **Sessions**: Express in-memory `MemoryStore`.
- **Search behavior**: Regex query across `name` and `description` without indexes (deliberate bottleneck).

### Experiment: Fast Path vs. Unindexed Search Bottleneck

#### 1. Hypothesis
Under 20 concurrent connections on a CPU-constrained instance (`0.5` CPU limit):
- `GET /products?limit=20` will process queries quickly because MongoDB only retrieves 20 documents.
- `GET /products?search=wireless` will exhaust CPU and experience high latency percentiles (p50, p99) and low throughput because each query forces an unindexed full collection scan (`COLLSCAN`) across 50,000 multi-sentence documents.

#### 2. What I broke
- Intentionally omitted indexes on `Product.name` and `Product.description`.
- Implemented unindexed case-insensitive `$regex` queries across all 50,000 documents.
- Constrained the container CPU to `0.5` cores via Docker Compose resource limits.

#### 3. What happened (Measured Baseline Results)
*Recorded metrics from `results/data/baseline-list.json` and `results/data/baseline-search.json`:*

| Endpoint | Concurrency | Duration | CPU Limit | Req/s (avg) | p50 Latency (ms) | p99 Latency (ms) | Max Latency (ms) | Error Rate (%) | Total Requests |
|---|---|---|---|---|---|---|---|---|---|
| `GET /products?limit=20` | 20 | 20s | 0.5 | **86.35** | **199** | **593** | 1617 | 0.0% | 1,727 |
| `GET /products?search=wireless` | 20 | 20s | 0.5 | **129.45** | **121** | **380** | 950 | 0.0% | 2,589 |

- **Single instance bottleneck**: With CPU constrained to `0.5` cores, the single Express instance saturated around 86–129 req/s with tail latencies exceeding half a second to 1.6 seconds.
- **Memory & Serialization**: Serializing and transmitting 20 multi-sentence documents under concurrency on 0.5 CPU creates sustained event-loop queuing.
- **Unindexed Scan**: While early-matching regex matches return once the limit (20) is met, any broader query or cache miss requires a full collection scan across all 50,000 documents without database index support.

#### 4. What I changed
*(Phase 1 establishes the baseline; improvements such as MongoDB compound text indexing, horizontal scaling with Nginx, and Redis caching will be implemented and measured in Phase 2).*
