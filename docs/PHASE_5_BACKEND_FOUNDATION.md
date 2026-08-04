# Phase 5: Backend Foundation - SafeRide Kigali

This document defines the concrete backend foundation for the SafeRide Kigali MVP. It translates the architecture, database, and authentication designs into a scaffolded backend blueprint without implementing business feature code.

## 5.1 Purpose

Phase 5 establishes the foundation of the NestJS backend service. It defines the bootstrapping architecture, configuration, core infrastructure modules, shared patterns, and developer experience needed before implementing business modules in later phases.

This phase does not implement ride-specific or payment-specific logic. It prepares the backend structure for safe, maintainable, and scalable implementation.

## 5.2 Objectives

- Define backend folder structure and module scaffolding.
- Specify core foundation modules: `Common`, `Config`, `Prisma`, `Auth`, `WebSocket`, `Audit`, and `Monitoring`.
- Define runtime bootstrapping, middleware, guards, and global configuration.
- Specify cross-cutting concerns: validation, error handling, logging, security middleware, request context, and response shaping.
- Define initial environment variables for development, staging, and production.
- Define backend developer workflows and toolchain expectations.

## 5.3 Backend Foundation Architecture

The backend foundation consists of a single NestJS application with a clear domain module boundary. The application is bootstrapped from `main.ts` and configured through a centralized config module.

Core foundation layers:

- `Bootstrap`: application entrypoint, global middleware, validation pipelines, and exception filters.
- `Config`: typed runtime configuration, environment validation, and secret provider abstraction.
- `Common`: reusable infrastructure such as guards, decorators, pipes, interceptors, filters, utilities, and exception helpers.
- `Prisma`: database provider and repository foundation.
- `Auth`: authentication primitives and access control support.
- `WebSocket`: socket gateway, auth handshake, and event bridge.
- `Audit`: audit event definitions, persistence contract, and logging integration.
- `Monitoring`: health checks, metrics scaffolding, and runtime probes.

These foundation layers are independent of business domain modules and provide the scaffolding used by `Users`, `Drivers`, `Rides`, `Payments`, `Notifications`, and `Admin`.

## 5.4 Backend Folder Structure

The backend folder structure is:

- `src/`
  - `main.ts`
  - `app.module.ts`
  - `config/`
    - `configuration.ts`
    - `config.module.ts`
    - `config.service.ts`
    - `validation.schema.ts`
  - `common/`
    - `decorators/`
    - `filters/`
    - `guards/`
    - `interceptors/`
    - `pipes/`
    - `dtos/`
    - `exceptions/`
    - `logging/`
    - `utils/`
  - `modules/`
    - `auth/`
    - `users/`
    - `drivers/`
    - `rides/`
    - `payments/`
    - `notifications/`
    - `admin/`
    - `audit/`
    - `websocket/`
  - `prisma/`
    - `prisma.module.ts`
    - `prisma.service.ts`
    - `repositories/`
  - `monitoring/`
    - `health/`
    - `metrics/`
  - `events/`
    - `event-emitter.module.ts`
    - `events/`
  - `schemas/`
  - `test/`

### Folder responsibilities

- `main.ts`: bootstrap application, register global middleware, enable security features, and start Nest.
- `app.module.ts`: root application module that imports foundation and domain modules.
- `config/`: typed environment config and startup validation.
- `common/`: shared guards, pipes, interceptors, decorators, error handling, and utilities.
- `modules/`: domain and foundation feature modules.
- `prisma/`: Prisma provider and repository base classes.
- `monitoring/`: health and metrics integration.
- `events/`: event bus, domain event definitions, and pub/sub contracts.
- `schemas/`: shared DTO schemas and response shapes.
- `test/`: shared test utilities, fixtures, and integration helpers.

## 5.5 Bootstrap and Global Modules

### `main.ts`

The application bootstrap should:

- instantiate `NestFactory`
- load the `ConfigModule`
- enable CORS for allowed origins only
- configure Helmet for secure headers
- register a global validation pipe with `whitelist`, `forbidNonWhitelisted`, and `transform` enabled
- register global exception filters for structured error responses
- register global interceptors for logging and response transformation
- enable Swagger/OpenAPI only in non-production or protected environments
- setup graceful shutdown hooks and signal handling
- optionally expose Prometheus metrics endpoints if enabled

### `app.module.ts`

The root module imports:

- `ConfigModule`
- `PrismaModule`
- `AuthModule`
- `AuditModule`
- `WebSocketModule`
- `MonitoringModule`
- `EventEmitterModule`
- domain modules: `UsersModule`, `DriversModule`, `RidesModule`, `PaymentsModule`, `NotificationsModule`, `AdminModule`

The root module also provides shared providers such as:

- `AppLogger`
- `RequestContext` provider
- global guards such as `JwtAuthGuard` and `RolesGuard`

## 5.6 Config Module

The `Config` module provides typed runtime configuration and environment validation.

### Responsibilities

- Load environment variables from `.env` in development.
- Validate configuration shapes at startup.
- Provide typed config objects to application modules.
- Support secret injection from local env or production secret stores.
- Define default values and environment-specific overrides.

### Config categories

- `app`: `NODE_ENV`, `PORT`, `APP_NAME`, `LOG_LEVEL`, `SWAGGER_ENABLED`
- `db`: `DATABASE_URL`, `DATABASE_POOL_SIZE`
- `redis`: `REDIS_URL`, `REDIS_NAMESPACE`
- `auth`: `JWT_ACCESS_TOKEN_SECRET`, `JWT_REFRESH_TOKEN_SECRET`, `JWT_ACCESS_TOKEN_EXPIRES_IN`, `JWT_REFRESH_TOKEN_EXPIRES_IN`
- `otp`: `OTP_EXPIRY_SECONDS`, `OTP_MAX_PER_HOUR`, `OTP_MAX_PER_DAY_PER_IP`, `OTP_MAX_FAILED_ATTEMPTS`
- `security`: `CORS_ORIGINS`, `CSRF_ENABLED`, `SESSION_TIMEOUT`
- `integrations`: `FCM_SERVER_KEY`, `GOOGLE_MAPS_API_KEY`, `MTN_MOMO_API_URL`, `MTN_MOMO_API_KEY`, `AIRTEL_MONEY_API_URL`, `AIRTEL_MONEY_API_KEY`
- `web`: `ADMIN_APP_URL`, `FRONTEND_APP_URL`

### Validation

- Use `zod` or `class-validator` for config schemas.
- Fail fast if required variables are missing, malformed, or out of range.
- Validate numeric and boolean values explicitly.
- Prevent application startup if config is invalid.

## 5.7 Common Infrastructure

The `common` module provides reusable infrastructure for all modules.

### Guards

- `JwtAuthGuard`: validates JWT access tokens and attaches the authenticated user to request context.
- `RolesGuard`: enforces role-based access on routes.
- `OwnershipGuard`: verifies ownership of resources before allowing access.
- `ThrottleGuard`: enforces rate limiting on endpoints.

### Pipes

- `ValidationPipe`: validates and transforms DTOs globally.
- `ParseUUIDPipe`: validates UUID route parameters.
- `TrimPipe`: trims string inputs.

### Filters

- `HttpExceptionFilter`: maps Nest exceptions to API error responses.
- `AllExceptionsFilter`: captures unhandled exceptions and avoids leaking stack traces.

### Interceptors

- `LoggingInterceptor`: logs request metadata, response duration, and status.
- `TransformInterceptor`: wraps successful responses in a consistent envelope.
- `SentryInterceptor` (optional): forwards errors to Sentry.

### Decorators

- `@CurrentUser()`: injects the authenticated user into controller handlers.
- `@Roles(...)`: declares required roles for a route.
- `@Public()`: marks an endpoint as accessible without authentication.
- `@ApiResponse`: documents response schemas for Swagger.

### Utilities

- `RequestContext`: stores request-scoped metadata such as correlation IDs, user ID, and source IP.
- `HashUtil`: reusable hashing helpers for tokens and secrets.
- `DateUtil`: timezone-aware date utilities.
- `AppError`: standardized business error factory.

## 5.8 Prisma Foundation

The `prisma` module provides a Nest-compatible wrapper around the generated Prisma client.

### Components

- `PrismaModule`: registers `PrismaService` as a globally available provider.
- `PrismaService`: extends `PrismaClient`, handles lifecycle events, and implements `OnModuleInit` and `OnModuleDestroy`.
- `RepositoryBase`: generic base repository for common persistence operations.
- `TransactionManager`: helper for atomic operations across multiple repository calls.

### Responsibilities

- Provide typed database access across modules.
- Manage database connection lifecycle and graceful shutdown.
- Expose transaction helper methods that accept callback functions.
- Avoid direct `new PrismaClient()` outside of the provider layer.

### Error handling

- Map Prisma errors to HTTP status codes and business exceptions.
- Handle unique constraint violations and foreign key failures gracefully.
- Normalize Prisma client errors for predictable responses.
- Log query failures without exposing SQL in production.

## 5.9 Auth Foundation

The `auth` module provides core authentication primitives and protects domain modules.

### Components

- `AuthController`: placeholder endpoints for auth flows.
- `AuthService`: orchestrates auth workflows, token issuance, and verification.
- `TokenService`: creates and validates JWT access tokens and refresh tokens.
- `OtpService`: generates, hashes, stores, and validates OTP codes.
- `RefreshTokenRepository`: persists refresh-token metadata and revocation state.
- `RateLimitService`: enforces auth-specific throttles with Redis.

### Responsibilities

- Provide reusable auth helpers, token contracts, and guard providers.
- Define how authentication and session state work within backend modules.
- Expose auth utilities for later domain integration.

### Integration points

- `ConfigModule` for auth secrets and expiries.
- `PrismaModule` for users and refresh token persistence.
- `NotificationsModule` for OTP delivery and email verification.
- `AuditModule` for auth event logging.

## 5.10 WebSocket Foundation

The `websocket` module provides initial socket gateway scaffolding and authentication integration.

### Components

- `SocketGateway`: Socket.IO gateway with connection lifecycle hooks.
- `SocketAuthGuard`: authenticates socket connections using JWT or session tokens.
- `SocketEventService`: emits events and maps domain events to socket channels.
- `RedisAdapter`: Redis-backed adapter for horizontal socket scaling.

### Responsibilities

- Authenticate socket connections and attach session context.
- Manage room subscriptions for ride status and notifications.
- Provide an event bridge for domain modules to emit socket messages.

### Integration points

- `AuthModule` for JWT validation.
- `Redis` for pub/sub and socket scale-out.
- `RidesModule` and `NotificationsModule` for real-time updates.

## 5.11 Audit Foundation

The `audit` module provides a baseline audit logging contract.

### Components

- `AuditLogService`: records audit events.
- `AuditEvent`: domain event definitions.
- `AuditLogRepository`: persistence contract for audit records.

### Responsibilities

- Provide a consistent audit API for modules.
- Store audit entries in the database.
- Expose audit query interfaces to admin modules.

### Integration points

- `PrismaModule` for persistence.
- `Common` for request context metadata.
- `EventEmitterModule` for async audit event handling.

## 5.12 Monitoring and Health

The `monitoring` module defines health and observability scaffolding.

### Components

- `HealthController`: readiness and liveness endpoints.
- `MetricsService`: metric registration and emission hooks.
- `HealthIndicator`: database and Redis connectivity checks.

### Responsibilities

- Expose `/health` and `/readiness` endpoints.
- Provide hooks for Prometheus or other metric backends.
- Register health checks for core infrastructure.

### Metrics

- Request counts, latencies, and error rates.
- Database connection health and query latency.
- Redis availability and error rate.
- Auth endpoint rate-limit events.

## 5.13 Security and Middleware

The backend foundation includes security-focused middleware and architecture.

### HTTP security

- Helmet for secure headers.
- CORS restricted to known origins.
- Rate limiting middleware with Redis backend.
- Secure cookie support for auth flows.
- Request body size limits.

### Input handling

- Global validation pipe with whitelist and transform.
- Reject invalid payloads and strip unknown properties.

### Logging

- Structured request logging with correlation IDs.
- Error logging with context and PII redaction.
- Optionally use `AppLogger` for structured logs.

### Secrets

- Load secrets from environment variables or managed vaults.
- Validate config at startup.
- Do not commit secrets to source control.

## 5.14 Environment Variables

The initial backend foundation requires these variables:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `DATABASE_POOL_SIZE`
- `REDIS_URL`
- `REDIS_NAMESPACE`
- `JWT_ACCESS_TOKEN_SECRET`
- `JWT_REFRESH_TOKEN_SECRET`
- `JWT_ACCESS_TOKEN_EXPIRES_IN`
- `JWT_REFRESH_TOKEN_EXPIRES_IN`
- `OTP_EXPIRY_SECONDS`
- `OTP_MAX_PER_HOUR`
- `OTP_MAX_PER_DAY_PER_IP`
- `OTP_MAX_FAILED_ATTEMPTS`
- `ARGON2_MEMORY`
- `ARGON2_TIME`
- `ARGON2_PARALLELISM`
- `FCM_SERVER_KEY`
- `GOOGLE_MAPS_API_KEY`
- `MTN_MOMO_API_URL`
- `MTN_MOMO_API_KEY`
- `AIRTEL_MONEY_API_URL`
- `AIRTEL_MONEY_API_KEY`
- `ADMIN_APP_URL`
- `FRONTEND_APP_URL`
- `LOG_LEVEL`
- `SWAGGER_ENABLED`
- `SENTRY_DSN` (optional)

## 5.15 Developer Experience

### Local startup

- Use Docker Compose for local PostgreSQL and Redis.
- Use `npm run start:dev` for hot reload.
- Use `npm run lint` and `npm test` for quality checks.

### Code quality

- Enforce TypeScript strict mode.
- Use ESLint and Prettier with shared configuration.
- Use `class-transformer` and `class-validator` for validation.
- Use typed DTOs and shared types aligned with frontend packages.

### Testing scaffolding

- Provide helpers to bootstrap the Nest app in tests.
- Use mocked config and test database fixtures.
- Use Jest for unit and integration tests.
- Keep test utilities in `test/`.

## 5.16 Phase 5 Deliverables

This phase produces:

- backend folder and module scaffold documented.
- core foundation module architecture defined.
- global bootstrap and middleware behavior specified.
- config and environment validation defined.
- auth, WebSocket, Prisma, audit, and monitoring foundation contracts defined.
- security middleware and logging requirements defined.
- developer setup and test scaffolding described.

## 5.17 Phase 5 Readiness Review

### Findings

- The backend foundation is intentionally minimal and does not include feature implementations.
- It prepares a clean scaffold with separation between infrastructure and business modules.
- It includes necessary security and operational middleware for the backend.

### Weaknesses

- OTP persistence in Redis is a design choice and requires careful key management.
- Monitoring remains scaffolded and requires explicit Prometheus metric definition in later phases.

### Improvements

- Maintain separation between repository persistence and service logic.
- Keep domain event contracts stable before implementing cross-module event consumers.
- Define Redis key naming and expiration conventions in the first implementation tasks.

### Checklist

- [x] Backend folder structure defined.
- [x] Core foundation modules scoped.
- [x] Config module requirements specified.
- [x] Global bootstrap and middleware defined.
- [x] Security infrastructure defined.
- [x] Developer experience and testing scaffolding defined.
- [x] Phase 5 readiness confirmed.

Phase 5 is complete and the SafeRide Kigali backend is ready for Phase 6: Admin Dashboard implementation and Phase 7: Passenger Mobile App implementation once the backend foundation is scaffolded.
