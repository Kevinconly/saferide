# Phase 17: Production Readiness - SafeRide Kigali

This document collects the final readiness criteria, operational checklists, and gating required to declare SafeRide Kigali production-ready. It assumes Phases 1–16 are complete and validated.

Key outcomes:
- Safety: security controls, backups, monitoring, and incident response validated
- Reliability: autoscaling, failover, and DR tested
- Performance: SLOs met and capacity validated
- Compliance: payment & data practices audited
- Operational: runbooks, monitoring, runbooks, and on-call in place

---

## 17.1 Must-have production gates (required before go-live)

1. Security
- External penetration test completed and critical/major findings remediated.
- Secrets stored in a secrets manager; no secrets in repo.
- MFA enforced for all admin accounts and credential rotation scheduled.

2. Compliance & Legal
- Payment provider contracts in place (MTN MoMo & Airtel) and sandbox integration validated.
- Data retention and privacy policy documented and approved by legal.

3. Reliability & Resilience
- Backups: nightly DB backups verified; restore drill completed within RTO/RPO targets.
- Monitoring: Prometheus/Grafana dashboards and Alertmanager configured; critical alerts tested with pager on-call.
- SRE runbooks for top 10 incidents available and tested.

4. Performance & Capacity
- Performance benchmarks executed for expected peak traffic and acceptable margins confirmed.
- Autoscaling rules tested in staging and threshold tuning validated.

5. Observability
- Tracing (OpenTelemetry) and Sentry configured; logs routed to Loki with retention policies.
- Audit logs for admin actions and payments enabled and immutable.

6. Payments & Financial Controls
- Webhook signature verification tested; idempotency validated; reconciliation scripts in place.
- Payout process for drivers documented; pilot payout executed in staging.

7. Testing & QA
- Unit, integration, and E2E tests passing in CI; E2E smoke tests executed on staging before release.
- Security scans (SAST, DAST) completed with acceptable results.

8. Operations & Staffing
- On-call rotation assigned and contacts available.
- Support escalation paths and SLAs defined.
- Runbooks for incident response and communication templates ready.

9. Deployment & Rollback
- CI/CD pipeline tested: build -> push -> deploy -> smoke tests -> canary/rollout
- Rollback procedures validated and practiced.

---

## 17.2 Pre-launch checklist (detailed)

Infrastructure
- [ ] Managed Postgres provisioned with backups & read replicas
- [ ] Redis cluster provisioned with persistence plan and failover
- [ ] Object storage (S3) provisioned for uploads and archive
- [ ] FCM and payment provider production credentials provisioned in secrets manager

Security
- [ ] Pentest completed and critical issues fixed
- [ ] Dependency vulnerability report cleaned (no critical unpatched)
- [ ] RBAC policies enforced and admin accounts reviewed

Testing
- [ ] End-to-end tests covering ride lifecycle passing in staging
- [ ] Payment integration tests passing with provider sandbox
- [ ] Load tests passed for expected peak with margins

Monitoring
- [ ] Dashboards configured and alerts tuned
- [ ] Health checks and readiness probes defined and validated

Operational readiness
- [ ] On-call rota setup and runbook distribution
- [ ] Support runbooks and FAQ for CS teams
- [ ] Legal & compliance sign-off

---

## 17.3 Go-live playbook

0. Preparation
- Freeze changes to release branch and ensure CI green
- Notify stakeholders and support teams of go-live window

1. Deploy to production using canary (5% traffic)
- Monitor metrics for 10–15 minutes
- If no regressions, increase to 25% and repeat
- Promote to 100% once stable

2. Post-release verification
- Run automated smoke tests for critical flows (login, request ride, assign, complete, payment)
- Verify logs for errors and reconcile payments from staging to production

3. Monitoring and early support
- Keep extended on-call coverage for first 72 hours
- Use runbooks to triage issues

4. Rollback if needed
- If critical failures observed, rollback to last stable image and open RCA

---

## 17.4 Post-launch activities

- Triage and resolve production bugs with priority
- Run full reconciliation job and financial review
- Schedule post-launch retrospective and plan improvements
- Consider phased expansion of service areas beyond Kigali once platform stable

---

## 17.5 Production metrics to watch (first 30 days)

- Daily active rides and completed rides
- Offer acceptance rate and offer timeout rate
- Payments success rate and reconciliation variance
- API and socket P95 latency and error rates
- Sentry error volume and severity
- Outbox backlog and delivery failures

---

## 17.6 Rollout & expansion plan

Phase 1 launch: Kigali (Gasabo, Kicukiro, Nyarugenge) with core features
Phase 2 expansion: Add additional Rwandan districts, scale via operational onboarding
Phase 3: Nationwide expansion and begin bank/card payments rollout

---

## 17.7 Final sign-off

Collect approvals from:
- CTO/Lead Architect
- Security Owner
- Product Manager
- Operations Lead
- Legal/Compliance

Once approvals are recorded, schedule go-live and execute the Go-live playbook.

