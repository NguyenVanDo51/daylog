#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Building..."
npm ci
npm run build

echo "Uploading source maps to Sentry..."
npx sentry-cli sourcemaps inject dist/
npx sentry-cli sourcemaps upload --release="$(git rev-parse HEAD)" dist/

echo "Restarting app..."
# Replace with your process manager command, e.g.:
# pm2 restart family-guy-api
# systemctl restart family-guy-api
echo "Done. Start your app with: node dist/index.js"
