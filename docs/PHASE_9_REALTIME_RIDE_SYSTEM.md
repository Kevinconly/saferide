# Phase 9: Realtime Ride System - SafeRide Kigali

This document defines the realtime ride subsystem for SafeRide Kigali. It describes architecture, data flows, event contracts, state machine, scaling, security, testing, monitoring, and operational guidance required to implement production-grade realtime features: driver matching/dispatch, live ride updates, and presence.

Scope (MVP):
- Real-time driver presence and availability
- Dispatch / matching for one-driver-per-ride (no pooling)
- In-app live ride updates for driver and passenger
- Push notifications fallback via FCM
- Reliable message delivery and auditability

Deferred: pooling, predictive dispatch, complex multi-hop matching, vehicle routing optimization.

---

## 9.1 Goals and Non-Goals

Goals:
- Provide low-latency delivery of ride requests and ride state changes to the correct driver and passenger clients.
- Ensure correctness: only one driver can accept a ride; race conditions prevented.
- Support horizontal scaling of API and realtime servers.
- Provide robust recovery from partial failures and offline clients.
- Maintain an auditable trail of real-time events for debugging and dispute resolution.

Non-Goals (MVP):
- Full predictive matching or complex pooling algorithms.
- Persistent message queues external to Redis for long-term archival (events stored in DB/audit instead).

---

## 9.2 High-Level Architecture (ASCII)

Below is an ASCII diagram showing components and how they interact.

Mobile / Web Clients (Passengers & Drivers)
  ↕ (REST for CRUD, Socket.IO for realtime)
Nginx (TLS termination, routing, health)
  ↕
NestJS API & Socket.IO Gateways (multiple instances) -- Redis Adapter (pub/sub)
  ↕
Redis (pub/sub, ephemeral state, rate-limiting, locks)
  ↕
PostgreSQL (Prisma ORM)
  ↕
Background Workers (dispatch, outbox publisher, reconciliation) -> Redis / Postgres job tables
  ↕
Firebase Cloud Messaging (push fallback)

External Integrations: Google Maps for distance/ETA, Payment providers for payment events

Responsibilities:
- Mobile/Web Clients: render UI, send actions, open socket connection, receive events, show notifications
- Nginx: TLS, path-based routing, basic rate limiting and websocket proxying
- NestJS Socket.IO Gateways: authenticate socket handshakes, manage subscriptions, emit events
- Redis: store ephemeral presence, queues, distributed locks, and Socket.IO adapter for multi-instance pub/sub
- PostgreSQL: persistent canonical state (rides table), transactional outbox (events to publish), audit logs
- Background workers: run match algorithm, publish events reliably using transactional outbox pattern, handle retries
- FCM: push notifications when socket is unavailable

---

## 9.3 Architectural Principles Applied

- Keep canonical state in PostgreSQL (single source of truth) and ephemeral state in Redis.
- Use event-driven patterns for realtime delivery but ensure transactional guarantees via an outbox.
- Favor idempotent APIs and use idempotency keys for critical actor-triggered actions.
- Use Redis-based distributed locks and CAS for critical race conditions (e.g., ride assignment).
- Enforce strong authentication and per-socket authorization at handshake.
- Treat client-side checks as UX only — backend enforces business rules.

---

## 9.4 Ride Realtime State Machine (summary)

This complements the Ride Lifecycle from Phase 1. States (canonical):
- REQUESTED (passenger created ride request)
- MATCHING (system is finding a driver)
- OFFERED (a driver has been offered the ride, awaiting accept/reject)
- RESERVED (driver accepted, ride reserved)
- EN_ROUTE_TO_PICKUP
- ARRIVED_AT_PICKUP
- PICKED_UP
- EN_ROUTE_TO_DROPOFF
- COMPLETED
- CANCELLED
- FAILED

Transitions:
- REQUESTED -> MATCHING (immediate)
- MATCHING -> OFFERED (when dispatch selects a candidate driver)
- OFFERED -> RESERVED (on driver accept)
- OFFERED -> MATCHING (on driver reject or timeout)
- RESERVED -> EN_ROUTE_TO_PICKUP -> ARRIVED_AT_PICKUP -> PICKED_UP -> EN_ROUTE_TO_DROPOFF -> COMPLETED
- Any state -> CANCELLED (passenger or admin or system cancellation)
- RESERVED -> FAILED (assignment failure)

Invalid transitions must be rejected by backend and audited. Timeouts drive automatic transitions (e.g., OFFERED -> MATCHING after X seconds).

Recovery:
- When servers restart, background worker scans rides in MATCHING/OFFERED/RESERVED and reconciles with Redis presence state.
- Outbox events ensure missed realtime notifications are re-sent where appropriate.

---

## 9.5 Dispatch / Matching Design

MVP matching algorithm: proximity-first with configurable search radius and retry rounds.

Process (high level):
1. Passenger creates ride request (REQUESTED). API persists ride in PostgreSQL and inserts an outbox event (ride_requested).
2. Background dispatcher picks up ride_requested and begins MATCHING.
3. Dispatcher queries Redis for available drivers in geohash tiles within radius (drivers who are ONLINE and not currently RESERVED).
4. Dispatcher ranks candidates by distance and acceptance score (simple heuristic) and sends OFFERED events to top-N drivers sequentially or parallel with timeout.
5. Each OFFERED is published via Socket.IO event and an Outbox entry for reliability.
6. Driver accepts -> API attempts to transition ride to RESERVED using a distributed lock and DB transaction to ensure only one accept succeeds.
   - Implementation detail: use SELECT ... FOR UPDATE on the ride row or an application-level Redis lock keyed by ride:{id} to ensure atomicity.
7. On successful RESERVED, publish events to passenger and driver, cancel other offers and persist assignment.

Notes on timing and retries:
- OFFER timeout (configurable, e.g., 10s). After timeout, dispatch sends the next offer round.
- Max offer retries configurable (default 3 rounds). After exhaustion, system marks ride as FAILED or escalates to manual intervention.

Trade-offs:
- Using Redis for presence and quick geospatial lookup is low-latency and simple for MVP. For larger scale, consider a dedicated geospatial index (Elastic, Redis GEO with geohash precision tuning, or an in-memory k-d tree service).

---

## 9.6 Data Flow and Eventing

Canonical persistence: PostgreSQL (rides, offers, assignments, ride_events audit table, outbox table).

Reliable delivery pattern: Transactional Outbox
- Any write that must result in external side effects (emit socket event, call FCM, call external service) inserts a row into the outbox table as part of the same DB transaction.
- A background outbox worker reads pending outbox rows and delivers them (via Redis pub/sub -> Socket.IO publishers or FCM). On success marks them as delivered.
- This avoids lost events when process crashes after DB write but before emitting events.

Realtime delivery:
- Primary: Socket.IO emit to socket id(s).
- Secondary (fallback): FCM push notification to device token when socket not connected.

Audit trail:
- Persist every significant realtime event as ride_event: timestamp, actor (system, driver, passenger), event_type, payload, previous_state, new_state.

---

## 9.7 Socket.IO Design & API Contracts

Connection & Authentication:
- Client connects to Socket.IO with access token in the handshake `auth` payload: { token: <access_token> }.
- Server verifies token, extracts subject (userId) and role (driver|passenger|admin) and attaches it to socket.
- Socket namespaces or rooms: `/drivers`, `/passengers` or single namespace with rooms for ride:{rideId}, driver:{driverId}, passenger:{passengerId}.
- On connect, clients must register presence: emit `presence:online` with device metadata.

Events (direction: server -> client)
- `ride:offer` { rideId, pickup, dropoff, fareEstimate, expiresAt, offerId }
- `ride:assigned` { rideId, driverId, eta }
- `ride:update` { rideId, state, metadata }
- `ride:cancelled` { rideId, reason }
- `driver:location` { driverId, lat, lng, timestamp } (sent to passenger who has active ride)
- `system:alert` { message }

Events (client -> server)
- `ride:accept` { rideId, offerId, idempotencyKey }
- `ride:reject` { rideId, offerId }
- `ride:status` { rideId, newState, metadata }
- `driver:location` { lat, lng, timestamp } (frequent updates while active)
- `presence:online` / `presence:offline`

Event Formats: JSON, use typed DTOs and Zod schemas on server & client for validation.

Idempotency and deduplication:
- Actions that mutate state from clients (accept) must include an idempotencyKey. Server should persist idempotency keys for a limited window to avoid replays.
- Offer accept requests should be idempotent and return current reservation if already accepted by same driver.

Authorization rules:
- Only the driver who got an OFFER should be allowed to `ride:accept` that offer.
- Only authenticated passenger may cancel their ride.
- Backend must check role, ownership and state before applying transitions.

---

## 9.8 Concurrency Control & Correctness

To guarantee only one driver accepts a ride:
- Use DB transaction with SELECT FOR UPDATE on the ride row when processing accept. Steps:
  1. Begin transaction
  2. SELECT ride WHERE id = $id FOR UPDATE
  3. Check ride.state == OFFERED and offerId matches
  4. Update ride state to RESERVED and set driverId
  5. Insert ride_event and outbox entries
  6. Commit transaction
- Alternatively, use a Redis distributed lock (SETNX with TTL) to obtain assignment lock, then perform DB update.

Avoid long-running locks: keep critical transaction small.

---

## 9.9 Presence, Location, and Throttling

Presence:
- On socket connect, mark `driver:{driverId}` as ONLINE in Redis with lastSeen timestamp and socketId.
- On disconnect, remove or mark offline after grace period to avoid flapping on mobile networks.
- Use Redis TTL to auto-expire stale presence records.

Location updates:
- From driver: send frequent location updates (e.g., 1-5s while moving) but throttle server-side to a configurable rate (e.g., 1/s).
- Aggregate location updates for passenger by selecting periodic updates (e.g., every 2s) to avoid flooding.

Rate limiting:
- Rate-limit per-socket event emission and per-user actions using Redis token bucket pattern.
- Protect endpoints `ride:accept`, `ride:reject`, `driver:location` to prevent spam or abuse.

---

## 9.10 Resilience and Fallbacks

Socket disconnects:
- Attempt socket reconnection with exponential backoff on client.
- On server detect stale sockets and invalidate presence after grace TTL.
- If socket not connected when event must be delivered, queue event via outbox and send FCM push as fallback.

Server failure:
- Use transactional outbox to prevent event loss.
- Background reconciliation job scans offers that have expired or rides stuck in OFFERED and re-enters MATCHING.

Network partitions:
- For critical operations (accept), require DB transaction to succeed; if the dispatcher cannot reach DB, fail operation and notify user.

---

## 9.11 Scaling Strategy

Short-term (MVP):
- Scale NestJS API and Socket.IO Gateways horizontally behind Nginx/LB.
- Use Socket.IO Redis adapter so instances share events and rooms.
- Use Redis for ephemeral state (presence, locks, rate-limiting).

Medium-term:
- Deploy workers (stateless) for dispatch and outbox processing. Scale by queue length.
- Measure metrics and scale Redis up (memory, CPU) or split concerns (separate Redis clusters for pub/sub vs ephemeral data) if needed.

Long-term:
- Consider Kafka or managed streaming for high-throughput event buses and long-term event retention.
- Offload geospatial queries to a specialized service or spatially indexed DB.

Operational notes:
- Avoid sticky sessions; the Redis adapter removes the need for sticky sessions.
- Use connection limits per instance and horizontal autoscaling based on socket count metrics.

---

## 9.12 Observability and Monitoring

Metrics to collect:
- Active socket connections (total, by role)
- Events per second (emit/received)
- Offer acceptance latency (time from OFFER to accept)
- Dispatch queue length (rides awaiting matching)
- Outbox backlog
- Failed delivery rates (socket emits, FCM)
- Redis latency and operation errors

Logs & traces:
- Use structured logs with correlation IDs and rideId for all realtime operations.
- Instrument critical flows with distributed tracing (OpenTelemetry) to trace from HTTP request -> outbox -> socket emit.

Alerts:
- High outbox backlog
- High offer fail/timeout rate
- Redis errors or high latency
- Surge in disconnected sockets

Dashboards:
- Realtime health overview with connection counts and dispatch metrics
- Per-region matching success and latency

---

## 9.13 Security Considerations (realtime-specific)

- Authenticate socket handshake using short-lived access tokens (JWT) and validate signature & claims.
- Authorize per-event: server must check user role and ownership before emitting or applying transitions.
- Use TLS for Socket.IO (wss) and REST.
- Rate-limit expensive actions per-driver and per-IP.
- Protect against replay by using idempotency keys and limiting the window in which keys are valid.
- Sanitize event payloads before logging. Avoid logging PII.
- Apply CSP and other headers at Nginx level for web clients.

GPS spoofing and trust:
- Implement anti-spoof heuristics: unrealistic jumps, improbable speeds, inconsistent timestamps.
- Flag suspicious data for manual review, do not auto-punish drivers without review.

---

## 9.14 Testing Strategy

Unit tests:
- Gateways: handshake auth, basic routing, DTO validation
- Dispatch logic: candidate selection, ranking heuristics
- Outbox worker: mark delivered, retry logic

Integration tests:
- Simulate multiple sockets with socket.io-client to test offer -> accept race conditions
- Test reconnection and presence handling
- Test outbox + emit end-to-end using test Redis and Postgres

Load and chaos testing:
- Emulate tens of thousands of concurrent sockets connecting, disconnecting, and receiving events.
- Introduce network partitions and measure recovery.

Security testing:
- Penetration tests targeting socket auth, token replay, and rate-limiting bypass.

---

## 9.15 Operational Playbooks

Offer timeout and retry playbook:
- If a ride remains in MATCHING for > configured threshold (e.g., 60s) escalate to manual review or allow passenger to cancel.

Outbox failure:
- If outbox worker fails to deliver an event, retry exponential backoff, alert on > N failures, and surface to on-call.

Redis outage:
- If Redis is unavailable, system should reject new MATCHING attempts and respond with transient failure to callers. Notify ops and switch to read-only mode for presence.

---

## 9.16 ADRs (Summary of key decisions)

1. Use Socket.IO + Redis adapter
   - Why: mature ecosystem, supports rooms, reconnection, and easy horizontal scaling.
   - Alternative: raw WebSocket or managed pub/sub. Trade-off: Socket.IO provides higher-level features; small overhead acceptable for MVP.

2. Transactional Outbox (Postgres) for reliable event delivery
   - Why: guarantees events are not lost and keeps DB as single source of truth for state and events.
   - Alternative: immediate emit without outbox (risk lost events), or external queue (adds dependency). Outbox chosen for correctness and simplicity.

3. Dispatcher as background worker
   - Why: decouples matching from request latency and allows controlled retries and backoff.
   - Alternative: synchronous matching in request thread (blocks client and harder to scale).

---

## 9.17 MVP Scope Validation

Included:
- Socket.IO gateways with auth
- Redis adapter, presence, and driver availability
- Background dispatcher with outbox-based event publishing
- Strict DB transaction on accept to prevent double-assign
- FCM fallback and audit trail

Deferred:
- Advanced pooling, predictive matching, ML-based ranking
- Geo-indexing beyond Redis GEO or Postgres ST_DWithin optimization for large scale

---

## 9.18 Readiness Checklist (Phase 9 complete)

- [x] Realtime architecture defined and aligned with backend and mobile design
- [x] Ride realtime state machine specified with timeouts and recovery rules
- [x] Dispatch/matching algorithm and failure modes documented
- [x] Socket.IO event contracts and handshake auth defined
- [x] Concurrency control, idempotency, and outbox pattern specified
- [x] Scaling strategy and Redis adapter decision recorded in ADRs
- [x] Security, testing, monitoring, and operational playbooks included

Phase 9 is ready. Implementation can begin after the backend foundation (Phase 5), auth (Phase 4), and driver/passenger app skeletons (Phases 7/8) are scaffolded.

