# Phase 4: Authentication & Authorization - SafeRide Kigali

This document defines the authentication and authorization architecture for SafeRide Kigali. It builds on the system and database design from Phase 2 and Phase 3 and prepares the project for secure implementation of user identity, session management, access control, and verification workflows.

## 4.1 Objectives

- Define MVP authentication flows for passengers, drivers, admins, and guests.
- Specify token formats, storage, refresh, revocation, and replay protection.
- Define OTP handling, rate limiting, and validation policies.
- Define role-based access control (RBAC) and authorization enforcement.
- Define secure auth interfaces for mobile and web clients.
- Document operational, security, and testing requirements for auth.

> NOTE: For current development/demo builds, OTP flows are temporarily disabled. Signup and login should use password-based credentials. Role-based access control (RBAC) and token-based session handling remain active and must be used as specified.

## 4.2 Authentication Requirements

### Functional requirements

- Passenger registration and login using phone-based OTP.
- Driver onboarding with verified phone registration and pending approval.
- Admin authentication with elevated access and safeguards.
- Phone verification as a prerequisite for ride access.
- Email verification for receipts, recovery, and admin contact.
- JWT access tokens for API and Socket.IO authentication.
- Rotating refresh tokens for session continuation.
- Logout and refresh token revocation.
- Rate limiting on OTP issuance, login attempts, refresh requests, and critical auth flows.
- Admin MFA support for sensitive operations.
- Secure session handling for mobile and web clients.

### Non-functional requirements

- Use Argon2 for password hashing.
- Access tokens expire quickly (default 15 minutes).
- Refresh tokens expire after a longer duration (default 30 days) and are rotated.
- OTP codes expire after 5 minutes and are single-use.
- Auth secrets are loaded from environment or secret manager.
- Auth-related audit events are captured for security reviews.
- Auth endpoints are hardened against brute force and credential stuffing.

## 4.3 Authentication Use Cases

### Passenger Registration

1. Passenger provides phone number and optional email.
2. System validates phone format, normalizes to E.164, and checks uniqueness.
3. System generates a 6-digit OTP and stores a hashed version in Redis.
4. System sends OTP via SMS and optionally email fallback.
5. Passenger submits OTP along with the original phone.
6. System validates OTP, marks the phone verified, and creates a `User` record if needed.
7. System issues access and refresh tokens and returns user metadata.

Notes:
- A passenger record may be provisionally created after OTP verification.
- Email verification can be deferred until later if not provided.
- Phone verification is mandatory for any ride request.

### Driver Onboarding

1. Driver registers with phone number, optional email, and device metadata.
2. System sends OTP to verify the phone.
3. Driver submits onboarding details and supporting documents.
4. System creates a `User` record with role `DRIVER` and a `DriverProfile` in `PENDING` status.
5. Admin reviews documents and approves or rejects the driver.
6. Upon approval, the driver becomes eligible to authenticate fully and receive ride offers.

Notes:
- Drivers may log in after phone verification, but ride offer access is gated by driver status.
- The driver onboarding flow should capture profile, vehicle, and insurance metadata separately from base auth.

### Login

1. User provides phone and either OTP or password credentials.
2. System validates the request and verifies the user is active.
3. If valid, issue an access token and a new refresh token.
4. Store the hashed refresh token in the database with device/session metadata.

Notes:
- Password-based login is optional in MVP; OTP-first login is preferred to reduce friction.
- Driver role may require status validation on login.

### Token Refresh

1. Client sends refresh token to `/auth/token/refresh`.
2. System validates token hash, expiry, device metadata, and revoked state.
3. On success, issue a new access token and a new refresh token.
4. Mark the old refresh token as rotated/revoked.

Notes:
- Refresh token rotation prevents replay attacks.
- The backend should treat stale refresh tokens as invalid and audit suspicious reuse attempts.

### Logout

1. Client requests logout with the current refresh token.
2. System revokes the refresh token in the database.
3. Client clears stored tokens from device or session.

Notes:
- Access tokens may remain valid until expiry; use short lifetimes to limit exposure.
- Optionally blacklist access tokens in Redis only for forced admin logouts or compromised sessions.

### Email Verification

1. User requests email verification or registers with email.
2. System generates a verification token and sends a link to the email.
3. User clicks the link; frontend sends the token to backend.
4. System marks the email as verified on success.

Notes:
- Email verification tokens may be single-use and expire after 24 hours.
- Do not expose internal user state in verification URLs.

### Password Reset (Deferred)

- Password reset flows are deferred to future phases to keep MVP scope focused.
- If implemented later, use secure one-time tokens or OTPs and avoid password hints.

## 4.4 Token Strategy

### Access Tokens

- Format: JWT signed with `HS256` for MVP or `RS256` if using asymmetric keys.
- Claims:
  - `sub`: user ID.
  - `role`: user role.
  - `jti`: JWT ID for optional revocation.
  - `iat`: issued-at timestamp.
  - `exp`: expiration timestamp.
  - `scope`: optional permission scope.
  - `deviceId`: optional device identifier.
- Lifetime: 15 minutes.
- Storage:
  - Mobile: keep in memory; refresh token stored securely.
  - Web: keep in memory; do not store in local storage. Use cookies for refresh tokens.
- Transmission:
  - Use `Authorization: Bearer <token>` for REST.
  - Use socket auth handshake payload for WebSocket.

### Refresh Tokens

- Format: random opaque string.
- Storage:
  - Mobile: secure storage (`expo-secure-store`, Keychain, EncryptedStorage).
  - Web: HTTP-only secure cookie with `SameSite=Strict`.
- Lifetime: 30 days (configurable).
- Rotation:
  - Issue a new refresh token on each token refresh.
  - Mark previous refresh token as revoked and record rotation chain.
- Storage backend:
  - Store only hashed tokens in `RefreshToken` table.
  - Preserve device/session metadata and expiration.

### Key Rotation and Revocation

- Support versioned JWT secrets: `JWT_ACCESS_TOKEN_SECRET_V1`, `JWT_ACCESS_TOKEN_SECRET_V2`.
- Optionally support a refresh token rotation window to allow a short overlap between old and new secrets.
- On logout, revoke the current refresh token and optionally blacklist the session.
- Track suspicious refresh token reuse and invalidate all tokens for the account if detected.

### Access Token Blacklist

- Keep access tokens short-lived to minimize blacklisting need.
- Use Redis-based blacklist only for high-risk admin session revocation or compromised accounts.
- Access token blacklist entries expire at token expiry.

## 4.5 OTP Design

### OTP Generation

- Generate a 6-digit numeric OTP using a secure random generator.
- Store OTP metadata in Redis under a namespaced key such as `otp:{phone}`.
- Store only a hashed OTP value and request metadata.
- Set expiration to 5 minutes.

Example Redis structure:
- `otp:{phone}`: `{ hash, expiresAt, attempts, createdAt, requestIp, deviceId }`

### OTP Verification

- Compare hashed OTP values.
- Ensure OTP is not expired and not consumed.
- Invalidate the OTP entry on success.
- Track invalid attempts to prevent brute force.

### OTP Delivery

- Primary delivery channel: SMS provider.
- Fallback: email if SMS fails and verified email exists.
- Provide a user-facing message on delivery status.
- Do not include OTP values in logs.

### OTP Rate Limiting

- Limit OTP requests to `OTP_MAX_PER_HOUR` per phone.
- Limit OTP requests to `OTP_MAX_PER_DAY_PER_IP` per IP.
- Limit invalid OTP submissions to a low threshold before temporary lockout.
- Use Redis counters with expiration for rate limits.
- Exceeding the limit returns a `429 Too Many Requests` response.

### OTP Anti-Fraud

- Block repeated invalid OTP attempts from the same IP or phone.
- Add a cooldown period after repeated failures.
- Use device metadata to detect suspicious request patterns.

## 4.6 Password Management

### Password Hashing

- Use Argon2id for hashing passwords.
- Configure parameters for production: high memory, moderate time, and parallelism tuned to the deployment environment.
- Store hash output in `User.passwordHash`.
- Do not store raw passwords or password reset tokens.

### Password Policy

- Minimum length: 8 characters.
- Require at least one uppercase, one lowercase, one digit, and one special character.
- Reject commonly used weak passwords.
- Validate only when password login is enabled.

### Password Storage

- Persist only hashed passwords.
- Use secure, audited storage.
- Do not log password material.

## 4.7 Role-Based Access Control (RBAC)

### Roles

- `GUEST`
- `PASSENGER`
- `DRIVER`
- `ADMIN`
- `SUPER_ADMIN`

### Permissions matrix

- `GUEST`: request OTP, verify account, view service coverage.
- `PASSENGER`: request rides, view own rides, cancel own rides, rate drivers, update own profile.
- `DRIVER`: accept/reject ride offers, update own ride status, view own earnings and profile.
- `ADMIN`: approve/reject drivers, manage users/drivers/rides/payments/disputes, view audit logs.
- `SUPER_ADMIN`: all admin abilities plus system configuration, RBAC management, and emergency actions.

### Enforcement strategy

- Use Nest guards on controllers and routes.
- Apply a `RolesGuard` and an `OwnershipGuard` for user-specific resources.
- Validate role membership and resource ownership in service methods.
- Keep backend authorization authoritative; frontend checks are UX only.

### Permission granularity

- Use explicit permissions for sensitive actions such as `driver:approve`, `payment:refund`, and `audit:view`.
- Map roles to permission sets within configuration.
- Support future permission expansion without changing role semantics.

### Admin MFA strategy

- Plan for admin MFA using time-based codes or SMS OTP for sensitive actions.
- Use `adminMfaEnabled` configuration to gate enforcement.
- For MVP, record MFA requirement and leave full TOTP implementation for Phase 8+ if needed.

## 4.8 Auth Module Architecture

### Components

- `AuthController`
  - Endpoints for OTP, login, refresh, logout, email verification, and account status.
- `AuthService`
  - Orchestrates login, token issuance, phone/email verification, and logout.
- `TokenService`
  - Creates, validates, and parses JWTs and refresh tokens.
- `OtpService`
  - Generates OTPs, stores hashed values, verifies submissions, and handles rate limiting.
- `UserService`
  - Handles user creation, lookup, status checks, and profile linking.
- `RefreshTokenRepository`
  - Persists hashed refresh tokens and session metadata.
- `RateLimitService`
  - Applies TTL-based limits with Redis.
- `AuthGuard`, `RolesGuard`, `OwnershipGuard`
  - Protect REST and WebSocket routes.

### Public API Endpoints

- `POST /auth/request-otp`
  - Request a new OTP.
- `POST /auth/verify-otp`
  - Verify OTP and optionally issue tokens.
- `POST /auth/login`
  - Password or OTP login.
- `POST /auth/token/refresh`
  - Refresh access token using refresh token.
- `POST /auth/logout`
  - Revoke refresh token and clear session.
- `POST /auth/verify-email`
  - Mark email as verified.
- `POST /auth/resend-email-verification`
  - Resend email verification link.

### Internal flows and contracts

- Token rotation: each refresh request rotates the refresh token.
- Session metadata: track device, IP, user agent, and issuedAt for refresh tokens.
- Audit hooks: emit auth events for login, logout, refresh, and suspicious activity.
- Error shaping: return standardized auth error codes such as `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_EXPIRED`, `AUTH_TOO_MANY_REQUESTS`.

### Integration points

- `ConfigModule` for auth policy values.
- `PrismaModule` for user and refresh token persistence.
- `NotificationsModule` for OTP delivery and email verification.
- `AuditModule` for security event logging.

## 4.9 Frontend Auth Patterns

### Mobile

- Implement an `AuthProvider` that manages auth state and token lifecycle.
- Persist only refresh tokens in secure storage.
- Keep access tokens in memory and use refresh tokens to obtain new ones.
- Authenticate Socket.IO connections using the current access token on connect.
- Provide screens for phone input, OTP entry, and account verification.

### Web

- Use HTTP-only secure cookies for refresh tokens if the web app shares the backend domain.
- Use access tokens in memory only.
- Protect pages with server-side session checks for initial render.
- Use CSRF tokens if refresh cookies are used.
- Avoid localStorage or sessionStorage for auth tokens.

### Shared client patterns

- Use shared DTO types from `packages/shared-types/`.
- Normalize auth error states and token refresh logic.
- Provide consistent messages for verification, login failure, and lockout conditions.

## 4.10 Security Controls

### Validation and sanitization

- Validate all auth payloads using DTOs and global validation pipes.
- Sanitize phone numbers, emails, and string inputs.
- Enforce strict payload size limits.

### Rate limiting

- Rate limit OTP, login, refresh, and other auth endpoints with Redis-backed tokens.
- Use distinct limits for phone, IP, and device.
- Return consistent `429` responses for exceeded thresholds.

### Error handling

- Avoid leaking account existence on OTP or login requests.
- Use generic authentication error messages.
- Log internal details for audit and security teams only.

### CORS and CSRF

- Allow only trusted origins for the admin dashboard and mobile backend endpoints.
- Use CSRF protection for cookie-based web flows.
- Set cookie flags: `HttpOnly`, `Secure`, `SameSite=Strict`.

### Helmet and secure headers

- Use Helmet middleware to set security headers.
- Enforce strict transport security, XSS protection, and frame options.

### Environment security

- Load secrets from environment variables or a secrets manager.
- Validate configuration at startup.
- Do not hardcode any secrets in the repo.

### File upload security

- Driver document uploads must require authenticated access and role validation.
- Validate upload content types, sizes, and storage paths.
- Use signed URLs for upload/download, minimizing direct backend exposure.

### SQL Injection prevention

- Use Prisma ORM and parameterized queries.
- Avoid interpolating raw SQL with user input.

### IDOR prevention

- Verify resource access through authenticated user context.
- Use service-level ownership checks for passenger and driver resources.
- Do not rely on client-supplied IDs alone.

## 4.11 Operational Considerations

### Logging and auditing

- Log auth events with `requestId`, `userId`, `action`, `outcome`, `sourceIp`, and `userAgent`.
- Capture audit events for login, logout, token refresh, failed auth attempts, and admin role changes.
- Use separate audit entries for admin and security events.

### Monitoring

- Track endpoint latency, error rates, rate-limit hits, and suspicious auth patterns.
- Alert on abnormal spikes in failed logins, OTP requests, or refresh failures.

### Secret rotation

- Plan JWT secret rotation with versioned secret support.
- Rotate refresh token generation secret with minimal session disruption.
- Support rolling key changes using a key identifier in token payloads.

### Environment variables

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_TOKEN_SECRET`
- `JWT_ACCESS_TOKEN_SECRET_VERSION`
- `JWT_REFRESH_TOKEN_SECRET`
- `JWT_REFRESH_TOKEN_SECRET_VERSION`
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

## 4.12 Testing Strategy

- Unit test `AuthService`, `TokenService`, `OtpService`, `RefreshTokenRepository`, and auth guards.
- Integration test auth endpoints against test PostgreSQL and Redis instances.
- End-to-end test registration, login, token refresh, logout, and invalid flows.
- Security test rate limiting, invalid token handling, and account lockout scenarios.
- Coverage goal: at least 90% for auth module logic.

## 4.13 Future Extensions

- Password reset flows with secure token delivery.
- True MFA for admin and optionally driver/passenger accounts.
- Device and session management UI.
- Adaptive risk-based authentication.
- Social or federated login providers.

## 4.14 Readiness Review

### Findings

- The auth architecture is scoped to MVP and avoids unnecessary complexity.
- The auth module boundaries and token strategies are complete.
- OTP and refresh token rotation behaviours are explicit.
- RBAC and authorization enforcement are defined.

### Risks

- OTP-first login depends on SMS/email provider reliability.
- Refresh token rotation introduces complexity; implementation must strictly avoid reuse.
- Strong admin MFA is planned but may be deferred for MVP.

### Mitigations

- Use fallback email and provider health monitoring.
- Hash refresh tokens and track rotation chains.
- Implement an admin role policy and require MFA in a subsequent release if not in MVP.

### Phase 4 Completion Checklist

- [x] Authentication and authorization requirements defined.
- [x] Token and OTP strategy specified.
- [x] RBAC roles and permission model documented.
- [x] Auth module architecture and endpoints defined.
- [x] Security controls for auth flows documented.
- [x] Frontend auth patterns for mobile and web defined.
- [x] Operational and testing requirements described.
- [x] Future extensions and readiness review completed.

Phase 4 is complete and the authentication architecture is ready for implementation in Phase 5: Backend Foundation.
