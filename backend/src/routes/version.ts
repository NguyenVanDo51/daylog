import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    minVersion: process.env.MIN_APP_VERSION ?? '1.0.0',
    latestVersion: process.env.LATEST_APP_VERSION ?? '1.0.0',
  });
});

export default router;
