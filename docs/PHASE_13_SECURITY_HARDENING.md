# Phase 13: Security Hardening - SafeRide Kigali

This document defines the security hardening program for SafeRide Kigali. It provides prescriptive controls for application, infrastructure, CI/CD, data protection, incident response, penetration testing, and compliance required to move toward production readiness.

Scope:
- Application-level protections (API, Web, Mobile)
- Infrastructure & network hardening (Docker, Compose, Kubernetes, Nginx)
- Data protection, secrets management, and key lifecycle
- CI/CD and supply chain security
- Monitoring, detection, incident response, and forensics
- Penetration testing and ongoing security program

Audience: CTO, Lead Engineers, DevOps, Security Engineers, QA, and Product Owners.

---

## 13.1 Executive summary

Security is a first-class non-functional requirement for SafeRide Kigali. This phase establishes a defensible security baseline that protects customer data, financial transactions, and the platform's integrity against realistic threats. It enforces secure defaults, defense-in-depth, least privilege, and auditability so the system can operate safely in production and meet regulatory expectations.

Key outcomes:
- Threat model covering major attack surfaces
- Concrete mitigations for OWASP Top 10 and mobile-specific risks
- Infrastructure and deployment hardening guidance
- CI/CD and dependency security controls
- Incident response playbooks and SLOs for detection & containment
- Compliance and evidence gathering approach for audits

---

## 13.2 Threat model (summary)

Top threats prioritized for SafeRide Kigali:
1. Broken Authentication and Session Management (credential theft, refresh token abuse)
2. Authorization bypass (IDOR, privilege escalation)
3. API abuse & rate-limiting circumvention
4. Payment fraud and webhook spoofing
5. Data leakage and sensitive data exposure (PII, payment metadata)
6. Supply chain compromise (vulnerable dependencies, CI secrets leak)
7. Ransomware / data destruction risk
8. Denial of Service (application and infrastructure level)
9. Mobile-specific threats: GPS spoofing, device compromise, token theft
10. Insider threats and admin account misuse

For each threat the document prescribes controls, detection, and response.

---

## 13.3 OWASP Top 10 and mitigations

A. Injection (SQL, command)
- Use Prisma parameterized queries exclusively. Avoid raw SQL unless necessary and guarded.
- Apply strict input validation schemas (Zod) on all DTOs.
- Use ORM query builders and avoid string interpolation.
- Linter/CI rule to flag unsanitized raw queries.

B. Broken Authentication
- Use Argon2 for password hashing; never store plaintext passwords.
- Access tokens: short-lived JWTs (e.g., 15 min), refresh tokens: rotating, stored securely.
- Use HTTP-only, Secure cookies for web refresh tokens where same-origin allowed.
- Enforce MFA for all admin accounts (TOTP + YubiKey support later).
- Implement device fingerprinting and suspicious-session detection.
- Rate-limit authentication endpoints and OTP requests with Redis-backed token buckets.

C. Sensitive Data Exposure
- Encrypt sensitive columns at rest where required (e.g., driver national ID) using application-level encryption or DB Transparent Data Encryption (TDE) depending on cloud provider.
- Ensure S3/uploaded documents are stored in private buckets and served via signed URLs with short TTL.
- Redact PII in logs and store hashes for lookups when possible.

D. XML External Entities (XXE) / SSRF
- For any URL fetches (provider callbacks), validate and sanitize URLs. Restrict allowed hosts.
- Block server-side requests to RFC1918/metadata IPs unless explicitly required and authorized.

E. Broken Access Control (IDOR)
- Implement RBAC with policy enforcement at controller/service layer, not only at UI layer.
- Use object-level authorization checks: ownerId === currentUser || role==admin.
- Add automated tests for IDOR scenarios.

F. Security Misconfiguration
- Harden default configs: disable debug endpoints in prod, enforce strict CORS, helmet, HSTS, content security policy.
- Use minimal permissions for service accounts and principle of least privilege.

G. Cross-Site Scripting (XSS)
- Sanitize any content rendered in web admin pages.
- Use CSP headers and escape rendering surfaces.

H. Insecure Deserialization
- Avoid deserializing arbitrary payloads. Validate schemas with Zod and allowlisted fields only.

I. Using Components with Known Vulnerabilities
- Enforce dependency scanning in CI (Snyk/Dependabot/GitHub Dependabot alerts).
- Lockfile maintenance and periodic dependency upgrades with automated PRs.

J. Insufficient Logging & Monitoring
- Implement audit logs for admin actions and payment events.
- Centralize logs to Loki and errors to Sentry; instrument critical flows with traces.

---

## 13.4 Detailed controls by layer

Application Layer (NestJS API, Next.js):
- Input validation: DTOs + Zod for all endpoints. Fail fast and return sanitized error responses.
- Output encoding: Never render raw user-provided content without escape.
- Authentication: JWT access tokens + rotating refresh tokens with revocation support. Store refresh token hashes in DB and support rotation.
- Authorization: Policy-based RBAC (roles + resource-level policies). Ensure server-side enforcement in guards and services.
- Rate limiting: Redis-backed token bucket for high-risk endpoints (OTP, login, payment webhooks). Use IP + user-based keys.
- Logging: structured logs with correlation IDs but redact PII and tokens. Audit logs immutable and append-only (DB table with write-once semantics or WORM-backed blob).
- Secrets: do not load secrets directly from .env in production; use cloud secrets manager (AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault).

Mobile and Frontend:
- Token storage: use secure storage (Keychain/Keystore) or HTTP-only cookies for web.
- Certificate pinning / TLS verification for critical endpoints where practical.
- Partial obfuscation for app binary; do not store secret API keys in app.
- Validate server TLS and production endpoints; support env-gated debug logs.

Infrastructure & Network:
- Nginx: enable TLS 1.2/1.3 only, disable legacy ciphers, enable HSTS, enable secure headers.
- Network segmentation: separate DB and Redis in private networks; API nodes in private subnets when possible.
- WAF: place Web Application Firewall (Cloud WAF or Nginx modsecurity) in front of public endpoints.
- SSH access: use bastion host and jumpbox; disable root SSH, use key-based auth.

Data Storage:
- Use encrypted volumes in cloud and encrypt backups in S3 with SSE-KMS.
- Limit DB user privileges; prefer per-service DB roles with least privilege.
- Backup verification & restore drills quarterly; store backups in separate account or storage with restricted access.

Kubernetes (future/prod):
- Use NetworkPolicies to restrict pod-to-pod communication.
- Use PodSecurityPolicies or Pod Security Admission (PSA) enforcing non-root containers.
- Use RBAC for Kubernetes resources and avoid cluster-admin except for small set of ops.
- Enable resource quotas and limit ranges.
- Use image scanning for container images (Trivy) and immutable image tags.

---

## 13.5 Authentication & Session Security (detailed)

Token design:
- Access token: JWT (signed with RS256 using short expiration 10–15 minutes); include minimal claims (sub=userId, roles, jti, iat, exp)
- Refresh tokens: opaque random tokens stored as hashed value in DB with rotation on use. Each refresh rotates and invalidates the previous token (one-time-use).
- Client storage:
  - Mobile: secure key storage (Keychain/Keystore)
  - Web: store refresh token in HTTP-only Secure SameSite cookie; store access token in memory-only variable

Token revocation & session management:
- Provide endpoint to list active sessions and revoke them (admin + user capability).
- On suspicious activity, revoke session tokens and force re-login.

MFA:
- Enforce TOTP for SUPER_ADMIN accounts; allow backup codes and hardware token registration.
- For sensitive actions (refunds, payouts), require step-up authentication (re-enter password + 2FA).

OTP:
- OTP use: short TTL (2–5 minutes), max attempts per phone number & per IP.
- Rate limit OTP sends and verifications via Redis.
- Use HMAC-based OTP generation server-side OR rely on provider for SMS OTP; do not hard-code secrets into mobile app.

---

## 13.6 Secure Development Lifecycle & CI/CD

Secure SDLC practices:
- Threat model updates at each major design change and sprint boundary.
- Train developers on secure coding patterns and use code review checklists.

CI/CD controls:
- Secrets: use GitHub Actions secrets or external secret store; avoid plain-text secrets in CI logs.
- Dependency scanning as a required step in CI (Dependabot PRs auto-open, Snyk/OWASP Dependency-Check): fail build on high severity.
- Static analysis: run ESLint, TypeScript strict mode, and run a security linter (semgrep rules for common patterns).
- Container image build: scan images (Trivy) during CI and fail on critical vulnerabilities.
- Signed builds: use provenance attestation when publishing images.
- Environment promotion: require required approvals before promoting to staging/production.

Git hygiene:
- Enforce branch protection rules: required reviews, passing CI, no force push on main.
- Commit signing encouraged for sensitive repos.

---

## 13.7 Supply Chain & Dependency Management

- Track dependencies with lockfiles and maintain automated PRs for updates.
- Use SBOM (Software Bill of Materials) generation in CI and store artifacts for audits.
- Pin base container images and rebuild regularly.
- Vet third-party libraries; avoid packages with low maintenance or suspicious behavior.
- Consider using a dependency allowlist for critical services.

---

## 13.8 Runtime Security & Threat Detection

- Runtime detection: integrate Falco or runtime security agent to detect abnormal process behavior in containers.
- Endpoint protection: for admin workstations and servers, ensure OS patching and endpoint monitoring (EDR) where possible.
- Anomaly detection: instrument authentication and payment flows for unusual patterns; alert on spikes.

---

## 13.9 Penetration Testing, Bug Bounty & Audit

- Pre-production penetration test: schedule an external pentest prior to production launch. Use a qualified vendor for API, mobile, and infrastructure testing.
- Bug bounty: after production stabilization, consider HackerOne/Bugcrowd for ongoing discovery.
- Regular audits: annual third-party security audit focusing on payments and data protection.

---

## 13.10 Incident Response & Forensics

Team & roles:
- Incident Commander (IC): leads response
- Engineering lead: technical mitigation
- Security lead: investigation & forensics
- Communications: external/internal comms

Playbooks (high-level):
- Authentication compromise
  - Revoke tokens, rotate keys, force password resets for impacted accounts, escalate to IC.
- Payment compromise
  - Halt payment processing, block provider endpoints, revoke provider keys, engage provider.
- Data breach
  - Isolate systems, preserve logs and snapshots for forensics, notify legal/compliance teams, prepare breach notification per law.

Forensics:
- Preserve evidence: DB snapshots, logs, network captures, container images
- Use immutable logging and retain audit trails; ensure logs are centrally stored and access controlled

Post-incident:
- Root cause analysis (RCA), lessons learned, patch backlog, and communication to stakeholders.

RTO/RPO expectations for security incidents:
- RTO (recover to safe state): 1–4 hours for critical incidents operationally (depending on severity).
- RPO (data loss tolerance): Payments and audit logs RPO = zero tolerance; ensure transactional durability and backups.

---

## 13.11 Testing & Verification

Pre-launch checklist:
- Automated tests covering auth, rate limits, RBAC, IDOR cases
- Static scanning in CI (semgrep, eslint-security rules)
- Dependency vulnerability scanning (block on critical/high)
- Container image scanning
- End-to-end tests for webhook signature validation

Ongoing verification:
- Weekly dependency scan reports
- Daily health checks for secrets and certificate expirations
- Quarterly restore drills and backup verification

---

## 13.12 Compliance & Privacy

- Data Protection: implement data minimization, encryption-at-rest and in-flight, and access controls.
- Local legal: verify Rwandan laws for data retention and payment provider requirements, consult legal as needed.
- PII deletion: implement user data deletion flows with downstream propagation to analytics and backups per retention windows.
- Financial compliance: maintain audit trail for payments and support provider-specific compliance (e.g., MoMo contractual obligations).

---

## 13.13 Operational Checklists and Playbooks (concrete)

Deployment hardening checklist (pre-prod -> prod):
- [ ] Secrets in secrets manager; no plaintext keys in repo
- [ ] TLS certificates valid and auto-renewing
- [ ] Nginx secure headers configured (HSTS, CSP, X-Frame-Options)
- [ ] WAF enabled
- [ ] Rate limits and IP blocklists configured
- [ ] Logging to central system and Sentry errors enabled

Pre-release testing:
- [ ] External pentest scheduled
- [ ] Backup and restore tested
- [ ] Reconciliation and payment flows smoke-tested

Incident response quick actions:
- Account compromise -> revoke refresh tokens for user, require password reset, escalate to IC
- Payment webhook anomalies -> disable webhook processing, alert ops and payment provider

---

## 13.14 Security Roadmap & Milestones

Phase 13 deliverables (MVP security):
- Implement token rotation and refresh token revocation
- Redis-backed rate limiter on auth and OTP endpoints
- Secrets manager integration and CI secret scanning
- Outbox persistence and signed webhooks verification for payments
- Admin MFA enforced and audit logging turned on

Phase 13+ (next 6 months):
- External pentest and remediation
- Kubernetes hardening & migration
- EDR and runtime protection on production hosts
- Bug bounty launch after maturing

---

## 13.15 Readiness Checklist (Phase 13 complete)

- [ ] Threat model documented and reviewed
- [ ] OWASP Top 10 mitigations implemented in code and CI
- [ ] Secure authentication and refresh rotation implemented
- [ ] RBAC and object-level authorization enforced across services
- [ ] Secrets manager integrated for production
- [ ] Rate limiting implemented for high-risk endpoints
- [ ] Webhooks validated and idempotent
- [ ] Dependency scanning and container image scanning in CI
- [ ] Backups configured and restore tested
- [ ] Monitoring and alerting for security events configured
- [ ] Penetration test scheduled (pre-production) and remediation plan exists

---

## 13.16 Next steps

1. Implement immediate actions from deliverables list and checkboxes.
2. Schedule pentest and assign remediation owners.
3. Integrate secrets manager and rotate all provider credentials.
4. Enforce MFA for SUPER_ADMIN and admin role onboarding process.
5. Run a restore drill for database backups and validate RPO/RTO.

Phase 13 completed: this document provides a complete security hardening roadmap and prescriptive controls to prepare SafeRide Kigali for safe production deployment.

