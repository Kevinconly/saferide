Testing scaffold added:
- Web app checks: lint, typecheck, and build via npm workspaces
- Playwright example in tests/e2e
- k6 script in scripts/k6/ride_request_test.js
- Socket.IO harness in scripts/socket-harness.js
- GitHub Actions workflow .github/workflows/tests.yml (web-only CI)

Backend Jest unit/integration tests live in the separate saferide-backend repo
and run from there (npm run test:unit / npm run test:integration).

Run examples (this repo):
- npm run lint:web
- npm run typecheck
- npm run build:web
- npx playwright test
- k6 run scripts/k6/ride_request_test.js
- node scripts/socket-harness.js --clients=100 --rate=1
