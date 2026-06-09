import 'dotenv/config';
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.2,
  environment: process.env.NODE_ENV ?? 'development',
});

// require() in body — runs AFTER Sentry.init() so pg and Express are instrumented
// eslint-disable-next-line @typescript-eslint/no-require-imports
const app: import('express').Application = require('./app');

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => console.log(`API running on port ${port}`));
