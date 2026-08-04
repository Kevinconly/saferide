# Phase 16: Deployment - SafeRide Kigali

This document defines the deployment, release, and runtime operations architecture for SafeRide Kigali. It covers environment topology, CI/CD pipelines, containerization, orchestration (Docker Compose for local/dev and Kubernetes for production), reverse proxy/Nginx configuration, secrets management, observability, rollback strategies, disaster recovery, and runbooks.

Scope:
- Development & local workflows
- Staging & testing environments
- Production deployment topology (Kubernetes recommended)
- CI/CD (GitHub Actions) and release strategies
- Secrets, configuration, and environment management
- Monitoring, logging, and alerting in production
- Backup, disaster recovery, and failover guidance

---

## 16.1 Deployment Goals

- Repeatable, secure, and auditable deployments across environments
- Minimal downtime releases with safe rollback and canary options
- Clear separation between environments (dev, staging, prod)
- Infrastructure-as-code for reproducibility and reviewability
- Secure secrets handling and least-privilege access for services
- Automated health checks and observability for rapid detection and remediation

---

## 16.2 Environment Topology

Environments:
- Local developer: Docker Compose for rapid iteration
- CI: Ephemeral runners for building, testing, and linting
- Staging: Production-like environment (Kubernetes) with test data and provider sandbox keys
- Production: Kubernetes cluster across multiple availability zones (or equivalent on chosen cloud)

Network considerations:
- Use private networking for database and cache (no public IP)
- Place ingress/Nginx in public subnets behind WAF
- Use VPC peering or private connectivity for admin/ops access

---

## 16.3 Containerization and Images

- Build reproducible OCI images using multi-stage Dockerfiles
- Use minimal base images (node:18-alpine or distroless) and avoid unnecessary packages
- Tagging scheme:
  - image: saferide/api:${{ github.sha }} for CI-built artifacts
  - image: saferide/api:staging and nicer semantic tags for releases (v1.2.3)
- Image provenance: generate SBOM and sign images (cosign) before pushing to registry
- Registry: use a private container registry (ECR, GCR, ACR, or Docker Hub private)

Dockerfile recommendations:
- Use multi-stage builds to compile TypeScript and copy only build artifacts into smaller runtime image
- Do not include devDependencies in production images
- Set non-root user in the final stage

---

## 16.4 Local Development (Docker Compose)

- Provide docker-compose.dev.yml to run Postgres, Redis, and backend locally
- Use volume mounts for source code to enable live-reload
- Provide a `make dev` / `npm run dev` helper that brings up compose and runs the app
- Use environment files `.env.local` and `.env.test` for local overrides (do NOT store secrets in repo)

Example compose services:
- api (saferide-backend)
- postgres
- redis
- admin frontend (optional)

---

## 16.5 Kubernetes Deployment (Staging & Production)

Recommended primitives:
- Namespaces per environment: saferide-staging, saferide-prod
- Deployments and StatefulSets for stateful components if needed (Postgres managed DB preferred)
- Services: ClusterIP for internal services, LoadBalancer for ingress where managed LB used
- Ingress: Nginx Ingress Controller or cloud-managed ingress with TLS termination
- ConfigMaps for non-sensitive config; Secrets for sensitive values via KMS or secret store provider
- Horizontal Pod Autoscaler for API and workers using CPU and custom metrics (queue length, socket_count)
- PodDisruptionBudgets and readiness/liveness probes

Storage & DB:
- Prefer managed Postgres (RDS/Cloud SQL) with read replicas for reporting
- Use PersistentVolumeClaims for other storage needs and S3-compatible storage for large objects

---

## 16.6 Nginx / Ingress Configuration

- TLS termination at ingress (Let’s Encrypt / managed certs)
- HTTP -> HTTPS redirect and HSTS header
- Rate limiting and basic layer 7 filtering
- Use separate subdomains for admin dashboard (admin.saferide.rw) and API (api.saferide.rw)
- Configure client_max_body_size for file uploads and timeouts for long-polling or socket upgrades

Socket.IO considerations:
- Ensure ingress supports WebSocket upgrades or use sticky sessions if no Redis adapter
- Prefer Redis adapter + non-sticky sessions in Kubernetes

---

## 16.7 CI/CD Pipeline (GitHub Actions recommended)

Pipeline stages:
- Build: install, lint, type-check, run unit tests, build artifacts
- Integration tests: run against ephemeral services or test environment
- Imaging: build and push container images with tags and SBOM
- Deploy to staging: apply manifests via IaC and run smoke tests
- Manual approval gate for production: require approvals, security checks, and release notes
- Deploy to production: canary or blue/green with automated health checks

Secrets in CI:
- Use GitHub Encrypted Secrets for registry credentials and provider keys
- Limit secret exposure with environment restrictions and review

Promotion strategy:
- Use immutable image tags for deployments; promote by tag from staging to prod rather than rebuilding

Sample actions:
- `ci/build` -> runs tests and produces image
- `ci/deploy-staging` -> deploys using kubectl/helm and runs post-deploy smoke tests
- `ci/canary` -> deploys limited subset to canary nodes and monitors metrics/alerts before full rollout

---

## 16.8 Release Strategies

Blue-Green:
- Maintain two production environments (green, blue). Deploy new version to idle environment, run smoke tests, switch traffic at DNS/LoadBalancer.
- Pros: near-zero downtime and easy rollback. Cons: more infra cost.

Canary:
- Gradual traffic shift to new version (e.g., 5% -> 25% -> 100%) with metric-based promotions.
- Requires traffic shaping or service mesh (Istio, Linkerd) or weighted LB support.

Rolling with Health Checks:
- Controlled rolling updates using readiness probes and maxUnavailable/maxSurge settings.

Recommendation (MVP):
- Start with rolling updates + readiness checks for small teams
- Move to canary releases for critical flows and Blue-Green when budgets allow

---

## 16.9 Secrets Management & Configuration

- Use cloud secret manager (AWS Secrets Manager, GCP Secret Manager, or HashiCorp Vault) for production secrets
- Store minimal secrets in CI as environment-scoped encrypted secrets
- Use GitOps or IaC (Terraform/Helm) to manage non-sensitive config
- Rotate secrets periodically and enforce expiration for high-risk keys

Local dev:
- Provide `.env.example` for required keys and document how to obtain dev keys for providers

---

## 16.10 Observability & Health Checks

Health checks:
- Liveness and readiness endpoints for all services (`/healthz/live`, `/healthz/ready`)
- Readiness should validate DB connectivity, Redis connectivity, and critical downstream services where blocking

Monitoring and logging:
- Push metrics to Prometheus and dashboards in Grafana
- Logs aggregated to Loki with structured JSON and correlation IDs
- Error tracking with Sentry for production

Alerting:
- Hook Alertmanager into PagerDuty/Slack for critical alerts
- Define actionable alerts and runbooks

---

## 16.11 Rollback & Recovery

Immediate rollback:
- If deployment fails health checks, abort rollout and automatically roll back (kubernetes deployment strategy supports this)
- Keep prior image tags available for a fast rollback

Disaster recovery:
- Nightly DB backups to encrypted S3 with lifecycle rules to move older backups to cold storage
- Document RTO/RPO per environment (db RTO target: < 1 hour; RPO target: last committed transactions; payments/audit logs minimal RPO)
- Regular restore drills: quarterly restore verification and DR rehearsals

---

## 16.12 Data migrations

- Use versioned migrations (Prisma Migrate) and include a migration job in CI pipeline
- No automatic destructive migrations in production without manual approval and backup
- Run migrations in maintenance window or via rolling migration patterns with backward-compatible schema changes (expand-then-contract)

---

## 16.13 Access, IAM, and Operational Security

- Enforce least privilege for cloud IAM roles and limit admin privileges
- Use Single Sign-On (SSO) and MFA for production access
- Audit logs for cloud console/API access and admin dashboard actions

---

## 16.14 Canary & Metrics-Based Promotion

- Define promotion criteria (error rate, latency, business KPIs) for canary promotion
- Automate checks: smoke tests, synthetic transactions, and metric checks (no increase in error rate, acceptable latency)
- If checks fail, rollback and notify on-call

---

## 16.15 Cost Management

- Use tags and cost allocation for environments
- Right-size instances and use reserved/spot instances for non-critical workloads
- Monitor usage and adjust autoscaling thresholds based on real data

---

## 16.16 Compliance & Audit

- Keep audit logs for admin actions, payment changes, and critical config changes
- Retain logs and receipts according to regulatory obligations
- Ensure all infra changes are PR-reviewed and tracked in IaC repository

---

## 16.17 Operational Runbooks (examples)

1. Deployment rollback
- Detect failing deployment via alerts
- Trigger rollback job (kubectl rollout undo or re-route traffic)
- Notify stakeholders and run RCA

2. DB restore
- Restore backup to isolated environment
- Verify integrity and run reconciliation tests
- Apply fix/patch and migrate data if required

3. Incident: Redis outage
- Promote read-only mode for non-critical features
- Redirect dispatch and matching to fallback logic (if implemented)
- Restore Redis from replica or failover to standby

---

## 16.18 IaC and GitOps

- Use Terraform for cloud resources and Helm charts for Kubernetes deployment manifests
- Use GitOps-style deployments (ArgoCD/Flux) for controlled, auditable rollouts
- Store environment-specific values in secure stores and reference via external-secrets operator in Kubernetes

---

## 16.19 Readiness Checklist (Phase 16 complete)

- [x] Docker images and tag strategy defined
- [x] Docker Compose local dev pattern defined
- [x] Kubernetes deployment patterns and best practices documented
- [x] CI/CD pipeline stages and promotion strategy defined
- [x] Secrets management approach defined
- [x] Health checks, monitoring, and alerting defined
- [x] Rollback & DR strategies documented
- [x] Migration and IaC patterns documented

Phase 16 is complete. The project now has a comprehensive deployment and operations specification to support secure, repeatable, and observable releases to staging and production.

