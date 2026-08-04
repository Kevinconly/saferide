# Phase 3: Database Design - SafeRide Kigali

This document defines the database architecture for the SafeRide Kigali MVP. It includes the data model, persistence strategy, normalization rules, indexing, constraints, transactions, concurrency controls, retention policy, and migration approach.

## 3.1 Database Design Overview

SafeRide Kigali uses PostgreSQL as the single source of truth for transactional domain data. The database is designed to support:

- secure passenger and driver accounts,
- ride lifecycle state and location tracking,
- payment transaction recording,
- administrative audit trails,
- OTP and refresh-token metadata,
- dispute and rating history.

Primary design goals:

- ACID transactional integrity for ride and payment workflows.
- Clear domain modeling for user, driver, ride, payment, and audit entities.
- Indexing aligned with expected query patterns.
- Secure handling of personally identifiable information.
- Scalability for future growth and analytic needs.
- Auditability and compliance.

## 3.2 Core Entities and Relationships

The database model is built around a single `User` entity with role differentiation and a dedicated `DriverProfile` entity for driver-specific data. Ride and payment domains reference those base entities.

### Core Entities

- `User`
- `DriverProfile`
- `Ride`
- `RideLocation`
- `PaymentTransaction`
- `DriverDocument`
- `RefreshToken`
- `AuditLog`
- `Dispute`
- `Rating`
- `Payout`
- `ServiceArea` (optional reference table for regional expansion)

### Relationship principles

- `User` is the base identity for passengers, drivers, and admins.
- `DriverProfile` extends `User` for driver-specific onboarding and vehicle data.
- `Ride` records reference both passenger and driver identities.
- `RideLocation` captures timestamped GPS state for active rides.
- `PaymentTransaction` is the financial ledger record for a ride.
- `DriverDocument` stores metadata for uploaded verification documents.
- `AuditLog` records immutable actions across the system.
- `Rating` links rating events to users and rides.
- `Dispute` captures disputed rides and resolution metadata.
- `Payout` tracks driver settlement summaries.

### Entity relationship diagram

```
User 1---1 DriverProfile
User 1---* Ride (as passenger)
DriverProfile 1---* Ride (as driver)
Ride 1---* RideLocation
Ride 1---1 PaymentTransaction
Ride 1---0..1 Dispute
User 1---* Rating
Ride 1---* Rating
DriverProfile 1---* DriverDocument
User 1---* RefreshToken
User 1---* AuditLog
DriverProfile 1---* Payout
```

## 3.3 Prisma Schema Specification

The following Prisma schema is a proposed starting point for the MVP data model. It is intentionally normalized and includes keys, indexes, and constraints aligned with expected access patterns.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserRole {
  GUEST
  PASSENGER
  DRIVER
  ADMIN
  SUPER_ADMIN
}

enum DriverStatus {
  PENDING
  ACTIVE
  REJECTED
  SUSPENDED
}

enum RideStatus {
  REQUESTED
  PENDING_ACCEPTANCE
  ACCEPTED
  DRIVER_EN_ROUTE
  ARRIVED
  PASSENGER_ON_BOARD
  IN_PROGRESS
  COMPLETED
  CANCELLED
  DRIVER_NO_SHOW
  PASSENGER_NO_SHOW
  DISPUTE
  FAILED
}

enum PaymentStatus {
  INITIATED
  PENDING
  SETTLED
  FAILED
  REFUNDED
}

enum DocumentType {
  ID_CARD
  DRIVER_LICENSE
  VEHICLE_REGISTRATION
  INSURANCE
}

enum AuditAction {
  USER_UPDATE
  DRIVER_APPROVAL
  RIDE_STATE_CHANGE
  PAYMENT_ADJUSTMENT
  DISPUTE_RESOLUTION
  AUTH_EVENT
  PERMISSION_CHANGE
}

model User {
  id               String            @id @default(uuid())
  role             UserRole          @default(PASSENGER)
  phone            String            @unique
  email            String?           @unique
  passwordHash     String?
  name             String?
  isPhoneVerified  Boolean           @default(false)
  isEmailVerified  Boolean           @default(false)
  statusMessage    String?
  preferredLanguage String?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  deletedAt        DateTime?

  driverProfile    DriverProfile?    @relation(fields: [driverProfileId], references: [id])
  driverProfileId  String?           @unique
  refreshTokens    RefreshToken[]
  ridesAsPassenger Ride[]            @relation("PassengerRides")
  ratingsReceived  Rating[]         @relation("RatingsReceived")
  ratingsGiven     Rating[]         @relation("RatingsGiven")
  auditLogs        AuditLog[]        @relation("ActorAuditLogs")
  payouts          Payout[]
}

model DriverProfile {
  id                  String           @id @default(uuid())
  user                User             @relation(fields: [userId], references: [id])
  userId              String           @unique
  status              DriverStatus     @default(PENDING)
  licenseNumber       String           @unique
  vehicleNumber       String           @unique
  vehicleMake         String
  vehicleModel        String
  vehicleYear         Int
  insuranceProvider   String?
  insuranceExpiry     DateTime?
  approvedAt          DateTime?
  rejectedAt          DateTime?
  suspensionReason    String?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt
  deletedAt           DateTime?

  documents           DriverDocument[]
  rides               Ride[]           @relation("DriverRides")
}

model DriverDocument {
  id           String       @id @default(uuid())
  driver       DriverProfile @relation(fields: [driverId], references: [id])
  driverId     String
  type         DocumentType
  storageKey   String       @unique
  fileName     String
  contentType  String
  fileSize     Int
  verified     Boolean      @default(false)
  uploadedAt   DateTime     @default(now())
  verifiedAt   DateTime?
  rejectedAt   DateTime?
  rejectionReason String?
  deletedAt    DateTime?
}

model Ride {
  id               String           @id @default(uuid())
  passenger        User             @relation("PassengerRides", fields: [passengerId], references: [id])
  passengerId      String
  driver           DriverProfile?   @relation("DriverRides", fields: [driverId], references: [id])
  driverId         String?
  status           RideStatus       @default(REQUESTED)
  pickupAddress    String
  pickupLatitude   Decimal          @db.Decimal(10, 7)
  pickupLongitude  Decimal          @db.Decimal(10, 7)
  dropoffAddress   String
  dropoffLatitude  Decimal          @db.Decimal(10, 7)
  dropoffLongitude Decimal          @db.Decimal(10, 7)
  estimatedFare    Decimal          @db.Decimal(10, 2)
  finalFare        Decimal?         @db.Decimal(10, 2)
  requestedAt      DateTime         @default(now())
  acceptedAt       DateTime?
  enRouteAt        DateTime?
  arrivedAt        DateTime?
  passengerOnBoardAt DateTime?
  startedAt        DateTime?
  completedAt      DateTime?
  cancelledAt      DateTime?
  noShowAt         DateTime?
  cancellationReason String?
  noShowReason     String?
  driverNoShow     Boolean          @default(false)
  passengerNoShow  Boolean          @default(false)
  routePolyline    String?
  rideMetadata     Json?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
  deletedAt        DateTime?

  locations        RideLocation[]
  payment          PaymentTransaction?
  dispute          Dispute?
  ratings          Rating[]
}

model RideLocation {
  id         String   @id @default(uuid())
  ride       Ride     @relation(fields: [rideId], references: [id])
  rideId     String
  latitude   Decimal  @db.Decimal(10, 7)
  longitude  Decimal  @db.Decimal(10, 7)
  accuracy   Int?
  recordedAt DateTime @default(now())
}

model PaymentTransaction {
  id                     String        @id @default(uuid())
  ride                   Ride          @relation(fields: [rideId], references: [id])
  rideId                 String        @unique
  provider               String
  providerTransactionId  String        @unique
  status                 PaymentStatus @default(INITIATED)
  requestedAmount        Decimal       @db.Decimal(10, 2)
  capturedAmount         Decimal?      @db.Decimal(10, 2)
  fees                   Decimal?      @db.Decimal(10, 2)
  refundedAmount         Decimal?      @db.Decimal(10, 2)
  paymentMetadata        Json?
  initiatedAt            DateTime      @default(now())
  settledAt              DateTime?
  failedAt               DateTime?
  failureReason          String?
  createdAt              DateTime      @default(now())
  updatedAt              DateTime      @updatedAt
}

model Dispute {
  id                String   @id @default(uuid())
  ride              Ride     @relation(fields: [rideId], references: [id])
  rideId            String   @unique
  submittedByUser   User     @relation(fields: [submittedByUserId], references: [id])
  submittedByUserId String
  category          String
  description       String
  status            String   @default("OPEN")
  resolution        String?
  resolvedByUser    User?    @relation("DisputeResolver", fields: [resolvedByUserId], references: [id])
  resolvedByUserId  String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model Rating {
  id             String   @id @default(uuid())
  ride           Ride     @relation(fields: [rideId], references: [id])
  rideId         String
  fromUser       User     @relation("RatingsGiven", fields: [fromUserId], references: [id])
  fromUserId     String
  toUser         User     @relation("RatingsReceived", fields: [toUserId], references: [id])
  toUserId       String
  score          Int
  comment        String?
  createdAt      DateTime @default(now())
}

model Payout {
  id                String   @id @default(uuid())
  driver            DriverProfile @relation(fields: [driverId], references: [id])
  driverId          String
  periodStart       DateTime
  periodEnd         DateTime
  grossAmount       Decimal  @db.Decimal(10, 2)
  netAmount         Decimal  @db.Decimal(10, 2)
  fees              Decimal  @db.Decimal(10, 2)
  status            String   @default("PENDING")
  processedAt       DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model RefreshToken {
  id             String   @id @default(uuid())
  user           User     @relation(fields: [userId], references: [id])
  userId         String
  tokenHash      String   @unique
  deviceId       String?
  revoked        Boolean  @default(false)
  issuedAt       DateTime @default(now())
  expiresAt      DateTime
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model AuditLog {
  id             String      @id @default(uuid())
  actor          User?       @relation("ActorAuditLogs", fields: [actorId], references: [id])
  actorId        String?
  entityType     String
  entityId       String
  action         AuditAction
  summary        String
  details        Json?
  sourceIp       String?
  userAgent      String?
  createdAt      DateTime    @default(now())
}

model OTPRequest {
  id            String   @id @default(uuid())
  phone         String
  ipAddress     String
  requestedAt   DateTime @default(now())
  status        String   @default("PENDING")
  failureReason String?
}

model ServiceArea {
  id          String   @id @default(uuid())
  regionName  String
  boundary    Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

@@index([phone])
@@index([email])
@@index([role])
```

### Notes on schema design

- `User` stores base identity for all platform actors.
- Driver-specific fields are isolated in `DriverProfile` to keep the core user table lean and enforce one-to-one driver mapping.
- `Ride` stores both pickup and dropoff coordinates with `Decimal(10,7)` to preserve geospatial precision without requiring PostGIS in MVP.
- `RideLocation` stores a timeline of GPS samples for active ride tracking.
- `PaymentTransaction` is a ledger-style record with provider ids and immutable financial amounts.
- `RefreshToken` stores hashed tokens, not raw tokens.
- `AuditLog` is append-only and contains enough metadata for compliance review.
- `OTPRequest` captures request metadata for rate limiting and fraud analysis. The actual OTP secrets are stored in Redis.
- `ServiceArea` is optional but supports future expansion of service boundaries.

## 3.4 Index and Constraint Strategy

### Index strategy

Align indexes with common read patterns and admin queries.

- `User(phone, email)`: unique lookup for authentication and registration.
- `User(role, updatedAt)`: admin queries for drivers, passengers, and inactive accounts.
- `DriverProfile(status, approvedAt)`: onboarding queue and availability checks.
- `Ride(status, requestedAt, passengerId, driverId)`: ride lifecycle queries and passenger/driver history.
- `RideLocation(rideId, recordedAt)`: retrieval of recent location samples for active rides.
- `PaymentTransaction(providerTransactionId, status)`: reconciliation and callback processing.
- `AuditLog(actorId, entityType, entityId, createdAt)`: audit search and compliance queries.
- `RefreshToken(userId, revoked)`: token revocation and session lookups.
- `OTPRequest(phone, requestedAt)`: request rate limiting and abuse analysis.
- `Dispute(status, createdAt)`: dispute handling.

### Constraint strategy

- Use unique constraints for `phone`, `email`, `licenseNumber`, `vehicleNumber`, and `providerTransactionId`.
- Enforce foreign key integrity for all references. For example, `Ride.passengerId` and `Ride.driverId` reference `User.id` and `DriverProfile.id` respectively.
- Use enum types for domain statuses to prevent invalid state values.
- Use non-null constraints for required business-critical fields.
- Use `deletedAt` soft delete columns rather than hard delete cascade in most operational tables.
- Prevent orphaned data by restricting deletion of active users or drivers.

## 3.5 Normalization and Storage Rules

The data model is normalized to avoid duplication while providing performance for expected access patterns.

### Normalization guidelines

- Keep driver-specific metadata in `DriverProfile` rather than in `User`.
- Keep ride state and payment data in separate tables.
- Keep audit and dispute records decoupled from the core transaction records for append-only retention.
- Use JSON columns only for metadata and non-relational extension fields.

### Storage rules

- Store sensitive fields using PostgreSQL encrypted storage where available and enforce strict access policies.
- Persist only the minimum required personal data.
- Do not store OTP codes in the database. Use Redis for ephemeral OTP state.
- Hash refresh tokens and provider secrets before persisting.

## 3.6 Soft Deletes and Auditing

### Soft delete policy

- Use a nullable `deletedAt` timestamp on `User`, `DriverProfile`, `DriverDocument`, `Ride`, and `Payout`.
- Soft deletes preserve history for auditing and dispute resolution.
- Soft deleted records are excluded from normal queries through application-level filters.
- Hard deletion is restricted to background cleanup jobs and legal compliance workflows.

### Audit strategy

- Use `AuditLog` for immutable audit records.
- Every admin action, ride state change, payment adjustment, and authentication event that has security or compliance relevance must generate an audit record.
- Include actor identity, entity type, entity id, action, summary, source IP, user agent, and timestamp.
- Store audit logs separately from transactional data to simplify retention and tamper resistance.

## 3.7 Transactions and Concurrency Control

### Transaction patterns

Use PostgreSQL transactions for any multi-step domain changes that must be atomic.

- Ride creation and driver assignment.
- Ride status transitions.
- Payment transaction initiation and settlement.
- Driver approval and document verification.
- Refund creation and payout adjustments.

Transaction boundaries are enforced in the backend service layer using Prisma `transaction` blocks.

### Concurrency control

- Use optimistic locking for low-conflict updates with an `updatedAt` or version field where appropriate.
- Use database-level locking or serialization for ride assignment and payment settlement to avoid duplicate allocation.
- Use Redis distributed locks when coordinating multi-instance workflows such as matching or OTP request throttling.
- Treat `Ride` status transitions as the source of truth, validating allowed state changes in the service layer before persistence.

### Example patterns

- Acquire a lock before selecting eligible drivers for a ride request.
- Within a transaction, verify ride current status and update it to the next allowed status.
- For payment callbacks, use an idempotency key and database transaction to mark a transaction settled only once.

## 3.8 Retention and Archival

### Data retention policy

- Ride and payment transactional data: retain at least 3 years.
- Audit logs: retain at least 5 years.
- Driver documents: retain for the active relationship plus regulatory period.
- OTP request metadata: retain 90 days for analysis; OTP secret state expires in Redis after 5 minutes.
- Refresh token metadata: retain until token expiry plus audit window.

### Archival strategy

- Use application-level processes or database partitions to archive old historical data when needed.
- For Year 1 MVP, retain data in the primary database but plan for archival or partitioning as size grows.
- Move archival data to a separate analytics store if queries become expensive.

## 3.9 Backup and Disaster Recovery

### Backup strategy

- Use managed PostgreSQL automated backups with point-in-time recovery where possible.
- Retain daily backups for 30 days and weekly snapshots for 90 days.
- Store backup metadata and retention settings in infrastructure configuration.

### Recovery objectives

- Recovery Time Objective (RTO): 2 hours for core transactional data.
- Recovery Point Objective (RPO): 4 hours for transactional data.

### Disaster recovery considerations

- Test restore procedures regularly in a non-production environment.
- Maintain database migration history and schema snapshots.
- Keep database credentials and access controls separate from application secrets.

## 3.10 Migration Strategy and Environment Setup

### Migration approach

- Use Prisma Migrate for schema evolution.
- Keep migration history in `packages/prisma/migrations/` or `db/migrations/`.
- Use `prisma migrate dev` in local development and `prisma migrate deploy` in CI/CD for staging/production.
- Store migration scripts in source control.

### Environment separation

- Use separate PostgreSQL instances for `development`, `testing`, `staging`, and `production`.
- Use environment-specific database URLs with validated config.
- Seed only test and development databases with synthetic data.

### Local development setup

- Use Docker Compose to run PostgreSQL and Redis.
- Provide schema generation and migration scripts for developers.
- Keep sample `.env.example` files in repo documentation.

## 3.11 Data Security and Compliance

### PII handling

- Limit PII to `User.phone`, `User.email`, `User.name`, and verified profile data.
- Protect PII through application access controls and database encryption-at-rest.
- Use field-level encryption for highly sensitive values if required by regulation.

### Sensitive token storage

- Hash refresh tokens in `RefreshToken.tokenHash`.
- Do not store OTP codes in the database.

### Auditability

- Audit logs are immutable and append-only.
- Preserve audit events even when associated users or rides are soft-deleted.

### Compliance support

- Data retention policies support local financial and operational audit requirements.
- Driver verification records are retained for regulatory review.
- Deletion requests are handled by anonymizing user-identifying fields while preserving transactional and audit records.

## 3.12 Scalability and Growth Planning

### Horizontal scaling

- Keep backend instances stateless.
- Use PostgreSQL read replicas for analytics and reporting.
- Use Redis for ephemeral state and coordination.

### Growth planning

- Anticipate `Ride` and `PaymentTransaction` table growth with partitioning by date or region.
- Plan to add a data warehouse for historical reporting once the primary database load grows.
- Use indexes and query optimization before adding denormalized reporting tables.

### Future extensibility

- Add `ServiceArea` or region models for nationwide expansion.
- Add support for multi-currency pricing and additional payment providers.
- Add a dedicated `DriverEarnings` or `Fleet` model if the business evolves.

## 3.13 Query and Access Patterns

### Passenger patterns

- Authenticate user by phone/email.
- Load passenger profile and verification state.
- Create ride request with pickup/dropoff details.
- Query active and historical rides.
- Submit dispute and rating after completion.

### Driver patterns

- Authenticate driver and load profile status.
- Upload documents and view approval status.
- Receive ride offers and update ride status.
- Query earnings and ride history.

### Admin patterns

- Search drivers by status and verification date.
- Filter rides by status, driver, passenger, or time window.
- Review payment transaction status and audit log entries.
- Approve or reject driver onboarding workflows.

### Audit patterns

- Query audit logs by actor, entity type, action, and date range.
- Preserve logs for compliance review.

### Payment/reconciliation patterns

- Query transactions by provider id and status.
- Compare initiated amount, captured amount, and refunded amount.
- Produce payout summaries for driver settlement.

## 3.14 Readiness Review

### Findings

- The design supports the MVP with a normalized, audit-friendly schema.
- The schema anticipates role-based identity and separate driver profile requirements.
- Transaction and concurrency strategies are defined for the ride and payment flows.
- Retention and backup policies align with Phase 1 goals.

### Risks

- High-volume `RideLocation` writes may require pruning or retention rules later.
- `Ride` status transitions must be enforced in application logic to prevent invalid states.
- Large audit log growth may require separate storage or partitioning if query performance degrades.

### Mitigations

- Capture only essential location snapshots and consider periodic compaction.
- Enforce state transitions in the `Ride` service layer and validate in database constraints where possible.
- Plan audit log partitioning or archive pipelines before 5-year retention volume becomes problematic.

### Phase 3 Completion Checklist

- [x] Core entities and relationships defined.
- [x] Prisma data model specification drafted.
- [x] Index and constraint strategy documented.
- [x] Normalization and storage rules set.
- [x] Soft delete and audit strategy defined.
- [x] Transaction and concurrency control patterns specified.
- [x] Retention and backup strategy established.
- [x] Migration strategy and environment setup described.
- [x] Data security and compliance considerations documented.
- [x] Scalability and query patterns validated.
- [x] Readiness review completed.

Phase 3 is complete and the design is ready for Phase 4: Authentication implementation.
