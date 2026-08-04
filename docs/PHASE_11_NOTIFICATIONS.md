# Phase 11: Notifications - SafeRide Kigali

This document describes the Notifications subsystem for SafeRide Kigali. It covers design, delivery channels, templates, reliability, privacy/compliance, throttling, observability, testing, and operational playbooks required to deliver in-app, push, and fallback notifications for riders, drivers, and admins.

Scope (MVP):
- Firebase Cloud Messaging (FCM) push notifications for mobile apps (passenger & driver)
- In-app notification center for mobile and web/admin dashboard
- Server-side notification service with transactional outbox pattern for reliable delivery
- Device token management, opt-in/opt-out, basic rate-limiting and batching
- Localization and templating for common notification types (ride events, offers, verification, payments)

Deferred (future):
- Email and SMS delivery channels (plan and adapters included but implementation deferred)
- Advanced notification personalization & ML-driven recommendations
- Cross-channel orchestration engine and user-level suppressions beyond MVP

---

## 11.1 Goals and Non-Goals

Goals:
- Deliver timely and reliable push notifications for critical events (ride offers, assignment, cancellations, payment updates).
- Provide in-app notification history and clear UX for notification actions.
- Ensure privacy, consent, and rate-limiting to avoid spamming users.
- Maintain observability of notification delivery, failures, and device token health.

Non-Goals (MVP):
- Fully customizable end-user preference UI for every notification type (basic preferences only)
- Multi-provider fallback for push (FCM only in MVP)

---

## 11.2 High-Level Architecture (ASCII)

Mobile Apps (Passenger & Driver) <-> NestJS API & Notification Service <-> FCM
                     |                                      ↕
                     |                                      Redis (rate-limit, queues)
                     ↕
                 PostgreSQL (payments, rides, users, notification_events/outbox)
                     ↕
             Admin Dashboard (Next.js) / Background Workers

Responsibilities:
- Mobile: register tokens, receive push, show in-app notifications, open deep links
- Notification Service: produce notifications (from events or API), enqueue outbox rows, send to FCM, manage retries
- Outbox Worker: read outbox, publish to FCM and mark delivered, push delivery receipts to audit
- DB (notifications table): canonical history for in-app display and audit
- Redis: rate-limiting, throttling, deduplication, transient device status

---

## 11.3 Notification Types and Priority

Priority levels:
- HIGH (time-sensitive): ride:offer, ride:assigned, ride:cancelled, safety alerts
- MEDIUM: payment:confirmed, payout:available, verification:approved
- LOW: promotional (deferred), system announcements

MVP supported types (examples):
- ride:offer (HIGH)
- ride:assigned (HIGH)
- ride:update (MEDIUM)
- ride:cancelled (HIGH)
- auth:otp (HIGH) — OTP delivery may use SMS provider (deferred) but push notifications can be used for fallback UX
- payment:confirmed (MEDIUM)
- payout:processed (MEDIUM)
- system:maintenance (LOW)

Each notification has metadata: target (userId or device tokens), channelPreference, locale, payload, deeplink, priority, timeToLive.

---

## 11.4 Device Token & Registration Model

Device tokens table (core fields):
- id (uuid)
- user_id (nullable) — link to user when logged in
- device_platform (ANDROID | IOS | WEB)
- fcm_token (text)
- fcm_token_hash (sha256) — for lookups and to avoid storing raw token in logs
- last_seen_at
- is_active boolean
- app_version
- locale
- created_at, updated_at

Registration flow:
1. App obtains FCM token and posts to `POST /devices` with device metadata and idempotency key.
2. Server validates, stores token (or updates existing), and marks it active.
3. On logout, app calls `DELETE /devices/{id}` or server clears link and optionally deactivates token.
4. On invalid FCM response (e.g., Unregistered), background worker marks token inactive.

Security:
- Only authenticated users may register tokens linked to user_id.
- Validate tokens format and perform rate-limited registration to prevent abuse.
- Mask tokens in logs; store hash for lookup and deduplication.

---

## 11.5 Notification Data Model

notifications
- id (uuid)
- user_id nullable
- device_id nullable
- channel (FCM | IN_APP | EMAIL | SMS)
- type (string)
- priority (HIGH|MEDIUM|LOW)
- title (text)
- body (text)
- payload (jsonb) — structured payload with deeplink and context
- status (PENDING|SENT|DELIVERED|FAILED|ACKNOWLEDGED)
- attempts integer
- first_attempted_at
- last_attempted_at
- created_at, updated_at

notification_templates
- id
- name
- locale
- channel
- title_template
- body_template
- variables jsonb
- created_at, updated_at

notification_outbox (transactional outbox)
- id
- aggregate_type (e.g., ride)
- aggregate_id
- event_type
- payload
- status
- attempts
- created_at

notification_events (audit)
- id
- notification_id
- event (enqueued, sent, delivered, failed, ack)
- meta jsonb
- created_at

Indexes & retention:
- Index on notifications(user_id, status)
- TTL or archiving for old notifications to S3 if beyond retention window
- Retain audit logs for compliance window

---

## 11.6 Notification Production Patterns

1. Event-driven notifications
   - Application code writes domain events (ride:offered, ride:assigned, payment:confirmed) and inserts a notification_outbox row in same DB transaction (or a generic outbox with notification payload).
   - Outbox worker reads and attempts delivery to FCM and writes notification rows for in-app persistence.

2. API-initiated notifications
   - Admin triggers a notification via the Dashboard API which inserts notification_outbox row and persists target notifications.

3. Throttling & grouping
   - For frequent events (e.g., driver location), do NOT send push per update. Use ride:update aggregated events for passengers with rate-limits (e.g., every 2s) and in-app streaming via Socket.IO for high-frequency updates.

4. Template rendering
   - Render templates server-side with variables and locale before enqueueing to outbox.
   - Store variable set with notification for later audit and to enable re-rendering if needed.

---

## 11.7 FCM Integration Details

Auth & setup:
- Use a dedicated Firebase service account key for each environment (dev/staging/prod). Store in secrets manager.
- Use the FCM HTTP v1 API for sending messages with robust responses.

Message types:
- Notification messages (title & body) — visible to users
- Data messages — silent deliveries used for background sync or in-app logic

Delivery & TTL:
- Set message priority based on notification priority (HIGH -> high priority, MEDIUM/LOW -> normal)
- Use TTL based on event (e.g., ride:offer TTL = offer timeout + buffer)

Error handling:
- Handle responses such as Unregistered, InvalidArgument, NotRegistered, QuotaExceeded
- On Unregistered/NotRegistered mark token inactive and notify user device record

Batching & rate limits:
- Use FCM batch endpoints where possible to reduce API calls
- Respect FCM rate limits: implement per-service account rate limiting and backoff

---

## 11.8 In-app Notification Center

- Fetch notifications via `GET /notifications?userId=...` with pagination (cursor-based) and filtering by status.
- Mark notification read/ack via `POST /notifications/{id}/acknowledge` which updates status and sets acknowledged_at.
- Provide a light-weight feed UI for admin and users with category filters (Ride, Payment, System).
- Use optimistic updates for read status and notify server asynchronously.

Security & privacy:
- Only return notifications belonging to authenticated user or admin with permission.
- Redact sensitive content in previews and logs.

---

## 11.9 User Preferences & Consent

- Minimal MVP preferences:
  - push_enabled (boolean) per device
  - in_app_enabled (boolean)
  - high_priority_only (for users who opt-out of promos)
- Consent and privacy:
  - On first-run, show a concise disclosure about notifications and what they are used for
  - Respect OS-level notification permissions; do not assume presence of token means consent
  - Allow users to revoke consent via settings and support remote token invalidation

---

## 11.10 Rate Limiting, Deduplication & Backpressure

- Use Redis token bucket per user and per device for outbound notifications (e.g., N per minute)
- Deduplicate notifications by computing a content hash and using a short-lived de-dup key in Redis to prevent repeated identical notifications
- For spikes (e.g., system alert), implement backpressure: collapse low-priority messages into a single summary message

---

## 11.11 Delivery Guarantees & Retries

- Best-effort delivery: pushes may be dropped by platform or device; outbox/retries try to ensure delivery
- Retries:
  - Exponential backoff for transient FCM errors with cap (e.g., 5 attempts)
  - Permanent errors (InvalidArgument, NotRegistered) mark token inactive and do not retry
- Delivery receipts:
  - FCM provides accepted/not-accepted; device-level ACKs should be tracked via in-app ack endpoints for definitive read status

---

## 11.12 Observability & Monitoring

Metrics:
- Notifications enqueued per minute (by type & priority)
- Send success rate (FCM accepted) and failure rate
- Outbox backlog
- Device token churn (registrations/unregistrations)
- Notification latency (enqueue -> send)

Logs & Tracing:
- Correlate notification events with ride/payment ids via correlation_id
- Use structured logs and OpenTelemetry traces across production flows (API -> outbox -> FCM)

Alerts:
- High outbox backlog
- Surge in Unregistered notifications
- Spike in FCM errors or rate-limited responses

Dashboards:
- Delivery health dashboard showing send rate, success %, and per-provider metrics

---

## 11.13 Security Considerations

- Secrets & keys: store Firebase service account JSON in secrets manager and limit access
- Token safety: store only token hashes where possible, never export raw tokens in logs
- Authorization: only backend services and authorized admins should be able to send system notifications
- Protect endpoints: use CSRF protections for web, require auth for admin APIs, rate-limit notification creation
- Avoid leaking PII in notification text — prefer minimal content and deep links that require auth to access details

---

## 11.14 Testing Strategy

Unit tests:
- Template rendering with variables and locale
- Device token registration and deactivation logic
- Rate-limiting and deduplication utilities

Integration tests:
- End-to-end outbox -> FCM mock flow with success and failure scenarios
- Device registration and retrieval APIs

E2E tests:
- Simulate push reception flows using Firebase test clients or emulators and verify in-app notification storage and ack

Security testing:
- Validate access control and ensure only authorized callers can enqueue notifications

---

## 11.15 Operational Playbooks

Token invalidation:
- When high Unregistered errors for a token appear, mark token inactive and notify user at next login

Outbox backlog alert:
- If outbox backlog exceeds threshold, scale workers and investigate failing provider calls

Spam or abuse detection:
- If a user receives many notifications in short time, automatically apply throttling and create an incident for manual review

---

## 11.16 ADRs (Key Decisions)

1. Use FCM as primary push provider
   - Why: FCM supports both Android and iOS (via APNs), is well-integrated, and is already specified in the tech stack.
   - Alternatives: direct APNs integration + other providers (adds complexity). FCM chosen for unified handling.

2. Transactional Outbox pattern for notifications
   - Why: ensures reliable delivery and avoids lost notifications when app/server crashes after DB writes.
   - Alternative: immediate sends without outbox (fragile). Outbox chosen for reliability.

3. Keep in-app notifications persisted in Postgres
   - Why: provides canonical history, easy querying, and audit compliance.
   - Alternative: use only ephemeral Redis (not auditable). Postgres chosen for audit and persistence.

---

## 11.17 MVP Scope Validation

Included:
- FCM push infrastructure with token lifecycle management
- Notification service with transactional outbox and background delivery worker
- In-app notification center and basic user preferences
- Rate-limiting, deduplication, and retries
- Observability and operational playbooks

Deferred:
- SMS & Email channels (planned adapters included but not implemented)
- Advanced user-level suppression and ML personalization

---

## 11.18 Readiness Checklist (Phase 11 complete)

- [x] Notification architecture defined (FCM + in-app)
- [x] Data models and outbox pattern specified
- [x] Device token lifecycle and security defined
- [x] Templates, localization, and priority model specified
- [x] Rate-limiting and deduplication strategies included
- [x] Observability, testing, and operational playbooks documented

Phase 11 is complete and ready for implementation.

