# Phase 6: Admin Dashboard - SafeRide Kigali

This document defines the architecture and product specification for the SafeRide Kigali Admin Dashboard. It is the operations console used by admins to manage drivers, passengers, rides, payments, disputes, and platform health.

This phase is design-only and prepares the dashboard for implementation in Next.js.

## 6.1 Purpose

The Admin Dashboard provides SafeRide operations teams with a secure, efficient interface to monitor and manage the platform. It must support rapid incident response, driver verification, dispute resolution, financial reconciliation, and audit review while enforcing RBAC and operational security.

## 6.2 Objectives

- Define Admin Dashboard UX and page structure.
- Specify data, actions, and workflows for admin users.
- Define frontend architecture and folder structure.
- Define secure authentication and authorization patterns.
- Define performance, accessibility, and usability expectations.
- Define testing and validation requirements.

## 6.3 High-Level Dashboard Architecture

The Admin Dashboard is a Next.js application that communicates with the NestJS backend over secure REST APIs and optionally WebSockets for live event updates.

Key architecture elements:

- `Next.js` for routing, server-side rendering (SSR), and production optimization.
- `React Query` for data fetching, caching, and invalidation.
- `React Hook Form` and `Zod` for forms and validation.
- `Tailwind CSS` and `Shadcn UI` for accessible, reusable components.
- `Axios` or typed `fetch` wrapper for API communication.
- `Auth` layer with secure session handling and RBAC enforcement.
- `Layout` layer for navigation, top bar, and global state.
- `Notifications` for toast feedback and live alert banners.

## 6.4 Roles and Permissions

The dashboard supports the following administrative roles:

- `ADMIN`: operational admin who manages drivers, passengers, rides, payments, disputes, and audit access.
- `SUPER_ADMIN`: elevated admin with system configuration, RBAC management, and emergency actions.

### Permission model

- All dashboard routes require authenticated access.
- Sensitive operations require an extra confirmation step.
- `SUPER_ADMIN` actions are distinctly labeled and restricted.
- Permissions are enforced in the backend; frontend guards provide UX clarity only.

## 6.5 Primary Dashboard Sections

### 6.5.1 Operations Home

Purpose:
- Provide an operational snapshot across key metrics.

Content:
- active ride count and trend.
- pending driver verification count.
- open disputes and unresolved incidents.
- payment settlement health indicators.
- critical system alerts.

Actions:
- navigate to critical workflows: verify drivers, review disputes, inspect payments.
- surface top-priority issues requiring attention.

### 6.5.2 User Management

Purpose:
- Manage passenger accounts and support interventions.

Capabilities:
- search/passengers by name, phone, email, status, registration date.
- view passenger profile, verification state, and ride history.
- suspend/reactivate and add admin notes.
- review account security state and audit history.

### 6.5.3 Driver Management

Purpose:
- Manage driver onboarding, verification, and status.

Capabilities:
- review pending driver applications with uploaded document previews.
- inspect driver profile, vehicle details, and ratings.
- approve or reject drivers with structured rejection reasons.
- change driver status among `PENDING`, `ACTIVE`, `REJECTED`, `SUSPENDED`.
- search/filter by status, region, vehicle, rating, and approval date.

### 6.5.4 Ride Monitoring

Purpose:
- Monitor active and recent ride operations.

Capabilities:
- view active rides, their current state, rider and driver details.
- search rides by ride ID, passenger, driver, status, date range, and geo area.
- inspect ride detail pages with pickup/dropoff, route, fare, timeline, and events.
- perform admin actions such as manual cancellation, dispute initiation, or emergency intervention.

### 6.5.5 Payment Monitoring

Purpose:
- Track mobile money payment flows and reconciliation.

Capabilities:
- search transactions by ride, provider, status, date, phone, and amount.
- inspect provider callback logs, failure reasons, and reconciliation notes.
- initiate refunds or payment adjustments subject to policy.
- monitor provider uptime and success rates.

### 6.5.6 Dispute Resolution

Purpose:
- Manage customer and driver disputes.

Capabilities:
- view open, pending, and resolved disputes.
- review dispute details, ride context, payment history, and evidence.
- record resolution decisions, refund amounts, or driver/passenger penalties.
- escalate cases to `SUPER_ADMIN` if required.

### 6.5.7 Audit Logs

Purpose:
- Provide immutable history of admin actions and key system events.

Capabilities:
- search by actor, action, entity type, date range, and outcome.
- view detailed context, request metadata, and affected entities.
- export audit data in CSV for compliance reviews.

### 6.5.8 System Configuration (`SUPER_ADMIN` only)

Purpose:
- Manage environment-specific settings and RBAC.

Capabilities:
- review application config values such as OTP limits, service area settings, and provider endpoints.
- view RBAC roles and permission assignments.
- perform emergency actions such as maintenance mode toggles.

## 6.6 Pages and Components

### Pages

- `/login`
- `/dashboard`
- `/users`
- `/users/[id]`
- `/drivers`
- `/drivers/[id]`
- `/rides`
- `/rides/[id]`
- `/payments`
- `/payments/[id]`
- `/disputes`
- `/disputes/[id]`
- `/audit`
- `/settings`

### Layouts

- `AdminLayout`: sidebar navigation, header, breadcrumbs, notification panel, and user menu.
- `AuthLayout`: login layout with minimal UI and focus on authentication.
- `PageLayout`: reusable page scaffolding for data tables and form pages.

### Components

- `DataTable`: table with sorting, filtering, pagination, selectable rows, and row actions.
- `SearchBar`: reusable search component with debounced query support.
- `StatusBadge`: visual status indicator with accessible labels.
- `ProfileCard`: summary card for user or driver details.
- `RideTimeline`: stepper showing ride lifecycle states.
- `DocumentViewer`: secure preview for driver documents.
- `ActionModal`: confirmation modal for sensitive operations.
- `FiltersPanel`: advanced filters panel for list pages.
- `MetricCard`: KPI display cards.
- `NotificationToast`: toast messages for success/error information.
- `AuditDetails`: expandable audit record viewer.
- `PermissionGuard`: component-level visibility wrapper for restricted actions.

### Shared UI

- Use `packages/ui/` or a shared component library for consistent styling.
- Implement a `ThemeProvider` and ensure layout consistency.
- Support a compact table mode for dense admin workflows.

## 6.7 Data Flow and State Management

### Data fetching

- Use `React Query` for server state management.
- Query keys should include resource type and filter parameters.
- Use background refetching for active ride and payment metrics.
- Use optimistic updates for inline actions such as status changes.
- Use `keepPreviousData` for smoother pagination transitions.

### Global state

- Keep global state minimal.
- Use React Context for auth, user session, and theme.
- Use local component state for filters, modals, and UI controls.

### API layer

- Use a typed API client wrapper that centralizes auth headers, error mapping, and response normalization.
- Expose resource-specific service functions: `usersApi`, `driversApi`, `ridesApi`, `paymentsApi`, `disputesApi`, `auditApi`.
- Support query params for server-side filtering, sorting, and pagination.

### Offline handling

- Admin dashboard requires online connectivity in MVP.
- Use error boundaries and retry controls for failed requests.
- Provide clear user messaging for connectivity degradation.

## 6.8 Security Architecture

### Authentication

- Use secure backend authentication via the Auth module.
- If the dashboard shares domain with backend, persist refresh tokens in HTTP-only secure cookies.
- Access tokens should be stored in memory only.
- Optionally use same-domain cookies and CSRF protection.

### Authorization

- Protect routes with server-side checks and client-side guard wrappers.
- Render pages only when the current user has required roles.
- Disable or hide UI actions when permissions are absent.

### Data protection

- Use HTTPS for all frontend/backend communication.
- Restrict CORS to authorized admin dashboard origins.
- Avoid directly embedding raw HTML responses.
- Fetch document previews through secure backend endpoints or signed URLs.

### Session security

- Expire sessions after configurable inactivity.
- Prompt re-authentication before executing critical actions.
- Use `SameSite=Strict` on auth cookies when applicable.

## 6.9 Performance and UX

### Performance

- Use client-side rendering for list pages with heavy data.
- Use server-side filtering and pagination to limit payloads.
- Cache static dashboard metrics briefly to reduce backend load.
- Use skeleton loaders for slow queries.

### User experience

- Keep admin workflows efficient with direct actions and clear affordances.
- Use consistent visual language and status colors.
- Provide confirmation modals for destructive operations.
- Use accessible keyboard navigation and focus management.

### Accessibility

- Follow WCAG 2.1 AA guidelines.
- Ensure keyboard operability and screen reader compatibility.
- Use semantic HTML and accessible forms.
- Provide alternative text and labels for non-text UI.

## 6.10 Testing Strategy

### Unit testing

- Test page components, forms, utility functions, and permission logic.
- Validate API request generation and error transformation.

### Integration testing

- Test page rendering with mocked API responses.
- Validate role-based access restrictions and guard behavior.
- Test form validation and submission flows.

### End-to-end testing

- Test login, navigation, driver approval, and dispute resolution flows.
- Validate that admin actions trigger expected backend state changes.
- Use Playwright or Cypress for E2E scenarios.

### Performance testing

- Validate large table rendering and filtering under realistic dataset sizes.
- Monitor page load times for slow backend responses.

### Accessibility testing

- Use automated tools like axe.
- Validate keyboard navigation, focus order, and screen reader announcements.

## 6.11 Metrics and Monitoring

- Track page load times and API response times.
- Monitor error rates for dashboard API calls.
- Track auth failures and permission denials.
- Use frontend logs for critical UI failures and unhandled exceptions.
- Submit metrics to centralized monitoring or Sentry.

## 6.12 Deployment and Runtime

### Environment

- Use separate deployments for development, staging, and production.
- Use environment-specific configuration for API endpoints and auth domains.
- Use feature flags for staged releases of admin functionality.

### Build

- Use Next.js production build for optimized assets.
- Use monorepo tooling and shared type packages.

### Deployment

- Deploy behind Nginx or a load balancer.
- Route `/dashboard` or the admin domain to the Next.js app.
- Enforce TLS termination and secure headers.
- Use caching for static assets and CDN delivery if applicable.

### Monitoring

- Capture frontend errors in Sentry or equivalent.
- Track performance metrics and adoption of critical workflows.
- Monitor auth failures and session expirations.

## 6.13 MVP Scope Validation

### Included in MVP

- Admin dashboard with pages for users, drivers, rides, payments, disputes, and audit logs.
- Secure login and RBAC enforcement.
- Search, filtering, and pagination for primary resources.
- Driver verification workflow and ride monitoring.
- Payment transaction inspection and dispute resolution support.
- Audit log search and export support.

### Deferred to future releases

- Full runtime system configuration beyond simple toggles.
- Analytics dashboards with charts and advanced reporting.
- Cross-application notifications or alerting UI.
- In-app messaging to users or drivers.
- Multi-tenant admin support.
- Workflow automation or escalation rules.

## 6.14 Readiness Review

### Findings

- The admin dashboard architecture aligns with backend and security designs.
- Page structure covers operational domains and support workflows.
- Data layer is scoped for maintainable API integration.

### Risks

- Large data tables may require aggressive server-side pagination and query optimization.
- Document preview and file handling must be secured via signed URLs.
- Admin role enforcement must be consistent between frontend and backend.
- Shared type package versioning needs care across monorepo boundaries.

### Mitigations

- Always use backend filtering and pagination for list endpoints.
- Treat frontend permission checks as UX only, not security.
- Enforce authorization in backend controllers and services.
- Keep shared types synchronized and versioned across packages.

### Phase 6 Completion Checklist

- [x] Admin dashboard scope and page structure defined.
- [x] Frontend architecture and folder layout specified.
- [x] Data flow, state management, and API layer defined.
- [x] Security architecture for auth and RBAC defined.
- [x] Performance and accessibility requirements documented.
- [x] Testing strategy established.
- [x] Deployment and runtime expectations documented.
- [x] MVP scope validated and future scope deferred.

Phase 6 is complete and the Admin Dashboard is ready for implementation in the Next.js application.
