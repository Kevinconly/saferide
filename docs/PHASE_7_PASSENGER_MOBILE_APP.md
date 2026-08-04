# Phase 7: Passenger Mobile App - SafeRide Kigali

This document defines the architecture, UX design, and implementation blueprint for the SafeRide Kigali passenger mobile application. It focuses on the passenger experience, secure mobile authentication, ride request workflows, and integration with the backend and external services.

This phase is design-only and prepares the mobile app for implementation with React Native and TypeScript.

## 7.1 Purpose

The passenger mobile app is the primary customer-facing interface for requesting rides, tracking drivers, managing payments, and viewing ride history. It must feel native, be fast on low-bandwidth connections, and prioritize safety, simplicity, and reliability.

## 7.2 Objectives

- Define the passenger app user experience and core screens.
- Specify the React Native architecture, navigation, and state model.
- Define the API layer, authentication, and offline support strategy.
- Define folder structure and shared type usage.
- Define security, performance, accessibility, and testing requirements.
- Confirm MVP scope and defer non-essential features.

## 7.3 High-Level App Architecture

The passenger mobile app is a React Native application with the following architecture:

- `Screens` represent major user flows such as onboarding, ride request, ride tracking, and history.
- `Navigation` uses React Navigation for stacks, tabs, and modals.
- `State Management` uses React Query for remote data and a lightweight local store for auth and session state.
- `API Layer` uses a typed HTTP client for REST endpoints and handles token refresh transparently.
- `Authentication` uses JWT access tokens with refresh tokens stored in secure storage.
- `Offline Strategy` caches essential data locally and gracefully handles intermittent connectivity.
- `External integrations` include Google Maps for pickup/dropoff search and Firebase Cloud Messaging for push notifications.

## 7.4 Passenger Experience and Core Workflows

### 7.4.1 Onboarding and Authentication

Users should be able to:
- enter their phone number and optionally an email address.
- receive and submit OTP codes.
- verify their phone number before using the app.
- complete basic profile creation if needed.
- log in quickly with OTP or password if supported later.

### 7.4.2 Ride Request Flow

Passengers should be able to:
- enter pickup and dropoff locations.
- view a fare estimate and service coverage validation.
- request a ride and wait for driver assignment.
- see driver details once accepted.
- track the driver en route and view arrival ETA.
- communicate critical status changes.

### 7.4.3 Active Ride Tracking

During an active ride, the passenger should see:
- ride status progression in a timeline.
- driver profile information and contact options.
- current driver location on a map.
- ride fare summary and estimated completion time.
- cancel ride if allowed by business rules.

### 7.4.4 Payments and Receipts

Passengers should be able to:
- choose a supported mobile money payment method.
- see payment method status and any required authorizations.
- view ride receipts and payment details after completion.

### 7.4.5 Ride History and Support

Passengers should be able to:
- view past rides with status, fare, and driver information.
- rate completed rides.
- open basic support or dispute flows in future releases.

### 7.4.6 Settings and Profile

Passengers should be able to:
- update their profile details.
- manage notification preferences.
- sign out securely.

## 7.5 Screen and Navigation Design

### Primary Screens

- `AuthLoadingScreen`: startup auth check and redirect.
- `PhoneEntryScreen`: phone number entry.
- `OtpVerificationScreen`: OTP submission.
- `ProfileCompletionScreen`: optional email and profile details.
- `HomeScreen`: ride request home with pickup/dropoff entry.
- `RideRequestScreen`: ride details, fare estimate, and confirm request.
- `RideWaitingScreen`: waiting for driver acceptance.
- `RideTrackingScreen`: active ride status and map view.
- `RideSummaryScreen`: completed ride details and receipt.
- `HistoryScreen`: list of past rides.
- `RideDetailsScreen`: details for a specific ride.
- `PaymentScreen`: payment method management and status.
- `SettingsScreen`: account settings and logout.

### Navigation structure

- `AuthStack`: onboarding and auth flows.
- `MainTabNavigator`: home, history, payments, settings.
- `RideFlowModal`: waiting, tracking, and summary screens shown modally during an active ride.
- `Drawer` or `BottomTab`: not required in MVP, bottom tabs preferred for simplicity.

### Navigation patterns

- Use stack navigation for linear auth and ride request flows.
- Use modal presentation for active ride details and cancellation dialogs.
- Keep deep linking support for ride invitations or status updates as an extension.

## 7.6 State Management

### Remote data

- Use React Query for fetching and mutating remote resources.
- Use query invalidation after ride creation, ride state updates, and profile changes.
- Keep caching short for dynamic ride status and longer for static user profile data.

### Local state

- Use a lightweight store (e.g. Zustand or React context) for auth state, device token, and transient UI state.
- Store only non-sensitive UI state locally.

### Auth state

- Keep the current user and token metadata in a secure auth context.
- Persist refresh tokens in secure storage and restore auth state on app start.
- Use automatic access token refresh before expiry.

### Offline caching

- Use React Query cache for previously fetched ride history and profile data.
- Cache pickup/dropoff search suggestions where feasible.
- Avoid accepting rides while offline; require active connectivity for core booking flows.

## 7.7 API Layer

### API client

- Use a single HTTP client wrapper around `fetch` or `axios`.
- Support automatic authorization header injection.
- Support refresh token flow when access tokens expire.
- Normalize error responses from the backend.
- Use shared DTO types from `packages/shared-types/`.

### API endpoints

Passenger app endpoints include:
- `POST /auth/request-otp`
- `POST /auth/verify-otp`
- `POST /auth/login`
- `POST /auth/token/refresh`
- `GET /users/me`
- `PATCH /users/me`
- `POST /rides`
- `GET /rides/:id`
- `POST /rides/:id/cancel`
- `GET /rides?status=...`
- `GET /ride-history`
- `GET /payments/methods`
- `POST /notifications/register-token`

### Error handling

- Map API errors to user-friendly messages.
- Handle network failures with retry prompts and offline notices.
- Display validation errors inline in forms.

## 7.8 Authentication

### Token storage

- Use secure storage for refresh tokens.
- Keep access tokens in memory and rehydrate only via refresh flow.
- Avoid storing access tokens in plaintext storage.

### Login flow

- Use OTP-first login for the MVP.
- Optionally support password login later but defer for future releases.

### Session management

- Refresh access tokens automatically before expiry.
- Clear auth state and revoke refresh token on sign out.
- Handle token expiry gracefully by redirecting to auth flow.

## 7.9 Offline and Connectivity Strategy

### Offline behavior

- The app should handle temporary network loss gracefully.
- Provide cached ride history and profile data when offline.
- Display an offline banner and disable actions requiring backend connectivity.
- Allow the user to retry failed requests manually.

### Connectivity checks

- Use a network connectivity hook to detect online/offline state.
- Use connectivity state to gate ride requests and payment actions.
- Do not attempt ride booking or payment initiation while offline.

## 7.10 External Integrations

### Google Maps

- Use maps for pickup and dropoff search and location display.
- Use the Google Maps SDK or REST APIs via the backend depending on platform requirements.
- Validate pickup/dropoff against the service area boundaries.

### Firebase Cloud Messaging

- Register device tokens for push notifications.
- Use notifications to inform passengers of ride status changes and driver arrival.
- Handle notification taps to deep-link into active ride screens.

### Backend

- Use the backend API for all user, ride, and payment workflows.
- Use Socket.IO for receiving real-time ride status and driver location updates.

## 7.11 Security Architecture

### Secure data handling

- Use HTTPS for all remote communication.
- Protect tokens in secure storage.
- Do not log sensitive data such as OTP codes or tokens.

### Input validation

- Validate phone numbers, addresses, and payment input on the client.
- Use typed schemas with Zod for forms and API request payloads.

### Permissions

- Use backend-enforced RBAC; client-side restrictions are only UI-level convenience.
- Do not expose admin-only or driver-only API endpoints to the passenger app.

### Push token security

- Register FCM tokens only after authentication.
- Send push tokens to backend through authenticated endpoints.

### File upload security

- Not required for passenger app MVP beyond potential profile photo upload, which can be deferred.

## 7.12 Performance and UX Standards

### Performance targets

- Initial app load: under 3 seconds on low-end devices.
- Ride request submission: under 1 second for successful network round-trip.
- Map and ride tracking updates: real-time updates under 1 second when connected.

### UX principles

- Provide a minimal onboarding flow with quick phone verification.
- Use large, easy-to-tap controls for ride requests and cancellations.
- Keep the main ride flow centered on a single home screen.
- Use clear status messages and progress indicators.
- Provide fallback experiences for slow or unreliable networks.

### Accessibility

- Use accessible labels and touch targets.
- Ensure contrast ratios meet WCAG 2.1 AA.
- Support screen readers and voice-over where feasible.
- Use textual alternatives for map interactions.

## 7.13 Testing Strategy

### Unit testing

- Test screen components, hooks, and utility functions.
- Test auth and API client logic.

### Integration testing

- Test navigation flows, auth flow, and ride request workflows.
- Use mocked API responses for network interactions.

### End-to-end testing

- Validate the complete passenger flow: auth, ride request, tracking, completion, and history.
- Use E2E tools like Detox or Playwright if platform support allows.

### Performance testing

- Validate app startup and ride flow under realistic network conditions.
- Test map rendering performance and event updates.

### Accessibility testing

- Use automated accessibility checks for UI components.
- Validate screen reader behavior for critical screens.

## 7.14 Folder Structure

The passenger mobile app folder structure should be organized as:

- `app/`
  - `screens/`
  - `navigation/`
  - `components/`
  - `hooks/`
  - `services/`
  - `stores/`
  - `utils/`
  - `types/`
  - `config/`
- `assets/`
- `tests/`
- `packages/` (if shared with driver or web apps)

### Folder responsibilities

- `screens/`: page-level components for each app screen.
- `navigation/`: React Navigation stacks and routing definitions.
- `components/`: reusable presentational components.
- `hooks/`: custom hooks for auth, connectivity, API, and data.
- `services/`: API client, auth service, maps service, notification service.
- `stores/`: local state stores for auth and session state.
- `utils/`: shared helper functions.
- `types/`: app-specific and shared DTOs.
- `config/`: environment and app configuration.
- `assets/`: icons, images, and fonts.
- `tests/`: unit and integration test files.

## 7.15 Deployment Architecture

### Development

- Use Expo or React Native CLI for local development.
- Use device and emulator testing for both Android and iOS.
- Use environment config for local backend URLs.

### Testing

- Use separate staging backend endpoints.
- Use test device tokens for push notifications.

### Production

- Build native app packages for App Store and Google Play.
- Use separate production API endpoints and Firebase projects.
- Manage app configuration securely and separate from development settings.

## 7.16 MVP Scope Validation

### Included in MVP

- Passenger onboarding with phone verification.
- Ride request flow with pickup/dropoff selection.
- Real-time ride status and driver tracking.
- Payment method display and ride receipt.
- Ride history and rating prompt after completion.
- Secure auth with JWT and refresh token handling.
- Push notifications for ride updates.

### Deferred to future releases

- In-app chat or voice communication.
- Complex offline ride creation.
- Saved favorite locations and multi-stop trips.
- Multi-language support beyond English initially.
- Profile photo upload and driver support chat.
- Wallet and card payments.

## 7.17 Readiness Review

### Findings

- The passenger mobile app design is scoped to MVP and avoids unnecessary features.
- The architecture uses industry-standard React Native patterns and shared types.
- The authentication and API layer are aligned with the backend architecture.
- Offline support is scoped appropriately for intermittent connectivity.

### Risks

- Real-time ride tracking depends on Socket.IO and may require careful connection management.
- Push notifications require stable FCM integration and token management.
- Pickup/dropoff selection may require Google Maps API quotas and error handling.

### Mitigations

- Use robust socket reconnection logic and fallback UI for disconnected states.
- Validate push token registration and retry token updates.
- Implement service area validation and graceful map error messages.

### Phase 7 Completion Checklist

- [x] Passenger app UX and core workflows defined.
- [x] React Native architecture and navigation scoped.
- [x] API, auth, and offline strategy defined.
- [x] Folder structure and shared type usage defined.
- [x] Security, performance, and accessibility requirements documented.
- [x] Testing strategy established.
- [x] MVP scope validated and future scope deferred.

Phase 7 is complete and the SafeRide Kigali passenger mobile app is ready for implementation.