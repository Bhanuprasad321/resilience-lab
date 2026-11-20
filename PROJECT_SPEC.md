# Project: resilience-lab ("Mini Store")

## 1. Purpose

A hands-on lab to learn and demonstrate four system design concepts by building a small
e-commerce backend, deliberately breaking it, fixing it, and MEASURING the difference:
scalability, availability, reliability, single points of failure (SPOF).
Later extension: fault tolerance and failover (Phases 5-6).
This is a local simulation on Docker Compose, NOT a production system. The goal is
learning and a portfolio project (GitHub + LinkedIn), so clarity and measurable results
matter more than features.

## 2. Tech stack

- Node.js 20 + Express (plain JavaScript, CommonJS, no TypeScript)
- MongoDB (mongoose), Redis (ioredis), BullMQ for queue jobs
- nginx as load balancer / reverse proxy
- Docker + Docker Compose for everything
- Libraries: express-session + connect-redis, opossum (circuit breaker), pino (logging)
- Testing and measuring: autocannon (load), custom probe script (Node), optional k6
- No paid services, no cloud accounts. Everything must run with `docker compose up`.

## 3. Architecture (final target)

client/load tool -> nginx -> app1, app2, app3 (stateless Express)
app instances -> Redis (sessions, cart, cache, queue) and MongoDB (replica set)
app -> recs-service (separate flaky Express service)
worker (BullMQ consumer) -> sends "confirmation emails" (simulated by logging)

Repo layout:

```
resilience-lab/
├── docker-compose.yml
├── nginx/nginx.conf
├── app/              (server.js, routes/, middleware/, db.js, redis.js, config.js)
├── recs-service/
├── worker/
├── scripts/          (load-test, probe.js, chaos scripts, seed.js)
├── results/          (data/ charts/ demos/)
├── docs/             (experiments.md, spof-analysis.md)
└── README.md
```

## 4. Functional requirements (app)

- GET /health -> process status; in later phases also checks Redis and Mongo
- GET /products -> list products; supports ?search= and ?limit=
- GET /products/:id
- POST /auth/login -> simple username login (no real password security needed), creates session
- POST /cart -> add item to cart (belongs to session)
- GET /cart
- POST /checkout -> turns cart into an order
- POST /orders -> creates order (Phase 4: requires Idempotency-Key header)
- GET /recommendations -> calls recs-service
- GET /status -> (Phase 5) current mode: normal | degraded | read-only
- Every response includes header X-Instance-Id (hostname of the container) so we can
  SEE load balancing and failover in the probe output.
- Seed script creates ~1,000 products.

## 5. Phases (build ONE at a time, only when I ask)

### Phase 1 - Baseline (tag v1-baseline)

Single Express server + single MongoDB, in-memory sessions, one deliberately slow path
(unindexed search query on /products?search=). Plus scripts/load-test and docs/experiments.md
template. Baseline metrics recorded: req/s, p50, p99, error rate.

### Phase 2 - Scalability (tag v2-scalable)

- Add the missing index and re-measure.
- nginx + 3 app containers, each limited with `cpus: "0.5"` so scaling is visible on a laptop.
- Demonstrate the session bug (in-memory sessions across instances), then move sessions
  and cart to Redis so app servers are stateless.
- Cache-aside for GET /products with TTL and invalidation on update.
- Before/after metrics table.

### Phase 3 - Availability (tag v3-available)

- scripts/probe.js: hits /products and /checkout every 100 ms, logs timestamp, status,
  latency, X-Instance-Id to CSV, prints per-operation availability percentage.
- nginx health handling (max_fails, fail_timeout), /health checks Redis + Mongo.
- MongoDB replica set (mongo1, mongo2, mongo3 + one-shot init container running rs.initiate),
  connection string with all members, retryWrites=true.
- Experiments: stop one app instance; stop the Mongo primary; measure failure window.
- Compare measured availability with theoretical series/parallel calculations in docs.

### Phase 4 - Reliability (tag v4-reliable)

- POST /orders non-idempotent first, with a chaos flag that drops the response AFTER
  the order is saved to simulate a lost response -> client retries -> duplicate order.
  Then fix with Idempotency-Key header + unique index.
- recs-service with env-controlled behavior: random 5s delay, random 500 errors.
  Show checkout slowing down (cascade). Fix: timeout + circuit breaker (opossum) + fallback
  to trending products.
- BullMQ confirmation-email job with retries; kill the worker mid-job to show retry.
- scripts/verify-orders.js: correctness check (order totals match carts, no duplicates).
- Report error rate, MTTR (from probe), correctness.

### Phase 5 - SPOF review (tag v5-spof-reviewed)

- Mermaid dependency graph for the checkout flow.
- Kill each component one at a time (nginx, Redis, Mongo primary, recs-service, worker)
  and record behavior in docs/spof-analysis.md (SPOF, impact, decision: remove/mitigate/
  accept/roadmap, reason). Include runtime and recovery SPOFs.
- Redis-down fallback that prevents flooding Mongo; second nginx instance.

### Later (roadmap, do not build yet)

Fault tolerance (degradation modes, retries with backoff + jitter, bulkheads, load shedding,
Redis replica, chaos script suite) and failover (Mongo failover under load with RTO/RPO,
nginx active-passive, worker failover, split-brain write-up).

## 6. Non-functional requirements

- All config via environment variables with a .env.example. Never commit secrets.
- Structured logs (pino) including instance id and request id.
- Each script writes machine-readable output (CSV/JSON) into results/data/, not just console.
- Keep code simple and readable; short comments explaining WHY.
- Works on Windows, macOS and Linux with Docker Desktop. Do not use Linux-only tools
  (like `tc`) in required paths; keep those optional.

## 7. Rules for the AI agent (IMPORTANT)

1. Build ONLY the phase I name. Do not add later-phase features or extra libraries.
2. Before coding, list the files you will create or change and wait for my OK.
3. After coding, explain in plain language what each file does and how to run and verify it.
4. LEARNER-WRITES: for the items marked below, do NOT implement. Create the file with a
   clear TODO block, function signature, expected behavior and test cases, and I will write
   the logic myself. Afterwards I will ask you to review it.
   - Redis session/cart storage wiring (Phase 2)
   - Cache-aside logic (Phase 2)
   - Idempotency-Key handling (Phase 4)
   - Circuit breaker + timeout + fallback (Phase 4)
5. When you generate failure-handling code, state what happens on timeout, on retry, and
   when the dependency is down.
6. If something is ambiguous, ask one clear question instead of guessing.
7. Keep commits small. Suggest a commit message after each logical step.
8. Never claim the system is "production-ready"; it is a local lab.

## 8. Definition of done (every phase)

- `docker compose up --build` starts cleanly from a fresh clone
- README section for the phase: problem, what we broke, the fix, how to reproduce
- Before/after metrics added to docs/experiments.md using the format:
  Hypothesis -> What I broke -> What happened -> What I changed
- Evidence saved in results/ (CSV data, and I add screenshots/GIFs myself)
- Git tag created (v1-baseline, v2-scalable, ...)
