#!/usr/bin/env bash
set -e
npm --workspace=saferide-backend install --no-audit --no-fund
npm install -g k6 || true
