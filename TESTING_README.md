Testing scaffold added:
- Backend Jest unit/integration configs under apps/saferide-backend
- Playwright example in tests/e2e
- k6 script in scripts/k6/ride_request_test.js
- Socket.IO harness in scripts/socket-harness.js
- GitHub Actions workflow .github/workflows/tests.yml

Run examples:
- npm --workspace=saferide-backend run test:unit
- npm --workspace=saferide-backend run test:integration
- npx playwright test
- k6 run scripts/k6/ride_request_test.js
- node scripts/socket-harness.js --clients=100 --rate=1
