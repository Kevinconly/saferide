# Phase 8: Driver Mobile App - SafeRide Kigali

This document defines the architecture, product requirements, and implementation-ready plan for the SafeRide Kigali Driver Mobile App. This phase is design-only and prepares the React Native driver experience for implementation after backend foundation, authentication, and passenger features are in place.

## 8.1 Purpose

The Driver Mobile App enables verified drivers to receive ride requests, manage their availability, navigate to pickups and dropoffs, view earnings, and communicate with the SafeRide platform securely and reliably.

It must deliver a lightweight, intuitive, responsive mobile experience optimized for drivers in Kigali, with high reliability, robust offline handling for short network interruptions, and secure handling of identity and payments.

## 8.2 Objectives

- Define driver mobile app user journeys and MVP scope.
- Design the application architecture for React Native.
- Specify screens, navigation, state management, and offline strategy.
- Define secure authentication and authorization patterns for drivers.
- Define API integration, real-time updates, and notification handling.
- Define testing, release, and performance expectations.
- Ensure the design aligns with all prior backend and authentication architecture.

## 8.3 High-Level Driver App Architecture

The Driver Mobile App is a React Native application that communicates with the NestJS backend through secure REST APIs and real-time Socket.IO channels.

Key architecture components:

- React Native application for Android and iOS support.
- TypeScript for type-safe app logic.
- React Navigation for screen transitions.
- React Query for server state and caching.
- Redux Toolkit or React Context for local UI and session state.
- Axios or a typed fetch client for API calls.
- Socket.IO client for live ride request and status updates.
- Firebase Cloud Messaging for push notifications when the app is backgrounded or closed.
- Secure storage for tokens and sensitive state.
- Location services for GPS tracking.
- Offline resilience for temporary connectivity loss.

## 8.4 Driver User Journey

### 8.4.1 Onboarding and Login

- Driver installs the app.
- Driver signs in with phone number and OTP.
- If first-time, the driver completes registration with email, full name, national ID, vehicle details, and uploads required documents.
- Driver waits for admin verification in the dashboard.
- Admin approves driver before they can accept rides.

### 8.4.2 Availability and Status

- Driver toggles availability between `OFFLINE` and `ONLINE`.
- When `ONLINE`, the app sends periodic location updates and is eligible to receive ride requests.
- When `OFFLINE`, location tracking stops and the driver cannot be assigned new rides.

### 8.4.3 Ride Request Flow

- When a ride request arrives, the app displays a high-priority request card with pickup location, destination, fare estimate, and passenger summary.
- Driver can accept or reject within a configurable timeout.
- Acceptance confirms intent to serve and triggers the backend to reserve the ride.
- Rejection returns the ride to matching and may affect driver service scoring if repeated excessively.

### 8.4.4 Active Ride Experience

- After acceptance, driver sees route details and navigation summary.
- The app guides the driver through ride stages: `EN_ROUTE_TO_PICKUP`, `ARRIVED_AT_PICKUP`, `PICKED_UP`, `EN_ROUTE_TO_DROPOFF`, `COMPLETED`.
- Driver can update status with one tap and send ETA updates through the system.
- The app shows passenger contact methods if supported by backend policies.

### 8.4.5 Ride Completion and Earnings

- Upon completion, the driver confirms dropoff and sees fare breakdown and earnings summary.
- Completed rides update driver earnings and daily summary.

### 8.4.6 Driver Dashboard

- Driver sees daily earnings, completed rides, acceptance rate, and account status.
- Driver can view upcoming or recent rides and payment history.
- Driver can update profile and vehicle information.

### 8.4.7 Support and Dispute Reporting

- Driver can flag issues with rides and request support.
- Driver can view ride disputes or payment adjustments initiated by the platform.

## 8.5 Driver App MVP Scope

### Included in MVP

- Phone + OTP authentication and driver login.
- Driver onboarding with profile and vehicle registration.
- Driver availability toggle and status management.
- Ride request reception, accept/reject flow, and status progression.
- Real-time ride updates via Socket.IO.
- Earning summary and ride history.
- Push notifications for ride requests and important alerts.
- Secure storage of auth tokens and session information.
- Backend-driven access control to prevent unverified drivers from receiving requests.

### Deferred to Future Releases

- Driver in-app chat with passengers.
- In-app navigation; only route guidance summary with external map integration.
- Multiple rides in queue or pooled rides.
- Driver referral program and advanced incentives.
- Offline ride creation or manual route entry.
- Multiple vehicle profiles per driver.
- Complex dispute case management UI.

## 8.6 App Folder Structure

The driver app folder model should remain simple and scalable.

Suggested structure:

- `apps/driver-mobile/`
  - `src/`
    - `assets/`
    - `components/`
    - `config/`
    - `constants/`
    - `hooks/`
    - `navigation/`
    - `screens/`
    - `services/`
    - `store/`
    - `styles/`
    - `utils/`
    - `types/`
    - `App.tsx`
  - `android/`
  - `ios/`
  - `babel.config.js`
  - `metro.config.js`

### Folder responsibilities

- `assets/`: static images, icons, fonts.
- `components/`: reusable UI components such as cards, buttons, modals, and request cards.
- `config/`: environment-specific configuration and runtime constants.
- `constants/`: constant values like route names, permissions, colors, and status labels.
- `hooks/`: custom hooks for auth, location, network status, and socket events.
- `navigation/`: navigation stack definitions and route guards.
- `screens/`: feature screens for every major driver workflow.
- `services/`: API clients, socket client, FCM handler, storage utilities.
- `store/`: app state management (Redux slices or context providers).
- `styles/`: shared style utilities and theme definitions.
- `utils/`: helper functions, date formatting, validation utilities.
- `types/`: TypeScript interfaces for API contracts, domain models, and screen props.

## 8.7 Screen Design

### Core screens

- `AuthLoadingScreen`: initial loading and auth state detection.
- `LoginScreen`: phone number entry.
- `OtpVerificationScreen`: OTP code entry and resend.
- `OnboardingScreen`: driver registration form and document uploads.
- `VerificationPendingScreen`: status display while admin approves.
- `HomeScreen`: availability toggle, current ride status, and earnings snapshot.
- `RideRequestScreen`: incoming ride request card with accept/reject.
- `RideDetailScreen`: active ride details, passenger info, pickup/dropoff, status buttons.
- `RideHistoryScreen`: list of past rides and summary cards.
- `EarningsScreen`: daily totals, payout summary, and completed rides.
- `ProfileScreen`: driver profile, vehicle details, and document status.
- `SupportScreen`: contact support or report ride issues.
- `SettingsScreen`: app preferences, logout, and legal links.

### Navigation structure

- `AuthStack`: login, OTP, onboarding, verification pending.
- `MainTabNavigator`: home, rides, earnings, profile.
- `RideModalStack`: active ride detail and support modals.
- `SettingsStack`: nested settings and help views.

### Navigation behavior

- Use a protected route guard that checks driver authentication and verification status.
- If the user is unauthenticated, route to `AuthStack`.
- If the user is authenticated but not verified, route to `VerificationPendingScreen`.
- Active ride events should be able to open the app on notification and deep-link directly to `RideDetailScreen`.

## 8.8 State Management

### Server state

- Use `React Query` for API queries and mutations:
  - `useDriverProfileQuery`
  - `useRideRequestQuery`
  - `useActiveRideQuery`
  - `useRideHistoryQuery`
  - `useEarningsQuery`
- Configure stale times and refetch intervals for active ride and status data.
- Use mutation side effects to invalidate relevant queries after ride status updates.

### Local UI state

- Use React Context or Redux Toolkit for session, availability status, socket connection state, and location permission state.
- Keep global state focused on user session and active ride metadata needed by multiple screens.
- Local component state should manage modals, form inputs, and transient UI feedback.

### Persistence

- Persist auth token and refresh token securely using secure storage.
- Persist driver session state and last known active ride metadata for fast restore after restart.
- Avoid persisting sensitive ride request details beyond what is necessary for recovery.

## 8.9 API Layer and Contracts

### API communication

- Use a typed API client wrapper in `services/apiClient.ts`.
- Centralize header injection, error handling, and response normalization.
- Support query string serialization for filters and pagination.
- Expose dedicated service modules:
  - `authService`
  - `driverService`
  - `rideService`
  - `earningsService`
  - `supportService`

### Expected backend contracts

- `POST /auth/login` - submit phone number, returns a temporary token and OTP context.
- `POST /auth/verify-otp` - exchange OTP for access and refresh tokens.
- `POST /auth/refresh-token` - rotate refresh token.
- `GET /drivers/me` - driver profile and verification status.
- `POST /drivers` - create or update driver registration.
- `PATCH /drivers/me/status` - update `ONLINE`/`OFFLINE`.
- `GET /rides/active` - fetch the current assigned ride.
- `POST /rides/{rideId}/accept` - accept a pending ride.
- `POST /rides/{rideId}/reject` - reject a pending ride.
- `PATCH /rides/{rideId}/status` - update ride stage.
- `GET /rides/history` - fetch completed ride history.
- `GET /earnings` - fetch earnings summary.
- `POST /support/tickets` - create support incident.

### Error handling

- Handle HTTP status codes explicitly:
  - `401` unauthorized
  - `403` forbidden
  - `404` not found
  - `429` rate limit exceeded
  - `500` server error
- Provide localized, user-friendly messages for driver-facing errors.
- Handle `refresh_token_required` or token expiration by triggering refresh or logout.

## 8.10 Real-Time and Notification Architecture

### Socket.IO

- Use Socket.IO for ride requests, active ride updates, and driver status events.
- Connect only when the driver is authenticated and authorized.
- Authenticate the socket connection with the access token.
- Subscribe to driver-specific channels using a secure driver identifier.
- Handle socket reconnects transparently and recover event subscriptions after reconnect.
- Close the socket when the driver goes `OFFLINE` or logs out.

### Push notifications

- Use Firebase Cloud Messaging for background notifications.
- Register driver device tokens with the backend after login.
- Use FCM for: incoming ride requests, verification status changes, payout alerts, and emergency platform messages.
- Implement deep linking so notification taps route to the correct screen.
- Validate notification payloads on receipt and avoid showing data without backend reconciliation.

### Fallback behavior

- When the app is backgrounded or network is lost, rely on push notifications to re-engage the driver.
- When a ride request arrives while the app is backgrounded, FCM notification should prompt the driver to open the app.
- Use local device notifications only for platform-level alerts if supported.

## 8.11 Location and Offline Strategy

### Location updates

- Request GPS permission explicitly and transparently explain usage.
- Use location updates while the driver is `ONLINE` and the app is foregrounded.
- For MVP, avoid background location updates except when a ride is active and policy allows.
- Send periodic location pings to the backend while `ONLINE` to support matching and dispatch.
- Throttle location updates to balance freshness and battery usage.

### Offline resilience

- Detect network connectivity changes using native APIs.
- Allow drivers to remain on their last known status during brief connectivity loss.
- Queue critical outbound actions such as ride status changes and retry them when connectivity returns.
- If the app is offline for longer than a safe threshold while `ONLINE`, automatically set the driver to `OFFLINE` and notify them.
- Do not allow new ride acceptance when backend connectivity is unavailable.

### Data caching

- Cache the latest driver profile, verification state, and active ride details locally.
- Use cached data only for UI continuity; always validate with the backend on reconnection.
- Clear stale ride data once a ride transitions to `COMPLETED` or is canceled.

## 8.12 Security Architecture

### Authentication and token storage

- Use JWT access tokens and rotating refresh tokens as defined in Phase 4.
- Store refresh tokens in the platform's secure storage.
- Keep access tokens in memory when possible, but allow secure storage only if required for resume.
- Use secure device storage APIs: `expo-secure-store`, `react-native-keychain`, or native secure storage.

### Authorization

- Use backend authorization checks for all driver operations.
- Ensure unverified drivers cannot progress to the ride request path.
- Enforce role checks on backend endpoints and socket connections.

### Data protection

- Use HTTPS for all API calls and socket connections.
- Use strong TLS cipher suites and certificate pinning if practical.
- Do not persist sensitive personal data beyond what is required for the driver profile.
- Protect driver uploaded documents and profile images using signed URLs and secure storage in the backend.

### Input validation

- Validate all forms locally and ensure backend validation is authoritative.
- Sanitize user-provided text such as names, vehicle numbers, and comments.
- Use Zod or schema validation for any complex local data parsing.

### Session management

- Invalidate the session after logout and clear all persisted tokens.
- Handle `401` responses by attempting token refresh once, then forcing re-login on failure.
- Support remote logout from the backend if suspicious activity is detected.

## 8.13 Driver-Specific Domain Rules

### Driver verification

- Drivers may only receive ride requests after the backend confirms `VERIFIED` status.
- Pending verification status is reflected in the app with a `VerificationPendingScreen` and a progress summary.
- Rejected drivers receive an explicit rejection reason and next-step guidance.

### Availability rules

- Drivers cannot set `ONLINE` if required vehicle documents are missing or verification is incomplete.
- The app enforces availability toggles through backend state.

### Ride acceptance rules

- Ride requests must be accepted or rejected within a configurable timeout.
- Accepting a request reserves it for that driver and prevents duplicate assignment.
- Rejecting a request may decrement service score if a driver repeatedly rejects assignments.

### Ride status rules

- The driver must progress the ride through required states.
- Invalid state transitions should be rejected by the backend and surfaced clearly in the UI.
- `ARRIVED_AT_PICKUP` should only be available after `EN_ROUTE_TO_PICKUP`.
- `PICKED_UP` should only be available after `ARRIVED_AT_PICKUP`.

### Earnings and payouts

- The app shows estimated earnings; the backend calculates the definitive paycheck.
- Driver earnings summary is read-only and updated after ride confirmation.
- Payouts and commissions are managed by platform admin workflows and reflected in earnings history.

## 8.14 Testing Strategy

### Unit tests

- Test navigation guards, availability toggle logic, and form validation.
- Test API client utilities and response handling.
- Test socket event handling and reconnection logic.

### Integration tests

- Test screen flows with mocked API and socket responses.
- Test driver onboarding, verification pending state, and status transitions.
- Test ride acceptance, active ride updates, and completion flows.

### End-to-end tests

- Test login, OTP verification, onboarding, and driver home workflows.
- Test incoming ride request notifications and accept/reject behavior.
- Test active ride progress and earnings update.

### Performance tests

- Validate app startup time and screen rendering performance.
- Test socket reconnection behavior under fluctuating network.
- Monitor CPU/battery usage of location updates.

### Accessibility tests

- Ensure interactive controls are reachable via touch and screen reader friendly.
- Validate contrast ratios and large-touch target sizes.
- Ensure notification banners and modals are announced appropriately.

## 8.15 Deployment and Runtime

### Environment setup

- Use separate environment configurations for development, staging, and production.
- Store API base URLs, Firebase project keys, and service flags in environment variables.
- Use build-time injection for app configuration.

### Distribution

- Prepare both Android and iOS builds.
- Use internal testing channels for QA before production release.
- Ensure compliance with local app distribution policies.

### Monitoring

- Capture crash reports with Sentry or a mobile-friendly monitoring platform.
- Track push notification delivery and deep-link behavior.
- Monitor socket connection errors and failed API requests.

### Logging

- Use structured client-side logging for important lifecycle events.
- Avoid logging sensitive driver and passenger identifiers.
- Surface recoverable errors in the UI while sending diagnostic payloads to monitoring.

## 8.16 MVP Scope Validation

### Included in MVP

- Driver login via OTP and secure session handling.
- Driver registration and verification pending flow.
- Availability toggle and real-time ride request handling.
- Basic active ride workflow and status updates.
- Ride history and earnings summary.
- Push notifications via Firebase Cloud Messaging.
- Secure token storage and offline resilience for short disconnections.

### Deferred to future releases

- In-app navigation or route guidance beyond summary directions.
- Multi-ride queueing, ride pooling, or multi-stop rides.
- Integrated chat between driver and passenger.
- Driver incentives, bonuses, or referral programs.
- Background location tracking outside ride flow.
- Multi-vehicle support and driver asset management.

## 8.17 Readiness Review

### Findings

- The driver app architecture aligns with the backend and existing auth design.
- The screen flow covers the core driver lifecycle without unnecessary complexity.
- Real-time and offline strategies are scoped for an MVP driver experience.
- Security and authorization are handled at the backend, with mobile-specific safeguards.

### Risks

- GPS permission and location tracking can be sensitive; the app must explain usage clearly.
- Real-time socket reliability must be validated under local mobile network conditions.
- Offline resilience for temporary disconnection must not allow drivers to remain incorrectly `ONLINE`.
- Push notification routing and deep links must be tested thoroughly on both platforms.

### Mitigations

- Keep location updates minimal and transparent; restrict background location to active rides only.
- Use reconnect strategies and fallback to polling for critical status updates if Socket.IO fails.
- Automatically set availability to `OFFLINE` after sustained connectivity loss.
- Validate FCM token registration and backend device mapping during login.

### Phase 8 Completion Checklist

- [x] Driver app user journeys defined.
- [x] React Native architecture and folder layout specified.
- [x] Screen, navigation, and state management design completed.
- [x] API and real-time communication strategy defined.
- [x] Security architecture for driver data and auth defined.
- [x] Offline and location strategies documented.
- [x] Testing, deployment, and monitoring plans established.
- [x] MVP scope validated and future features deferred.

Phase 8 is complete and the Driver Mobile App architecture is ready for implementation in React Native.
