# Phase 15: Testing - SafeRide Kigali

This document defines the complete testing strategy for SafeRide Kigali. It covers test types, tooling, CI integration, environments, test data management, reliability practices, and acceptance criteria required to move the product from development into production with confidence.

Scope:
- Backend (NestJS + Prisma + Redis)
- Frontend (Next.js Admin)
- Mobile apps (React Native Passenger & Driver)
- Realtime subsystems (Socket.IO)
- Payments, Notifications, and External Integrations

Objectives:
- Ensure correctness, reliability, and security of core flows (auth, rides, payments, dispatch)
- Provide deterministic, fast feedback for developers via unit/integration tests
- Provide high-confidence E2E tests covering critical user journeys
- Integrate performance/regression tests into CI pipeline
- Detect regressions early and provide actionable artifacts for debugging

---

## 15.1 Testing Principles

- Fast feedback: unit tests should be fast and run on every commit; integration/E2E tests run on PRs and nightly.
- Determinism: tests must be deterministic; minimize flaky tests using stable fixtures and mocked time where necessary.
- Isolation: unit tests never call external services; integration tests use test containers or sandboxed provider emulators.
- Reproducible environments: use Docker Compose / ephemeral test databases for consistent environments across CI and local runs.
- Observability: capture logs, traces, screenshots, and artifacts for failing tests.
- Security-first: include SAST/DAST and dependency checks in CI pipeline.
- Test as documentation: tests should express intended behavior and edge cases.

---

## 15.2 Testing Pyramid & Coverage Targets

Testing Pyramid (priority from bottom to top):
- Unit tests (largest volume): fast, isolated, business logic
- Integration tests: service interactions (DB, Redis, local providers)
- Contract tests: API contracts between services (Pact or OpenAPI-driven)
- End-to-end tests (small surface): real user flows across full stack
- Performance and load tests: capacity and SLO validation

Coverage targets (MVP):
- Backend unit coverage: >= 80% lines on critical modules (auth, payments, rides, dispatch)
- Frontend unit coverage: >= 70% on UI logic and validation
- Integration coverage: core flows covered by integration tests (not measured via line coverage)
- E2E coverage: 90% of critical flows (auth, request ride, accept ride, complete ride, payment) validated

Note: Coverage percentage is a quality metric; do not pursue coverage at expense of meaningful tests.

---

## 15.3 Tooling Recommendations

Backend (Node/NestJS)
- Unit/Integration: Jest (ts-jest) with supertest for HTTP controller tests
- Test DB: Testcontainers (Docker) or docker-compose with a transient Postgres and Redis for integration tests
- Mocking: jest.mock, factory functions, and parametrized fixtures
- Contract testing: Pact (provider + consumer tests) or OpenAPI contract tests using schemathesis for fuzzing

Frontend (Next.js)
- Unit: Jest + React Testing Library
- Integration/E2E: Playwright (preferred) for browser automation (headless and headed for debugging)
- Component tests: Storybook + testing library integration
- API mocks: MSW (Mock Service Worker) for isolated component tests

Mobile (React Native)
- Unit: Jest + React Native Testing Library
- Integration/E2E: Detox or Playwright Mobile (where supported). Use device farm or cloud provider (Firebase Test Lab / BrowserStack) for cross-device coverage

Realtime (Socket.IO)
- Integration harness: Node.js + socket.io-client to simulate multiple clients; test race conditions for offer->accept flows

Performance & Load
- HTTP: k6 for scriptable load tests
- Websocket: custom Node harness using socket.io-client to simulate many sockets

Security
- SAST: Semgrep rules and ESLint security plugins
- Dependency scanning: GitHub Dependabot + Snyk/OSV checks in CI
- DAST: OWASP ZAP automated scans against test/staging deployments

Observability during tests
- Capture logs to files and attach to CI artifacts
- Capture traces (OpenTelemetry) or at least correlation IDs for slow flows
- For E2E failures, save screenshots, DOM snapshots, and video (Playwright) to CI artifacts

---

## 15.4 Test Environments

Local development
- Use docker-compose.dev.yml to start Postgres, Redis, and the API in dev mode
- Provide seeders for test data: seed scripts that load deterministic minimal dataset for local testing
- Provide a Makefile or npm scripts for common flows:
  - npm run test:unit
  - npm run test:integration
  - npm run test:e2e
  - npm run test:coverage

CI environments
- Use GitHub Actions with matrix builds to run unit tests, linters, type checks on every PR.
- Integration test job uses Docker-in-Docker or services to run Postgres/Redis; starts the API image and runs integration tests.
- E2E job runs Playwright suite against a staging deployment (deploy-preview or ephemeral environment).

Ephemeral test clusters
- Use ephemeral environments for full-stack E2E validation: deploy branches to ephemeral staging (via preview environments) and run Playwright against that environment.
- Use terraform/infra-as-code to spin up ephemeral resources in a sandbox account for PR validation when required.

Test data isolation
- Tests must create isolated test data (unique ids or tenant prefixes) or run within a transaction that is rolled back after the test.
- For long-running tests (E2E), create and tear down resources explicitly to avoid collisions.

---

## 15.5 Backend Testing Strategy (NestJS + Prisma)

Unit tests
- Test services, business logic, utilities, validators, and guards.
- Avoid hitting DB; use jest.mock or an in-memory stub for Prisma client.
- Example: test fare calculation, OTP validation, RBAC checks.

Integration tests
- Use a transient Postgres instance (testcontainers) and Redis for integration tests.
- Run migrations in test DB at test setup.
- Use Supertest to exercise controllers:
  - Auth flows (login, verify OTP, refresh)
  - Ride creation and state transitions
  - Payment webhook processing (mock provider callbacks)

Database & transaction testing
- Seed test data using factories (Factory pattern) and cleanup after each test.
- For transactional behavior (outbox + event delivery), write integration tests that assert DB state and outbox rows after actions.

Contract tests
- Providers (payments, notifications) must expose a contract. Use Pact to verify provider behavior against consumer expectations.

Test examples (commands):
- Run unit tests: npm run test:unit
- Run integration tests (local): npm run test:integration -- --runInBand

---

## 15.6 Realtime & Concurrency Tests

Race condition tests
- Simulate 10–100 concurrent drivers accepting the same offer; assert only one succeeds.
- Use cluster of Node processes or concurrency harness in Jest (spawn multiple accept requests concurrently) to validate SELECT FOR UPDATE and lock behavior.

Socket tests
- Use socket.io-client to connect multiple simulated clients to the Socket.IO gateway.
- Test presence state on connect/disconnect and reconnection behavior after simulated network loss.

Load tests
- Run a scaled harness that opens thousands of socket connections and sends periodic driver location updates to measure throughput and server resource usage.

---

## 15.7 Frontend Testing Strategy (Next.js Admin)

Unit & Component tests
- Use React Testing Library and Jest to test components, forms, and validation.
- Use MSW to mock API responses during component tests.

Integration tests
- Use Playwright to test key admin flows against a deployed preview environment:
  - Admin login
  - Driver verification workflow
  - Dispute resolution flow
  - Payment reconciliation

Accessibility tests
- Use axe-core integration with Playwright to run accessibility scans in E2E tests.
- Fail build on critical accessibility violations for key pages.

---

## 15.8 Mobile Testing Strategy (React Native)

Unit tests
- Jest + React Native Testing Library for screens, hooks, and utilities.

Integration & E2E
- Detox for native E2E tests and device automation, or Appium for broader device coverage.
- Use Firebase Test Lab or BrowserStack for running suites across real devices.

Push & Notifications
- Use FCM test project and emulator to validate push flows; assert deep-links and in-app notification handling.

Geolocation & Permissions
- Simulate geolocation via device/emulator APIs; test permission flows and background/foreground behavior.

---

## 15.9 Payments & External Integrations Testing

Provider sandbox
- Obtain sandbox credentials for MTN MoMo and Airtel Money; use provider sandbox endpoints in staging and CI for replayable tests.
- Mock provider behavior where sandbox is unavailable.

Webhook tests
- Use replayed webhook payloads to test signature verification and idempotency handling.
- Validate DB updates, outbox emission, and downstream notifications in integration tests.

Fraud & edge cases
- Test duplicate callbacks, delayed callbacks, partial failures, and provider timeouts.

---

## 15.10 Test Data & Fixtures

- Use deterministic factories to generate test data (e.g., factory.ts) with stable seeds to reproduce scenarios.
- For complex E2E data (full ride lifecycle), provide seed scripts to create passengers, drivers, and pre-funded payment states.
- Maintain small set of canonical test accounts and tokens for CI and staging; rotate periodically and store secrets in CI secret store.

---

## 15.11 CI Integration & Test Pipelines

Suggested GitHub Actions pipeline stages:
- lint: ESLint, Prettier, type-check
- test:unit (parallel across packages)
- test:integration (start test services in job, run migrations, run tests)
- test:contracts (run provider/consumer pact tests)
- test:e2e (run Playwright tests against ephemeral or staging environment; collect artifacts)
- test:performance (nightly or on-demand to avoid long runs on PRs)
- security-scans (Snyk/Dependabot, semgrep, container scanning)

PR requirements
- All PRs must pass lint and unit tests before review
- Integration and E2E tests run on merge to staging or special CI label

Artifacts & reporting
- Upload test artifacts (Playwright videos/screenshots, Jest coverage, logs) to CI run and store links in PR
- Send failed test alerts to Slack/dev channel with links to artifacts

Parallelization & caching
- Use job matrices to parallelize tests across packages and platforms
- Cache node_modules and docker layers for faster CI

---

## 15.12 Flaky Tests & Reliability Practices

Detection
- Track test flakiness over time with CI metrics and a flaky-test dashboard
- Automatically rerun flaky tests once and create an issue when a test flakes more than N times

Mitigation
- Avoid time-based waits in tests; use explicit polling and await utilities
- Use deterministic clocks (mock Date) where time is relevant
- Use Docker-based ephemeral services to minimize environment drift

Ownership
- Each flaky test must be triaged within 24 hours and assigned an owner
- Create a quarantine pattern: flaky tests can be muted temporarily but must have an open ticket and expiration

---

## 15.13 Test Observability & Artifacts

- Store coverage reports as CI artifacts and upload to Codecov
- For E2E failures, store Playwright traces, video capture, and DOM snapshots for debugging
- For integration failures, collect server logs and DB snapshots limited to test context
- Correlate failing tests to trace IDs if distributed tracing is enabled in test environment

---

## 15.14 Security & Compliance Testing

- SAST in CI using Semgrep rules and custom patterns for known anti-patterns
- DAST: schedule OWASP ZAP scans against staging after each deployment to staging
- Dependency scanning: enable Dependabot and Snyk; block merges on critical vulnerabilities
- Penetration test coordination: provide test environment and credentials for pentesters on request

---

## 15.15 Release Criteria & Acceptance Tests

Before any production release, the following must be green:
- All unit tests passing
- Integration tests for payments, auth, and dispatch passing in staging
- E2E smoke tests for core flows passing in an ephemeral or staging environment
- Performance baseline met for core endpoints (smoke k6 tests or last known golden run)
- No critical or high security findings in SAST/Dependency scans
- Code coverage thresholds met for critical modules (as per 15.2)

Production readiness checklist should be automated and part of the release pipeline.

---

## 15.16 Running Tests Locally (examples)

Install dependencies
- npm ci

Run unit tests
- npm run test:unit

Run all tests (unit + integration)
- npm run test:all

Run integration tests with Docker Compose
- docker compose -f docker-compose.test.yml up --build -d
- npm run test:integration

Run Playwright E2E locally
- npm run dev (start backend and web)
- npx playwright test --project=chromium

Run socket harness
- node scripts/socket-harness.js --clients=100 --rate=1

---

## 15.17 Test Governance & Ownership

- Assign test owners per module (auth, payments, rides, notifications)
- Require test updates in PRs that modify behavior or add endpoints
- Maintain a test definition file per feature: what to test, edge cases, and acceptance criteria

---

## 15.18 Readiness Checklist (Phase 15 complete)

- [x] Unit test strategy documented and tooling selected
- [x] Integration test strategy with test containers and sandboxes documented
- [x] E2E testing strategy with Playwright/Detox specified
- [x] Contract testing approach defined (Pact/OpenAPI)
- [x] Performance and load test tooling defined (k6, socket harness)
- [x] Security testing (SAST/DAST/dependency scanning) included in CI
- [x] CI pipeline test stages and artifact strategies specified
- [x] Flaky test policies and ownership model defined
- [x] Release acceptance criteria defined including performance and security gates

Phase 15 is complete. The project now has a comprehensive, actionable testing plan ready for implementation and CI integration.

