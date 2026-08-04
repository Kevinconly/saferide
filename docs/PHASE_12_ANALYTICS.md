# Phase 12: Analytics - SafeRide Kigali

This document defines the Analytics and Observability strategy for SafeRide Kigali. It covers events and metrics design, telemetry pipeline, dashboards, alerting, retention, compliance, sampling, instrumentation guidance for backend and mobile apps, and operational playbooks required to provide actionable insights and SRE-grade monitoring.

Scope (MVP):
- Business KPIs: rides, completed rides, cancellations, GMV, conversion rates
- Operational metrics: API latency, error rates, socket connections, dispatch latency
- Instrumentation: structured logging, traces, metrics, and user events
- Dashboards & alerts using Prometheus + Grafana, Loki, Sentry for errors
- Lightweight event pipeline for product analytics (user funnel, retention) using ClickHouse/BigQuery (deferred to vendor if needed)

Deferred: full data warehouse implementation and advanced ML pipelines (planned in roadmap).

---

## 12.1 Goals and Non-Goals

Goals:
- Provide real-time operational monitoring and near-real-time business analytics for decision making.
- Instrument applications sufficiently to detect incidents quickly and support post-incident analysis.
- Ensure observability is privacy-aware and cost-effective for MVP.

Non-Goals:
- Building advanced ML-driven analytics in MVP.
- Storing raw PII in analytics stores beyond necessary hashed identifiers.

---

## 12.2 High-Level Analytics Architecture (ASCII)

Applications (NestJS, Next.js, React Native) ->
  ├─ Structured Logs -> Loki
  ├─ Metrics (Prometheus client) -> Prometheus -> Grafana
  ├─ Traces (OpenTelemetry) -> OTLP Collector -> Jaeger/Tempo or vendor
  └─ Events (analytics) -> Kafka/Stream (optional) -> Event Processor -> Analytics Store (ClickHouse/BigQuery)

Sentry (errors & performance) receives SDK events from apps and backend.

Responsibilities:
- Applications: emit metrics, traces, structured logs, and analytics events with consistent schemas.
- OTLP Collector: collect, batch, and forward traces and metrics.
- Prometheus: scrape metrics endpoints and store time series.
- Grafana: dashboards and alert rules.
- Loki: store structured logs for troubleshooting with correlation IDs.
- Analytics Store: run aggregate queries for product metrics and reporting.

---

## 12.3 Telemetry Types and What to Collect

1. Metrics (prometheus style)
   - High cardinality avoided in Prometheus; use labels selectively.
   - Examples:
     - api_http_requests_total{method, path, status}
     - api_http_request_duration_seconds_bucket{path, method}
     - socket_connections_total{role}
     - dispatch.offer_latency_seconds
     - dispatch.matching_queue_length
     - payments.processed_total{provider, status}
     - notifications.sent_total{channel, status}
     - driver_location_updates_total
     - db_query_duration_seconds{query_type}

2. Traces (OpenTelemetry)
   - Instrument critical flows: request -> DB -> outbox -> emit
   - Trace spans for external calls (provider API, FCM), DB transactions, and long-running jobs (dispatcher)
   - Capture trace attributes: rideId, paymentId, driverId (hashed), region

3. Logs (structured JSON)
   - Include correlation_id and trace_id in each log
   - Log levels: DEBUG (local/dev), INFO (business events), WARN, ERROR
   - Avoid logging PII; mask sensitive fields

4. Events (Product analytics)
   - High-cardinality user events: ride_requested, ride_accepted, ride_completed, otp_sent, payment_attempt, payment_success
   - Include minimal identity: hashed_user_id, anonymous_id, timestamp, properties
   - Use event pipeline (Kafka/stream) for ingestion into analytics store

---

## 12.4 Naming Conventions and Schema

- Metric names: <service>_<domain>_<name>_total / _seconds (histograms)
  - e.g., api_requests_total, dispatch_offer_latency_seconds
- Labels: avoid user identifiers as labels; use role, region, status, provider
- Event names (analytics): lower_snake_case verbs: ride_requested, ride_matched, payment_confirmed
- Trace attributes: use stable attribute names: ride.id, payment.id, driver.id (hashed), user.id (hashed)

Schema governance:
- Maintain a central telemetry schema repository (`/docs/telemetry_schema.md` or `packages/telemetry/`) with types and examples.
- Enforce schema via typed client wrappers and CI checks.

---

## 12.5 Instrumentation Guidelines

Backend (NestJS):
- Use OpenTelemetry Node SDK with NestJS instrumentation for HTTP and DB.
- Expose metrics at `/metrics` endpoint for Prometheus scraping.
- Use Prom-client for custom metrics and histograms.
- Use structured logging library (pino or winston with pino-pretty in dev) configured to JSON in production.
- Attach correlation_id (UUID) at request start; propagate to logs and child spans.

Frontend (Next.js):
- Instrument page load times and key user interactions via web vitals.
- Send errors to Sentry and events to analytics pipeline.

Mobile (React Native):
- Use Sentry mobile SDK for crash and performance monitoring.
- Emit key product events (ride_requested, offer_received, ride_started) to analytics (batching to conserve battery/data).

Common SDKs & wrappers:
- Provide shared telemetry client packages in monorepo for consistent usage across services.
- Validate at build-time where possible (types for event payloads).

---

## 12.6 Metrics, Dashboards, and Alerts

Dashboards (Grafana) recommended list:
- Overview / SRE dashboard: API latency (P50/P95/P99), error rates, CPU/RAM, Redis latency, DB connections
- Realtime health: socket connections, offers/sec, accept latency, dispatch queue length
- Payments dashboard: payment attempts, successes, provider errors, reconciliation variance
- Admin operations: audit log rates, admin actions per minute
- Business KPIs: rides/day, completed_rate, cancellations_rate, GMV, ARPU

Alerting (Prometheus Alertmanager):
- High-priority
  - api_error_rate > 1% sustained for 5m on critical endpoints
  - dispatch.offer_timeout_rate > threshold
  - redis_down or high latency
  - outbox backlog > threshold
- Medium-priority
  - increase in 5xx for non-critical endpoints
  - payment provider auth failures
- Low-priority
  - elevated 4xx from clients (may be client or integration issue)

Alert practices:
- Give runbooks for each alert with steps to diagnose and remediation steps.
- Use paging for P1/P0 alerts and Slack for lower-priority notifications.

---

## 12.7 Analytics Event Pipeline (MVP)

Design options:
- Lightweight: Use server-side batched uploads to a managed analytics service (e.g., PostHog, Amplitude, or Snowplow). Cheaper: export to BigQuery via Google Pub/Sub.
- Self-hosted: Kafka -> stream processors -> ClickHouse/ClickHouse cloud

MVP recommendation:
- Use a managed analytics store (BigQuery or ClickHouse cloud) with a small Kafka-like buffer (Cloud Pub/Sub or Kinesis) or use an open-source lightweight queue.
- Implement a server-side event collector that accepts typed events, validates via schema, and writes to a durable queue/outbox. Another worker drains queue to analytics store in batches.

Privacy and sampling:
- Apply sampling for high-volume low-value events (e.g., driver location) before ingestion.
- Hash PII identifiers before sending to analytics.

---

## 12.8 Data Retention, Privacy, and Compliance

Retention policies:
- Metrics: retain full-resolution metrics for 30 days, downsampled for 1 year
- Logs: keep hot logs for 30 days in Loki, archive older logs to S3 for 3+ years (compliance)
- Analytics raw events: retain for 1 year by default, configurable per regulation
- Payment and audit logs: retain for regulatory window (e.g., 7 years)

Privacy:
- Do not store raw personal data in analytics buckets; use hashed/opaque identifiers
- Support data deletion requests: ensure data pipelines respect deletion — provide mechanisms to delete user data from analytics/warehouse per GDPR-like requirements

Access controls:
- Apply role-based access to analytics and dashboards
- Use read-only queries for non-admin analysts

---

## 12.9 Data Quality and Governance

- Central telemetry schema repository enforce via CI checks (linting event schemas, tests)
- Create data contracts between producers and consumers; use sample test harnesses
- Monitor data drift (schema changes, missing events)
- Track event delivery success metrics and backlog

---

## 12.10 Observability for Realtime Components

Realtime-specific metrics:
- socket_connections_total{role}
- socket_reconnects_total
- offers_sent_total, offers_accepted_total, offers_timeout_total
- dispatch_latency_seconds (time from REQUESTED -> OFFER sent)
- presence_count{region}

Use traces to debug long flows: passenger request -> persistence -> dispatch -> socket emit -> driver accept

---

## 12.11 Testing Strategy

Unit & Integration:
- Test metric emission code for proper labels and values
- Test event validation and schema enforcement
- Test trace propagation across request handlers and background workers

Load testing:
- Simulate production-like event rates for metrics, logs, and analytics ingestion

Data validation:
- Nightly data quality checks: counts of key events vs expected ranges (e.g., rides_started ≈ rides_completed within expected ratio)

---

## 12.12 Operational Playbooks

Incident: spike in 5xx errors
- Check Grafana for error rate and affected endpoints
- Check recent deployments and roll back if correlated
- Use tracing to find slow external dependency

Incident: dispatch offer latency high
- Inspect dispatch worker logs and queue backlog
- Scale dispatch workers or restart if stuck

Data pipeline stuck (analytics backlog)
- Check ingestion worker logs and queue length
- Temporarily pause non-essential event emission or increase worker capacity

---

## 12.13 Tooling and Vendor Choices

MVP recommended stack:
- Metrics: Prometheus
- Dashboards & Alerts: Grafana + Alertmanager
- Logs: Loki
- Traces: OpenTelemetry -> Tempo/Jaeger or vendor like Honeycomb
- Error tracking: Sentry
- Analytics store: BigQuery (managed) or ClickHouse (self-hosted) depending on cost
- Event buffer: Pub/Sub/Kinesis/Kafka (managed) or small Redis Stream for MVP

Trade-offs:
- Managed services reduce ops cost and accelerate insights; self-hosted offers cost control but increases operational burden.

---

## 12.14 ADRs (Key Decisions)

1. Use Prometheus + Grafana for metrics
   - Why: proven SRE ecosystem; aligns with stack requirements
   - Alternative: vendor APM (costly)

2. Use OpenTelemetry for tracing
   - Why: vendor-agnostic and supports distributed traces across services

3. Managed analytics store (BigQuery) for MVP
   - Why: fast iteration, minimal ops; allows SQL queries for product analytics without complex infra

---

## 12.15 Readiness Checklist (Phase 12 complete)

- [x] Telemetry types (metrics, logs, traces, events) specified
- [x] Metric naming and schema governance defined
- [x] Instrumentation guidance for backend, frontend, and mobile completed
- [x] Dashboards and alerting strategy defined
- [x] Analytics event pipeline and storage recommendations provided
- [x] Data retention, privacy, and governance policies included
- [x] Testing and operational playbooks included

Phase 12 is complete and ready for implementation.

