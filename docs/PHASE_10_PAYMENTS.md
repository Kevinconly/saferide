# Phase 10: Payments - SafeRide Kigali

This document defines the Payments architecture and operational design for SafeRide Kigali. It covers integration with MTN MoMo and Airtel Money for MVP mobile money payments, a design for future bank/card payments, reconciliation, refunds, security, compliance, testing, monitoring, and operational playbooks.

Scope (MVP):
- Accept payments via MTN MoMo and Airtel Money for ride fares
- Reliable webhook handling and confirmation of payment events
- Reconciliation and settlement bookkeeping for driver payouts
- Refunds and dispute workflows
- Idempotent, secure, auditable payment flows

Deferred: full PCI-DSS scoped card processing (only planned, not implemented in MVP), escrow accounts, instant payouts via third-party providers.

---

## 10.1 Goals and Non-Goals

Goals:
- Provide secure, reliable payment capture and reconciliation for rides in Kigali.
- Ensure idempotent processing of provider callbacks and robust error handling.
- Minimize financial risk, prevent fraud, and produce auditable logs for compliance.

Non-Goals (MVP):
- Handling direct bank ACH transfers or full card tokenization/PIN flows. Those are planned for a later phase with PCI-DSS compliance.

---

## 10.2 High-Level Architecture (ASCII)

Client (Passenger Mobile App / Web)
  ↕ (REST HTTPS)
Nginx -> NestJS API (payments module)
  ↕
Payment Providers: MTN MoMo API, Airtel Money API
  ↕
Webhook endpoints -> NestJS (idempotent processing) -> PostgreSQL (payments, transactions, outbox)
  ↕
Redis (rate-limiting, transient state)
  ↕
Background Workers (reconciliation, payout scheduling) -> DB / Outbox
  ↕
Accounting / Admin Dashboard (Next.js) for reconciliation and dispute handling

External systems:
- MTN MoMo: payment authorization and callback
- Airtel Money: similar
- Optional: Payment gateway for card (deferred)

---

## 10.3 Payment Flows

Two primary flows:
A. Passenger-initiated payment (on-demand immediate capture)
B. Provider callback verification (webhook-driven) and confirmation

A. Passenger-initiated payment (example using mobile-money USSD/API flow):
1. Passenger chooses payment method and initiates payment in app.
2. Backend creates a `payment_intent` record (payments table) with idempotency key, amount, currency, rideId, metadata, status=PENDING.
3. Backend calls provider API to initiate collection (provider-specific payload). All provider API requests record an outbox entry in DB within the same transaction.
4. Provider may respond synchronously (success/fail) or initiate an async flow where provider triggers webhook to notify success/failure.
5. On provider confirmation (webhook or sync success), backend validates webhook signature, updates payment record to SUCCESS, marks ride as PAID, and triggers downstream processes (payout accounting, receipt generation).
6. If provider reports failure, backend marks payment FAILED and surfaces to UI and admin for retry or manual resolution.

B. Provider callback verification and idempotency:
- Webhooks must be authenticated (HMAC with shared secret, mutual TLS if available, or provider-signed tokens).
- On webhook receipt, the endpoint must:
  1. Validate signature and timestamp
  2. Check idempotency using provider transaction id and internal idempotency key
  3. Load related payment_intent using provider_reference or idempotency key
  4. In a DB transaction, update payment state, create audit log, insert outbox row to notify other systems, and commit.
- If webhook processing fails, respond with non-2xx to prompt provider retries. Ensure processing is idempotent to handle retries.

---

## 10.4 Data Model (core tables)

payments
- id (uuid)
- ride_id (uuid) nullable
- amount_cents (integer)
- currency (text)
- provider (enum: MTN_MOMO, AIRTEL_MONEY, CARD)
- provider_reference (text) -- unique provider transaction id
- idempotency_key (text) -- client-supplied or server-generated
- status (enum: PENDING, PROCESSING, SUCCESS, FAILED, REFUNDED)
- metadata (jsonb)
- created_at, updated_at
- processed_at

payment_events / payment_audit
- id
- payment_id
- event_type (created, initiated, webhook_received, confirmed, failed, refunded)
- payload (jsonb)
- created_at

payment_outbox
- id
- aggregate_type (payment)
- aggregate_id
- event_type
- payload (jsonb)
- delivered_at nullable
- attempts integer
- created_at

driver_payouts
- id
- driver_id
- period_start, period_end
- gross_amount_cents
- commission_cents
- net_amount_cents
- status (PENDING, SCHEDULED, PAID)

reconciliation_reports
- id
- period
- provider
- expected_amount_cents
- provider_reported_amount_cents
- variance_cents
- status

Constraints & Indexes:
- Unique index on payments(provider, provider_reference)
- Index on payments(ride_id)
- Partial indexes on payments(status)
- Index on payment_outbox(delivered_at)

Retention & archiving:
- Keep full payment history and audit logs for regulatory retention period (configurable, e.g., 7 years for financial records). Use cold storage (S3) for archival and purge policies for PII per legal requirements.

---

## 10.5 Provider Integrations - Details

MTN MoMo
- Integration mode: Use the MTN MoMo Collection API for mobile money collections.
- Authentication: OAuth2 client credentials (rotate secrets). Validate scopes and store secrets in secrets manager.
- Webhooks: validate HMAC signature (provider docs). Enforce strict clock skew windows.
- Timeouts & retries: follow provider retry semantics. Use idempotency for all API calls.
- Failure modes: provider downtime, delayed callbacks, partial failures; reconcile via provider transaction reports.

Airtel Money
- Similar approach to MTN MoMo. Confirm Airtel's callback signing mechanism and adapt verification logic.

Card payments (future)
- Plan for a PCI-DSS compliant integration with a hosted payment page or tokenization provider (Stripe, Adyen, etc.).
- Do NOT store raw card data in our systems.
- For future implementation, move to a separate, PCI-scoped microservice or use third-party PCI-certified provider.

---

## 10.6 Security & Compliance

Authentication & secrets
- Store provider API keys and webhook secrets in a secrets manager.
- Use environment-specific secrets and do not commit keys to source control.
- Enforce RBAC for admin access to financial endpoints.

Webhook security
- Validate signatures, timestamps, and IP allowlists if provider supports.
- Respond with appropriate 2xx only after idempotent and durable DB commit.

Idempotency
- Use idempotency keys for all client-initiated payment requests.
- Persist provider transaction ids and enforce uniqueness constraints in DB.

Data minimization & PII
- Only store the minimum necessary payment metadata.
- For driver and passenger PII, follow data retention policies; mask sensitive fields in logs.

PCI & Financial Compliance
- For mobile-money, ensure contractual and operational controls for handling funds.
- For card payments (deferred), ensure PCI-DSS compliance, scoped network segmentation, and external audit.

Fraud & Anti-Money Laundering (AML)
- Implement basic fraud heuristics: velocity checks, unusual payment patterns, or suspicious accounts.
- Escalate suspicious transactions for manual review and possible holds.

---

## 10.7 Reconciliation and Settlement

Reconciliation pipeline
- Daily automated reconciliation job fetches provider settlement reports (if available) and compares against recorded payments in DB.
- Produce reconciliation_report rows with variance and attach provider report payloads.
- Any variance above threshold triggers investigation alert.

Driver payouts
- Maintain driver_payouts table with scheduled payout runs (e.g., weekly/daily configurable).
- Payout calculation: sum completed rides net of platform commission, adjustments, refunds, and taxes.
- Payout execution: manual in MVP or integrated with payment provider for instant payouts (deferred).

Auditability
- Keep immutable payment_events/audit entries for every state change.
- Store provider webhook payloads in raw form (secure storage) for troubleshooting.

---

## 10.8 Refunds and Dispute Handling

Refund flow
1. Admin or automated rule initiates refund for a payment.
2. Create a refund record linked to payment_id with idempotency key.
3. Call provider refund API (if supported) or create an internal refund scheduled adjustment and mark in records.
4. On provider confirmation, update payment and refund status and record payment_event.

Dispute flow
- Support disputes originating from passengers or provider chargebacks.
- Create dispute record with references to ride, payment, audit logs, and evidence.
- Allow admins to resolve with refund/partial refund or reject with reasons.

---

## 10.9 Webhook Handling and Idempotency

Webhook receiver responsibilities:
- Authenticate and validate payload
- Use provider_reference as idempotency key: if an identical provider_reference was processed, reply 200 and do not duplicate effects.
- Process within DB transaction: update payment, insert payment_event, insert outbox row for downstream notifications.
- On transient failure, respond 5xx so provider retries; ensure retries are idempotent.

Resilience:
- Log raw webhook payloads to an append-only store for post-mortem.
- Maintain metrics for webhook latency and error rates.

---

## 10.10 API Contracts (selected endpoints)

- POST /payments/intents
  - Create a payment_intent for rideId, amount, provider, idempotencyKey
  - Response: 201 with payment intent details and next action (need_provider_interaction)

- POST /payments/{paymentId}/confirm
  - For synchronous provider flows to confirm status (idempotent)

- POST /webhooks/mtn-momo
  - Provider callback endpoint (validate signature)

- POST /webhooks/airtel-money
  - Provider callback endpoint

- GET /payments/{paymentId}
  - Retrieve payment status (only authorized by owner or admin)

- POST /payments/{paymentId}/refunds
  - Initiate refund (admin or customer support flow)

Ensure strong validation, DTOs, and precise HTTP status codes.

---

## 10.11 Observability and Monitoring

Metrics:
- Payment intents created per minute
- Successful payments per provider
- Webhook processing latency and failure counts
- Outbox backlog for payment events
- Reconciliation variance rate

Logs:
- Structured logs with correlation_id (rideId/paymentId)
- Mask sensitive data

Alerts:
- Webhook failure surge
- Reconciliation variance above threshold
- Provider API auth failures or 5xx spikes

---

## 10.12 Testing Strategy

Unit Tests:
- Payment service logic, idempotency handling, DB transactions
- Webhook signature verification

Integration Tests:
- End-to-end flow with provider sandbox or mocked provider (webhook replay tests)
- Outbox delivery to downstream services

E2E/Acceptance:
- Simulate real provider callbacks and ensure provider->webhook->payment confirmed path.

Security & Pen Test:
- Review webhook endpoints for injection, signature bypass, replay, and rate-limiting.

---

## 10.13 Operational Playbooks

Payment failed on ride completion:
- Show passenger a clear UI state and allow retry.
- Create admin ticket if repeated failures.

Unreconciled provider totals:
- Generate a reconciliation incident; manually re-run provider reports; escalate to provider support.

Mass webhook failures:
- Investigate ingestion pipeline, check secret rotations, and roll back recent deployment if needed.

---

## 10.14 ADRs (Key Decisions)

1. Use provider webhooks + transactional outbox for reliability
   - Why: Avoids lost events and supports retries; keeps DB as source of truth.
   - Alternatives: Sync-only approach (fragile), external queue (adds dependency). Outbox chosen for correctness.

2. Use idempotency keys and unique provider_reference constraints
   - Why: Prevent duplicate processing from retries and ensure financial correctness.

3. Defer PCI card processing to a later phase and use third-party provider
   - Why: PCI scope, security, and organizational complexity; defer to avoid premature compliance burden.

---

## 10.15 MVP Scope Validation

Included:
- MTN MoMo and Airtel Money integration flows, webhook handling, reconciliation, refunds basic flows, admin reconciliation UI hooks.

Deferred:
- Full card processing (deferred to Phase 11+)
- Automated instant payout integrations

---

## 10.16 Readiness Checklist (Phase 10 complete)

- [x] Payments architecture documented for MTN MoMo and Airtel Money
- [x] Data model and outbox pattern specified
- [x] Webhook handling and idempotency strategy defined
- [x] Reconciliation and payout designs specified
- [x] Security, compliance, and fraud controls documented
- [x] Testing strategy and operational playbooks included

Phase 10 is ready. Implementation scaffolding and provider onboarding can begin when authorized.

