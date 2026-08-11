# SafeRide Kigali

This repository is a monorepo for the SafeRide Kigali platform.

## Web-first primary experience

The primary production and development experience is the web application in `apps/saferide-web`.

- `npm run dev` starts the web app for local development.
- `npm run build` builds the web app for production.
- `npm run start` starts the built web app.

The web app is also configured as a Progressive Web App (PWA), with a manifest and service worker already included. It includes a placeholder map integration component that loads Google Maps when a valid `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is configured.

## Mobile placeholders

The mobile apps at `apps/saferide-mobile` and `apps/saferide-driver-mobile` are intentionally placeholders at this stage. They display "coming soon" messaging while the web app remains the primary interface.

## Useful scripts

- `npm run dev` — start the web app
- `npm run dev:web` — start only the web app
- `npm run dev:backend` — start the backend service
- `npm run dev:mobile` — start the passenger mobile placeholder app
- `npm run dev:driver-mobile` — start the driver mobile placeholder app
- `npm run build` — build the web app
- `npm run start` — start the web app in production mode

## Map integration

The web app includes a reusable `MapPreview` component that renders a Google Maps view when the environment variable `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set.

## Environment configuration

Copy `.env.example` to `.env` or `.env.local` and configure the following variables at minimum:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
