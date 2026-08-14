#!/usr/bin/env bash
set -e
npm install --no-audit --no-fund
npm install -g k6 || true
