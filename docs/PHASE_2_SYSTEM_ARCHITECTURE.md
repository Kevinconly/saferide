# Phase 2: System Architecture - SafeRide Kigali

This document defines the architecture that will guide implementation for the SafeRide Kigali MVP. It is intentionally implementation-agnostic and focused on structure, communication, security, and deployment boundaries.

## 2.1 High-Level System Architecture

The SafeRide Kigali system is a monorepo-based platform with two client applications and a single backend service supported by persistence, cache, and integration services.

ASCII architecture diagram:

```
             +------------------+                      +--------------------+
             |  React Native    |                      |    Next.js Web     |
             |  Mobile Apps     |                      |   Admin Dashboard  |
             +--------+---------+                      +---------+----------+
                      |                                          |
                      | HTTPS / REST + WebSocket auth           | HTTPS / REST
                      |                                          |
                 +----v------------------------------------------v----+
                 |                    Nginx Reverse Proxy              |
                 |   - TLS termination                              |
                 |   - routing to API and Web static assets         |
                 |   - HTTP/2 support, request buffering            |
                 +----+------------------------------------------+----+
                      |                                          |
                      |                                          |
          +-----------v-----------+                      +-------v----------+
          |    NestJS Backend      |                      |  Next.js Static/  |
          |    REST + Socket.IO    |                      |  SSR Frontend     |
          +-----------+-----------+                      +-------------------+
                      |
         +------------+-------------+
         |                          |
 +-------v-------+          +-------v-------+
 |   PostgreSQL   |          |     Redis     |
 |   (Prisma)     |          |  (cache, pub/  |
 |                |          |   sub, rate   |
 +-------+-------+          |   limit, OTP) |
         |                  +-------+-------+
         |                          |
 +-------v--------+        +-------v-------+
 | Prisma ORM     |        | Socket.IO     |
 | Query Builder  |        | Redis Adapter |
 +----------------+        +---------------+
                      |
      +---------------+-------------------------------+
      |    External Integrations                    |
      |    - Google Maps Platform                   |
      |    - Firebase Cloud Messaging               |
      |    - MTN MoMo                               |
      |    - Airtel Money                           |
      +---------------------------------------------+
```

### Component Responsibilities

- Mobile App: passenger and driver native apps providing ride requests, real-time status, location updates, and user workflows. Communicates with backend via REST and Socket.IO.
- Web Dashboard: admin and operations interface hosted by Next.js, communicates with backend via REST and authenticated web sessions.
- Nginx: reverse proxy providing TLS termination, routing, compression, and static asset delivery.
- NestJS API: backend service handling business logic, authentication, authorization, ride lifecycle, payments, notifications, and audit.
- PostgreSQL: transactional data store for users, drivers, rides, payments, audit logs, and system metadata.
- Prisma: ORM layer providing typed schema and database access.
- Redis: in-memory store for OTP state, rate limiting, session-like token state, pub/sub for Socket.IO, and temporary cache.
- Socket.IO: real-time gateway for ride status, driver location, and event notifications.
- Google Maps: geocoding, distance matrix, route validation, and service area boundary enforcement.
- Firebase: push notification delivery to mobile devices.
- MTN MoMo / Airtel Money: external mobile money payment providers for ride settlement.

## 2.2 Architectural Principles

The following principles will govern the architecture for SafeRide Kigali.

- Clean Architecture: separate business rules from frameworks and delivery mechanisms. The backend is structured so domain logic is not directly coupled to NestJS controllers or Prisma implementation details.
- SOLID Principles: each service and class has a single responsibility, abstractions hide implementation details, dependencies are injected, and modules remain extensible and maintainable.
- Separation of Concerns: controllers handle transport concerns, services contain business logic, repositories handle persistence, and adapters encapsulate external integrations.
- Dependency Injection: NestJS DI is used to wire dependencies, enabling easier testing and replacement of implementations.
- DRY: duplicate logic is extracted into shared services, utilities, or packages, especially for validation, error handling, and API response shapes.
- KISS: the MVP architecture avoids premature optimization and unnecessary microservices. A single backend service is preferred until clear scaling needs emerge.
- Modular Design: the backend is organized into modules reflecting domain boundaries, making code easier to reason about and enabling later extraction into services if needed.
- Reusability: shared types, DTOs, and UI components are reused across web and mobile clients through shared packages.
- Security by Design: security controls are part of the architecture from the start, including authentication, authorization, validation, rate limiting, and secure defaults.
- Scalability: the system is designed to scale horizontally with stateless backend instances, Redis-backed session and pub/sub state, and database replicas.
- Maintainability: code organization, strict interface boundaries, documentation, and testing support long-term maintainability.

## 2.3 Repository Structure

The monorepo structure is designed for clarity, reuse, and separation of client and server concerns.

Root layout:

- `apps/`
  - `saferide-backend/`: NestJS backend service.
  - `saferide-web/`: Next.js admin dashboard.
  - `saferide-mobile/`: React Native passenger and driver apps.
- `packages/`
  - `shared-types/`: shared DTOs, enums, and API contract types used by backend and clients.
  - `prisma/`: Prisma schema, migrations, and generated client configuration.
  - `ui/`: shared React component primitives for web and potentially shared styling conventions.
- `docs/`: architecture and planning documents.
- `docker/`: shared Docker configurations, compose files, and environment scaffolding.
- `scripts/`: utility scripts for bootstrapping, migration, and local environment setup.

### Folder explanations

- `apps/saferide-backend/`: backend implementation, NestJS modules, services, controllers, and tests.
- `apps/saferide-web/`: admin dashboard UI and web-specific integrations.
- `apps/saferide-mobile/`: mobile application code and platform-specific configuration.
- `packages/shared-types/`: TypeScript interfaces, enums, and shared API contract definitions.
- `packages/prisma/`: database schema definition, migration files, and Prisma client generation logic.
- `packages/ui/`: reusable UI component primitives and shared styling utilities.
- `docs/`: living architecture and product specification documents.
- `docker/`: reproducible container orchestration configuration for development.
- `scripts/`: developer tooling and automation scripts.

## 2.4 Backend Architecture

The backend is organized into modular domains to preserve clean architecture and enable independent testing.

Backend folder structure:

- `src/`
  - `main.ts`: application bootstrap and global middleware/interceptor registration.
  - `app.module.ts`: root module wiring feature modules.
  - `common/`: shared utilities, guards, pipes, filters, decorators, interceptors, and DTO helpers.
  - `config/`: typed runtime configuration and environment validation.
  - `modules/`: domain modules.
    - `auth/`
    - `users/`
    - `drivers/`
    - `rides/`
    - `payments/`
    - `notifications/`
    - `admin/`
    - `audit/`
    - `websocket/`
  - `prisma/`: Prisma client provider and repository implementations.
  - `shared/`: shared services or base classes used across modules.
  - `jobs/` or `workers/`: background task handlers if needed for asynchronous operations.
  - `schemas/`: shared validation schemas and API contract definitions.

### Directory responsibilities

- `main.ts`: sets up global pipes, exception filters, security middleware, and bootstrap logic.
- `app.module.ts`: imports feature modules and establishes application-level providers.
- `common/`: houses reusable infrastructure concerns such as authentication guards, validation pipes, exception filters, logging interceptors, and global response wrappers.
- `config/`: centralizes environment configuration with validation and typed access to secrets and operational values.
- `modules/`: each domain module encapsulates controllers, services, repositories, DTOs, and module-specific configuration.
- `prisma/`: wraps the generated Prisma client as an injectable provider and provides repository interfaces and base implementations.
- `shared/`: contains abstractions and cross-module utilities that do not belong to a single domain.
- `jobs/`: optional worker or scheduled job definitions for notifications, reconciliation, or cleanup tasks.
- `schemas/`: shared DTOs and API schema definitions used by controllers and validation logic.

### Module communication

- Controllers accept HTTP requests and delegate to module services.
- Services orchestrate use cases, interact with repositories, and emit domain events or integration calls.
- Repositories encapsulate persistence operations through Prisma and database transactions.
- Modules communicate through service interfaces and event-driven notifications rather than direct data sharing.
- The WebSocket module subscribes to ride-related domain events and emits real-time updates when state changes occur.
- The Audit module receives events from other modules to append immutable audit records.

## 2.5 Module Architecture

### Auth

- Purpose: secure identity, session, and verification flows.
- Responsibilities: registration, login, OTP verification, refresh token lifecycle, email verification, password reset.
- Dependencies: `Users`, `Drivers`, `Notifications`, `Config`, `Prisma`, `Redis`.
- Public API:
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `POST /auth/logout`
  - `POST /auth/verify-phone`
  - `POST /auth/request-otp`
  - `POST /auth/verify-email`
- Internal Services:
  - `OtpService`
  - `TokenService`
  - `AuthService`
  - `RateLimitService`
- Future Expansion:
  - MFA methods, social login, passwordless login.

### Users

- Purpose: manage passenger profiles, history, and preferences.
- Responsibilities: profile retrieval/update, ride history, ratings, account status.
- Dependencies: `Auth`, `Rides`, `Payments`, `Audit`, `Config`, `Prisma`.
- Public API:
  - `GET /users/me`
  - `PATCH /users/me`
  - `GET /users/:id/rides`
  - `GET /users/:id/ratings`
- Internal Services:
  - `UserProfileService`
  - `RatingService`
  - `HistoryService`
- Future Expansion:
  - user preferences, saved addresses, loyalty segments.

### Drivers

- Purpose: manage driver onboarding, vehicles, status, and availability.
- Responsibilities: document upload, verification workflow, driver status and profile updates.
- Dependencies: `Auth`, `Notifications`, `Admin`, `Audit`, `Config`, `Prisma`, `Storage`.
- Public API:
  - `POST /drivers/onboard`
  - `GET /drivers/me`
  - `PATCH /drivers/me`
  - `POST /drivers/documents`
  - `GET /drivers/:id/status`
- Internal Services:
  - `DriverOnboardingService`
  - `DriverDocumentService`
  - `DriverStatusService`
- Future Expansion:
  - advanced background checks, driver incentives, certification management.

### Rides

- Purpose: central transport domain orchestrating ride requests, matching, and lifecycle management.
- Responsibilities: ride creation, matching, allocation, status transitions, location updates, cancellations, disputes initiation.
- Dependencies: `Users`, `Drivers`, `Payments`, `Notifications`, `Audit`, `WebSocket`, `Config`, `Prisma`, `Google Maps`.
- Public API:
  - `POST /rides`
  - `GET /rides/:id`
  - `POST /rides/:id/accept`
  - `POST /rides/:id/cancel`
  - `PATCH /rides/:id/status`
  - `GET /rides` (with filters)
- Internal Services:
  - `RideMatchingService`
  - `RideStateMachineService`
  - `LocationValidationService`
  - `RideQueryService`
- Future Expansion:
  - dynamic pricing, multi-stop bookings, corporate ride pools.

### Payments

- Purpose: payment orchestration, reconciliation, and transaction accounting.
- Responsibilities: fare calculation, mobile money initiation, callback processing, refunds, payout scheduling.
- Dependencies: `Rides`, `Users`, `Audit`, `Config`, `Prisma`, `Notifications`, `External Payment Providers`.
- Public API:
  - `POST /payments/initiate`
  - `POST /payments/callback`
  - `GET /payments/:id`
- Internal Services:
  - `PaymentService`
  - `ProviderAdapterService`
  - `TransactionLedgerService`
- Future Expansion:
  - bank card processing, wallet support, reconciliation dashboards.

### Notifications

- Purpose: manage push, email, and SMS communication.
- Responsibilities: device token registration, notification dispatch, retry, and fallback.
- Dependencies: `Auth`, `Users`, `Drivers`, `Rides`, `Payments`, `Config`, `Firebase`, `Email/SMS Providers`.
- Public API:
  - `POST /notifications/register-token`
  - `POST /notifications/unregister-token`
- Internal Services:
  - `PushNotificationService`
  - `EmailService`
  - `SmsService`
  - `NotificationEventService`
- Future Expansion:
  - user notification preferences, in-app messaging.

### Admin

- Purpose: operational tooling and management workflows.
- Responsibilities: search, approvals, dispute handling, user/driver management, audit queries.
- Dependencies: all domain modules, `Audit`, `Config`, `Prisma`.
- Public API:
  - `GET /admin/users`
  - `GET /admin/drivers`
  - `GET /admin/rides`
  - `GET /admin/audit-logs`
  - `PATCH /admin/drivers/:id/status`
- Internal Services:
  - `AdminActionService`
  - `ApprovalWorkflowService`
  - `ReportingService`
- Future Expansion:
  - analytics dashboards, escalation workflows, policy engines.

### Audit

- Purpose: record immutable audit trails for security and compliance.
- Responsibilities: log admin actions, payment adjustments, critical ride state changes, authentication anomalies.
- Dependencies: `Prisma`, `Config`, event emitters from other modules.
- Public API:
  - No direct public user-facing endpoints except admin audit queries.
- Internal Services:
  - `AuditLogService`
  - `AuditEventProcessor`
- Future Expansion:
  - log forwarding to external SIEM, compliance reporting, immutable storage.

### Prisma

- Purpose: database schema, typed access, and migration management.
- Responsibilities: define models, generate client, execute migrations, provide injectable DB provider.
- Dependencies: none other than schema definitions and runtime configuration.
- Public API:
  - `PrismaClient` provider used by repositories.
- Internal Services:
  - `PrismaRepositoryBase`
  - `TransactionManager`
- Future Expansion:
  - additional read-replica routing, multi-tenant schema patterns.

### WebSocket

- Purpose: real-time ride updates and event propagation.
- Responsibilities: socket authentication, ride event channels, driver location streams, notification dispatch.
- Dependencies: `Auth`, `Rides`, `Notifications`, `Redis`.
- Public API:
  - Socket events: `ride:update`, `driver:location`, `ride:offer`, `notification:event`.
- Internal Services:
  - `SocketAuthGuard`
  - `SocketEventService`
  - `PubSubAdapter`
- Future Expansion:
  - offline event buffering, granular channel subscriptions, socket metrics.

### Common

- Purpose: shared infrastructure and reusable utilities.
- Responsibilities: filters, interceptors, guards, pipes, exception handling, shared DTOs.
- Dependencies: all modules.
- Public API:
  - global exception filters, serialization interceptors, validation pipes.
- Internal Services:
  - `ErrorFactory`
  - `ResponseSerializer`
  - `PermissionsGuard`
- Future Expansion:
  - centralized feature flags, rate limit guard enhancements.

### Config

- Purpose: typed environment configuration and runtime validation.
- Responsibilities: load environment variables, validate values, expose typed configuration objects.
- Dependencies: environment and secrets stores.
- Public API:
  - `ConfigService`
- Internal Services:
  - `EnvironmentValidator`
- Future Expansion:
  - support for secret providers such as AWS Secrets Manager or Vault.

## 2.6 Frontend Architecture

### React Native Architecture

The React Native apps will follow a feature-oriented architecture with shared presentation and state layers.

#### Screens

- Passenger screens: `Auth`, `Home`, `RideRequest`, `RideStatus`, `Payment`, `History`, `Profile`.
- Driver screens: `Auth`, `Dashboard`, `RideOffers`, `Navigation`, `Earnings`, `Profile`, `Documents`.

#### Navigation

- Use React Navigation with a stack navigator for auth and main flows.
- Use tab navigator for core passenger and driver experiences.
- Use modal screens for OTP verification, ride details, and cancellation dialogs.

#### State Management

- Use lightweight state management with React Query for server state and local component state for UI.
- Use a small local store (e.g. Zustand or context) for auth state and device tokens.
- Keep business state synchronized with backend through API and WebSocket events.

#### API Layer

- Single API client layer using typed shared DTOs.
- Keep request/response transformations centralized.
- Use axios or fetch wrapper with automatic auth token injection, retry logic for token refresh, and error normalization.

#### Authentication

- Store access tokens in memory and secure refresh tokens in secure storage (`expo-secure-store` or native secure storage) for mobile.
- Use an auth context provider to manage login state.
- Refresh tokens automatically when access tokens expire.

#### Offline Strategy

- Cache critical user data and ride state locally for brief network interruptions.
- Use React Query cache for previously loaded user and ride data.
- Avoid complex offline ride creation in MVP; require network connectivity for ride requests.

#### Folder Structure

- `app/`
  - `screens/`
  - `navigation/`
  - `hooks/`
  - `services/`
  - `components/`
  - `stores/`
  - `utils/`
  - `types/`
  - `config/`

### Next.js Architecture

The admin dashboard will be a server-rendered Next.js application optimized for security and operational workflow.

#### Pages

- `pages/login.tsx`
- `pages/dashboard.tsx`
- `pages/users/index.tsx`
- `pages/drivers/index.tsx`
- `pages/rides/index.tsx`
- `pages/payments/index.tsx`
- `pages/audit.tsx`

#### Layouts

- `layouts/AdminLayout.tsx` for authenticated admin pages.
- `layouts/AuthLayout.tsx` for login and public admin pages.

#### Components

- Reusable components: `Table`, `Card`, `Form`, `Modal`, `Button`, `Badge`, `StatusPill`.
- Dashboards use shared UI primitives from `packages/ui/`.

#### Authentication

- Use token-based auth with access tokens stored in secure, HTTP-only cookies for web sessions or in memory where appropriate.
- Protect pages with server-side authentication checks and client-side guards.

#### API Communication

- REST communication via a typed API client.
- Use React Query for data fetching, caching, and state updates.

#### Folder Structure

- `app/` or `pages/` for route definitions.
- `components/` for reusable UI.
- `lib/` for API clients and utilities.
- `hooks/` for custom React hooks.
- `styles/` for shared theming and Tailwind configuration.
- `types/` for page and API types.

## 2.7 Communication Architecture

### React Native → Backend

- Use HTTPS REST for authentication, ride management, payments, and profile operations.
- Use Socket.IO for ride status, driver location updates, ride offers, and event notifications.
- Use Bearer token authentication on REST and socket auth payloads.

### Web Dashboard → Backend

- Use HTTPS REST API for admin operations.
- Optionally use Socket.IO for live ride status and audit events if needed in future phases.
- Use secure cookies or Bearer tokens for auth.

### Backend → PostgreSQL

- Use Prisma ORM to execute parameterized SQL queries and transactions.
- Use a single writable primary database in MVP and read replicas for reporting in later phases.

### Backend → Redis

- Use Redis for OTP state, rate limiting, pub/sub for Socket.IO, and short-lived caches.
- Use Redis-backed adapters for distributed socket event delivery.

### Backend → Google Maps

- Use Google Maps APIs for geocoding, reverse geocoding, distance estimates, and service boundary checks.
- Calls occur during ride creation, address search, and route validation.

### Backend → Firebase

- Use Firebase Cloud Messaging to deliver push notifications to mobile devices.
- Send notifications for ride offers, status changes, payment updates, and safety alerts.

### Backend → MTN MoMo / Airtel Money

- Use provider REST APIs for initiating payments and processing callbacks.
- Validate callbacks and process transaction updates idempotently.

### Backend → Socket.IO

- Use Socket.IO for real-time communication with mobile clients.
- Emit event updates for ride status, location changes, and driver offers.
- Authenticate socket connections with JWT and validate permissions.

### REST vs WebSocket

- REST APIs are used for commands and queries that are request/response oriented, including auth, ride creation, profile management, payments, and admin operations.
- WebSockets are used for event-driven real-time updates where low latency matters, especially ride status and driver location.
- The socket layer is intentionally separate from REST and only delivers notifications and ride events.

## 2.8 Security Architecture

The security architecture is designed to protect data, authenticate users, authorize actions, and harden the platform.

### JWT

- Use short-lived JWT access tokens for API and Socket.IO authentication.
- Include minimal claims: user ID, role, token issue time, and token identifier.
- Sign tokens with a secure secret or asymmetric key.

### Refresh Tokens

- Use rotating refresh tokens for session continuation.
- Store refresh tokens securely in HTTP-only cookies for web and secure storage for mobile.
- Revoke refresh tokens on logout or suspicious activity.

### RBAC

- Implement role-based access control with explicit roles: `guest`, `passenger`, `driver`, `admin`, `super-admin`.
- Enforce permissions on controllers and services with Nest guards.
- Use resource ownership checks for passenger- and driver-specific data.

### Argon2

- Hash all passwords with Argon2.
- Do not store raw passwords.
- Use a secure hashing configuration and rotate hashing parameters when needed.

### Rate Limiting

- Apply global and endpoint-level rate limits using Redis.
- Protect auth, OTP, ride creation, and payment endpoints from abuse.
- Return 429 responses when limits are exceeded.

### Validation

- Validate every request payload with DTOs and validation pipes.
- Use class-validator or Zod to enforce schema rules.

### Sanitization

- Sanitize user inputs to remove dangerous characters and prevent injection.
- Use server-side libraries to escape data before storage or output.

### Helmet

- Use Helmet middleware to set secure HTTP headers.
- Enable Content Security Policy, X-Frame-Options, XSS protection, and other security headers.

### HTTPS

- Enforce HTTPS for all client and server communication.
- Terminate TLS at Nginx or a managed load balancer.
- Redirect HTTP to HTTPS in development and production.

### CORS

- Restrict CORS to known origins for web clients.
- Allow mobile apps and admin dashboard origins explicitly.

### Secure Environment Variables

- Load secrets from environment variables or secret stores.
- Validate required variables at boot time.
- Do not commit secrets to source control.

### File Upload Security

- Validate file types and sizes for driver documents.
- Store uploads in S3-compatible storage behind signed URLs.
- Scan or review document uploads for malicious content if feasible.

### SQL Injection Prevention

- Use Prisma ORM to avoid raw query concatenation.
- When raw queries are necessary, use parameterized inputs.

### XSS Prevention

- Escape user-visible data in the web dashboard.
- Avoid injecting raw HTML from untrusted sources.
- Sanitize any rich content before rendering.

### IDOR Prevention

- Use authenticated user context to authorize resource access.
- Do not trust client-supplied resource IDs for ownership checks.
- Apply service-level authorization checks in addition to route guards.

## 2.9 Deployment Architecture

### Development Environment

- Use Docker Compose to run the backend, web, mobile development server, PostgreSQL, Redis, and supporting services locally.
- Include environment variable files for local development with example values.
- Nginx is optional in local development; the backend can be accessed directly from apps.
- Use hot reload for NestJS and React Native.

### Testing Environment

- Use a separate environment with infrastructure matching production as closely as possible.
- Run integration and end-to-end tests against containerized services.
- Use separate PostgreSQL and Redis instances from development.

### Production Environment

- Host the backend and web dashboard in containers behind Nginx or a cloud load balancer.
- Use managed PostgreSQL and Redis services when possible.
- Separate production secrets from lower environments.
- Use HTTPS across all endpoints.
- Instrument services with logging and monitoring.

### Docker

- Build minimal production images with multistage builds.
- Use a shared `docker/` directory for compose files and Dockerfile templates.
- Keep images small and dependency-free for runtime.

### Docker Compose

- Define services: `backend`, `web`, `postgres`, `redis`, `nginx`, `prisma` (for migrations), and `localstack`/mock services if needed.
- Use compose for local development and CI validation.

### Nginx

- Route `/api` to the NestJS backend.
- Route admin web traffic to Next.js or static build output.
- Enforce TLS and HTTP/2.
- Use caching for static assets.

### Environment Variables

- Use a centralized config module to load and validate variables.
- Separate secrets from non-sensitive config.
- Store secrets in environment or secret management systems.

### Logging

- Use structured logging for backend services.
- Forward logs to a centralized collector in production.
- Use local console logging for development.

### Monitoring

- Instrument backend health checks, metrics, and alerts.
- Expose readiness and liveness probes.
- Use Prometheus-compatible metrics where possible.

### Future Kubernetes Migration

- Keep compose manifests aligned with Kubernetes concepts: services, environment, volumes, and health checks.
- Design the architecture so the backend is stateless and can scale horizontally.
- Use Kubernetes manifests or Helm charts when migrating to production.

## 2.10 Architecture Decisions (ADR)

### Decision: Single Backend Service for MVP

- Why chosen: reduces complexity, speeds implementation, and keeps domain logic centralized for a one-developer team.
- Alternative considered: microservices per domain.
- Trade-offs: easier coordination and shared state, but requires careful module boundaries to avoid monolith issues.

### Decision: NestJS for Backend

- Why chosen: strong modularity, TypeScript support, dependency injection, and developer productivity.
- Alternative considered: plain Express or another Node framework.
- Trade-offs: slightly more framework structure, but better organization and long-term maintainability.

### Decision: PostgreSQL with Prisma

- Why chosen: transactional consistency, rich schema support, and typed ORM.
- Alternative considered: MongoDB or raw SQL.
- Trade-offs: schema rigidity is desirable for financial and ride data consistency.

### Decision: Redis for OTP, Rate Limiting, and Socket Pub/Sub

- Why chosen: low-latency, ephemeral state management and distributed coordination.
- Alternative considered: in-memory or database-backed caches.
- Trade-offs: requires separate infrastructure but is necessary for scalability and reliability.

### Decision: Socket.IO for Real-Time Ride Updates

- Why chosen: easy integration with NestJS and mobile apps, supports event-based patterns and pub/sub scaling.
- Alternative considered: WebSocket API or polling.
- Trade-offs: added stateful connection management, but benefits low-latency experience.

### Decision: Next.js for Admin Dashboard

- Why chosen: good developer ergonomics, SSR capabilities, and compatibility with React component reuse.
- Alternative considered: plain React SPA.
- Trade-offs: more setup, but better initial performance and admin page render control.

### Decision: React Native for Mobile Apps

- Why chosen: shared TypeScript codebase and faster cross-platform development for passenger and driver apps.
- Alternative considered: separate native apps.
- Trade-offs: some native integration complexity, but lower development cost.

### Decision: Use Nginx Reverse Proxy

- Why chosen: standardized TLS termination, routing, compression, and static file handling.
- Alternative considered: direct backend exposure.
- Trade-offs: adds a layer but improves security and deployment flexibility.

### Decision: API Versioning via URL Path

- Why chosen: clear version boundaries and simple routing management.
- Alternative considered: header-based versioning.
- Trade-offs: slightly longer URLs, but easier for clients and documentation.

### Decision: Shared Types Package

- Why chosen: ensure backend and frontend share the same enums and DTO types, reducing contract drift.
- Alternative considered: separate type definitions per client.
- Trade-offs: requires disciplined package management, but reduces bugs.

## 2.11 MVP Scope Validation

### Included in MVP

- Backend service with `Auth`, `Users`, `Drivers`, `Rides`, `Payments`, `Notifications`, `Admin`, `Audit`, `Prisma`, `WebSocket`, `Common`, and `Config` modules.
- PostgreSQL persistence with Prisma.
- Redis state management for OTP, rate limiting, and Socket.IO pub/sub.
- Mobile React Native passenger and driver apps with core auth and ride flows.
- Admin Next.js dashboard for user, driver, ride, payment, and audit management.
- Google Maps integration for boundaries and distances.
- Firebase Cloud Messaging for push notifications.
- MTN MoMo and Airtel Money integration scaffolding.
- Docker Compose for local development.
- Nginx reverse proxy for routing and security.

### Deferred to Future Releases

- Multi-tenant or multi-region architecture.
- Bank card payments and wallet support.
- Complex offline ride creation.
- Advanced fraud detection and analytics.
- Full feature-rich customer portal web experience.
- Multi-stop rides, corporate accounts, and dynamic pricing.
- Kubernetes production deployment in this phase.

### Avoided Feature Creep

- No separate microservices in MVP.
- No advanced message queue beyond Redis pub/sub.
- No external SIEM or full event streaming platform.
- No support for multiple ride products beyond the core passenger/driver flow.

## 2.12 Readiness Review

### Weaknesses Identified

- The architecture assumes a single backend monolith; careful module separation is required to avoid a tangled codebase.
- Socket.IO introduces connection state; the architecture includes Redis adapter to manage horizontal scale, but eventual scaling must be validated.
- Admin dashboard auth strategy must be decided before implementation to avoid mixing cookie and token flows.

### Suggested Improvements

- Define a minimal event contract for Socket.IO that is stable and versioned.
- Keep the backend module boundaries strict by enforcing public APIs through service interfaces.
- Document the Redis key namespace and expiration patterns early.
- Establish a clear policy for shared DTO versioning between backend and clients.

### Readiness Confirmation

The architecture is ready to begin implementation in the next phases.

- Phase 3 (Database Design): ready. The architecture includes persistence decisions, schema boundaries, and entity relationships.
- Phase 4 (Authentication): ready. The Auth module, JWT/refresh strategy, and security architecture are defined.
- Phase 5 (Backend Implementation): ready. The backend folder structure, module boundaries, communication patterns, and deployment architecture are specified.

### Phase 2 Completion Checklist

- [x] High-level system architecture defined.
- [x] Architectural principles established.
- [x] Monorepo structure designed.
- [x] Backend architecture and module boundaries specified.
- [x] Frontend architecture for mobile and web defined.
- [x] Communication architecture documented.
- [x] Security architecture defined.
- [x] Deployment architecture described.
- [x] Architectural decisions captured.
- [x] MVP scope validated and creep avoided.
- [x] Readiness reviewed and confirmed.

Phase 2 is complete and the SafeRide Kigali project is ready to move to Phase 3: Database Design.
