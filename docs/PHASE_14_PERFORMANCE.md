# Phase 14: Performance Optimization - SafeRide Kigali

This document defines the performance objectives, measurable targets, optimization strategies, benchmarking plans, and operational guidance to ensure SafeRide Kigali meets production-grade latency, throughput, and scalability requirements.

Scope (MVP):
- Define performance targets for API, realtime, database, and mobile app UX
- Provide profiling and benchmarking plans and tooling
- Define caching, batching, and rate control strategies
- Provide database query optimization, indexing guidance, and connection pooling guidance
- Define autoscaling and capacity planning strategies for expected workloads in Kigali

Deferred: global multi-region replication and cross-region failover (plan for long-term growth)

---

## 14.1 Goals and Non-Goals

Goals:
- Ensure low-latency ride matching and ride lifecycle updates
- Keep API P95 latency < 300ms for critical endpoints under steady load
- Support the MVP capacity targets with headroom for growth
- Make performance reproducible with automated benchmarks and CI gating for regressions

Non-Goals:
- Complete global scale design (deferred to Phase 15+)

---

## 14.2 Measurable Performance Targets (MVP)

API (NestJS REST) targets:
- P50 latency for READ endpoints (GET /drivers/me, GET /rides/active): < 100ms
- P95 latency for READ endpoints: < 300ms
- P50 latency for WRITE endpoints (POST /rides, POST /ride/{id}/accept): < 200ms
- P95 latency for WRITE endpoints: < 500ms
- Error rate (5xx) < 0.1% under healthy load

Realtime (Socket.IO):
- Emit-to-receive latency (server send -> client on same region): < 200ms P95
- Offer acceptance round-trip latency: < 300ms P95
- Max concurrent sockets per instance target: 8,000–10,000 (adjustable by instance size)

Database & Queries:
- Target average query latency: < 10ms for indexed lookups
- Long-running queries (> 200ms) to be investigated and optimized

Mobile UX:
- Cold start: < 2.5s on mid-range devices
- Time-to-first-interactive for home screen: < 1.5s after auth
- Notification latency (push): < 5s typical, accept up to 30s depending on device/network

SLIs / SLOs:
- Availability SLO: 99.9% for core user flows (ride request → assignment → completion)
- Error budget: 0.1% per month

---

## 14.3 Workload and Capacity Planning

MVP expected peak load assumptions (Kigali-only initial roll-out):
- Active registered users: 50k
- Concurrent active drivers: 2k
- Concurrent passengers (peak hours): 6k
- Peak ride requests per minute: 1,200
- Peak socket connections: 8,000

Capacity planning approach:
1. Define baseline resource per instance (vCPU, RAM) and measure sustainable socket count and RPS.
2. Use load tests to validate required instance counts for target concurrency with 2× safety margin.
3. Plan autoscaling triggers based on CPU, memory, socket count per instance, and queue/backlog metrics.

Example initial production sizing (estimate):
- API/Socket instance type: 4 vCPU, 8–16 GB RAM — expected to handle ~3k sockets and 800 RPS depending on workload.
- Database: managed Postgres with 4–8 vCPU primary and read replicas for reporting workloads.
- Redis: cluster sized for pub/sub and ephemeral state; plan memory per key estimates and scale accordingly.

NOTE: These are estimates — benchmarking required to validate.

---

## 14.4 Profiling and Benchmarking Tools

Recommended tooling:
- Load testing: k6, Gatling, or Artillery for HTTP endpoints; Soketto or custom harness for websockets.
- Socket simulation: use socket.io-client with Node.js harness to simulate drivers and passengers.
- Profilers: clinic.js (Node), flamegraphs (0x), pprof (Go if used), Node.js built-in inspector/profiler.
- DB benchmarking: pgbench and EXPLAIN ANALYZE for slow queries.
- Distributed tracing: OpenTelemetry + Jaeger/Tempo for end-to-end traces.

Benchmark plans:
- Baseline test: simulate 10k concurrent sockets connecting and sending periodic location updates; measure CPU/RAM and emit latency.
- API stress test: ramp to expected peak RPS for core endpoints (create ride, accept) and measure P95 latency and error rates.
- Dispatch test: simulate MATCHING workflow with multiple drivers rejecting/offering to test outbox and dispatcher throughput.
- Reconciliation test: run heavy read reports to ensure analytics queries do not impact primary DB (use replicas or separate analytics store).

CI gating:
- Integrate critical micro-benchmarks (smoke-load tests) into CI to detect regressions on PRs that touch performance-sensitive code.

---

## 14.5 Backend Optimization Strategies

1. Caching
   - Use Redis for ephemeral caches: driver presence, geospatial indices (Redis GEO), configuration values.
   - Use HTTP caching headers and CDN for static assets and Next.js admin static pages.
   - Cache computed fare estimates and route ETA for short TTL (e.g., 5–30s) to reduce repeated Google Maps calls.

2. Database optimization
   - Use indices on columns used in WHERE and ORDER BY: rides(state, created_at), drivers(status, last_seen), payments(provider_ref)
   - Use Partial indexes to optimize common queries (e.g., WHERE state='MATCHING').
   - Avoid SELECT *; fetch only required columns.
   - Use batch inserts and update statements where possible for events.
   - Use transactions for correctness but keep them as short as possible.
   - Monitor and tune connection pool: Prisma DB pool or pgBouncer for pooling when using multiple app instances.

3. Query patterns
   - Use cursor-based pagination for lists to avoid offset scans.
   - Avoid N+1 by using joins or Prisma include with careful selection.
   - Use materialized views for heavy aggregated queries (e.g., daily KPIs), refresh them asynchronously.

4. Concurrency & locking
   - Minimize use of long-running locks; prefer optimistic concurrency where possible.
   - Use Redis distributed locks for ephemeral coordination (e.g., ride assignment) and keep TTLs conservative.

5. External API calls
   - Use connection pooling and HTTP keep-alive.
   - Use local caching for infrequently changing external data.
   - Apply retries with exponential backoff and circuit breaker patterns for provider APIs (payment, maps).

6. Socket.IO tuning
   - Use Redis adapter and namespace/room segmentation to avoid broadcast storms.
   - Limit message sizes; use binary payloads where appropriate.
   - Use middleware to drop or coalesce frequent events (e.g., location) and aggregate updates server-side.

7. Worker design
   - Use stateless workers that scale horizontally for dispatcher and outbox; ensure idempotency and visibility timeouts.
   - Use smaller, targeted workers vs a single monolithic job to reduce tail latencies and isolate faults.

---

## 14.6 Caching & CDN Strategy

Cache layers:
- Edge CDN: serve Next.js static assets and admin static builds (CloudFront, Cloudflare)
- API caching: use short TTL caching for read-heavy endpoints (driver profiles) and cache invalidation strategies via events
- Redis LRU caches for ephemeral computed values

Cache invalidation:
- Use publish/subscribe to invalidate cache on update events (e.g., driver profile updated -> invalidate cached key)
- Include versioning in cache keys when schema changes to avoid long-lived stale caches

---

## 14.7 Database Indexing and Schema Guidance

Key index recommendations (prisma / Postgres):
- rides: index on (state, created_at), (driver_id), (passenger_id)
- drivers: index on (status, last_seen_at), unique on (phone)
- payments: unique(provider, provider_reference) and index on (ride_id, status)
- outbox: index on (delivered_at, attempts) to surface backlog

Use EXPLAIN ANALYZE to identify slow queries and create composite indexes where beneficial. Consider using BRIN indexes for large append-only timestamped tables when appropriate.

---

## 14.8 Realtime Performance Considerations

- Coalesce location updates: accept a frequency cap client-side (e.g., 1Hz) and server-side accept/aggregate.
- Prioritize events in Socket.IO: use separate queues/rooms for high-priority messages (offers) vs routine telemetry (location)
- Monitor socket event loops and ensure event handling remains non-blocking; offload heavy computation to worker processes

---

## 14.9 Load Testing & Production Readiness Tests

Test types and scenarios:
- Soak test: run realistic traffic mix for hours to detect memory leaks and resource degradation
- Spike test: sudden increase in ride requests to test autoscaling and matching resilience
- Chaos testing: simulate Redis or DB failover to validate recovery
- Regression benchmarks: run pre-merge benchmarks on modified code paths

Load testing pipeline:
- Create repeatable scripts with k6 for HTTP and a Node harness for Socket.IO
- Capture baseline metrics and use them to tune autoscaling and instance sizing

---

## 14.10 Autoscaling and Operational Guidance

Autoscaling signals:
- Horizontal Pod/Instance scaling by CPU and by custom metrics: socket_count_per_instance, event_loop_delay, dispatch_queue_length
- Add HPA/Cluster autoscaler rules with conservative thresholds and cool-down periods to avoid thrashing

Deployment considerations:
- Blue/green or canary deploys for backend releases to limit blast radius
- Warm-up traffic for new instances (avoid cold start penalties) — pre-warm caches where possible

Cost optimization:
- Right-size instance types based on benchmarked throughput
- Use spot instances for non-critical workers where preemption is tolerable

---

## 14.11 Observability & Performance Dashboards

Key dashboards:
- API latency and errors per endpoint (P50/P95/P99)
- Socket connections and emit latency heatmap
- Redis memory/ops and latency
- DB slow query dashboard (top 20 slow queries)
- Outbox backlog and worker processing rate

Instrumentation:
- Add metrics for application-level counters, histograms, and gauges via Prom-client
- Use tracing to capture end-to-end flows: ride request -> dispatch -> offer -> accept

---

## 14.12 Optimization Playbook (step-by-step)

1. Reproduce the issue locally with controlled load and tracing.
2. Identify hotspots via profiling (CPU, heap, event loop delay).
3. Trace slow request with OpenTelemetry to find external dependencies.
4. Optimize code paths: cache, memoize, or move heavy work to background worker.
5. Add appropriate indexes or rewrite queries; verify with EXPLAIN ANALYZE.
6. Re-run benchmarks and compare against baseline.
7. Deploy change to canary, monitor for regressions, and promote.

---

## 14.13 Testing & Verification

- Add performance tests to CI as smoke tests (e.g., k6 script that runs for 2–5 minutes)
- Enforce performance PSR (Performance Service Requirements) for critical PRs that touch hot paths
- Periodic load tests (weekly/monthly) to detect regressions and capacity drift

---

## 14.14 ADRs (Key Decisions)

1. Use Redis for ephemeral geospatial presence and caching
   - Why: low-latency operations and simple GEO commands are sufficient for MVP
   - Alternative: Dedicated geo-index store (deferred)

2. Use pg primary for canonical state and read replicas for reporting
   - Why: Keeps transactional correctness and offloads analytics queries

3. Integrate k6 and socket.io-client harness for load testing
   - Why: k6 is scriptable for HTTP and the Node harness allows realistic socket simulation

---

## 14.15 Readiness Checklist (Phase 14 complete)

- [x] Performance targets (API, socket, DB, mobile) defined
- [x] Benchmarking and profiling tools identified and scripts planned
- [x] Caching, DB indexing, and query optimization strategies documented
- [x] Autoscaling signals and initial capacity planning provided
- [x] Load testing plan and CI gating guidance included
- [x] Observability metrics and dashboards defined
- [x] Optimization playbook and testing guidance provided

Phase 14 is complete. Implementation of the performance plan (benchmarks, CI integration, instrumentation, and tuning) is the next step to validate and iterate on instance sizing and scaling rules.

