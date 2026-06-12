import * as Sentry from '@sentry/node';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { authLimiter, globalLimiter } from './lib/rateLimit';
import authRoutes from './routes/auth';
import albumsRoutes from './routes/albums';
import photosRoutes from './routes/photos';
import invitesRoutes from './routes/invites';
import timelineRoutes from './routes/timeline';
import calendarRoutes from './routes/calendar';
import membersRoutes from './routes/members';
import reactionsRoutes from './routes/reactions';
import dayLabelsRoutes from './routes/day-labels';
import albumDaysRoutes from './routes/album-days';
import storiesRoutes from './routes/stories';
import versionRoutes from './routes/version';
import waitlistRoutes from './routes/waitlist';
import usersRoutes from './routes/users';
import soundtracksRoutes from './routes/soundtracks';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(express.json({ limit: '100kb' }));
app.use(globalLimiter);
app.use('/auth', authLimiter);

app.get('/health', (_req, res) => res.json({ ok: true }));

if (process.env.NODE_ENV !== 'production') {
  app.get('/debug-sentry', (_req, _res) => {
    throw new Error('Sentry debug — intentional test error');
  });
}

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/albums', albumsRoutes);
app.use('/photos', photosRoutes);
app.use('/', invitesRoutes);
app.use('/albums/:id/timeline', timelineRoutes);
app.use('/albums/:id/calendar', calendarRoutes);
app.use('/albums/:id/members', membersRoutes);
app.use('/photos/:photoId/reactions', reactionsRoutes);
app.use('/albums/:id/day-labels', dayLabelsRoutes);
app.use('/albums/:id/days', albumDaysRoutes);
app.use('/stories', storiesRoutes);
app.use('/version', versionRoutes);
app.use('/waitlist', waitlistRoutes);
app.use('/soundtracks', soundtracksRoutes);

Sentry.setupExpressErrorHandler(app);

interface HttpError extends Error {
  status?: number;
}

app.use((err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || 500;
  const message = status < 500 ? (err.message || 'Error') : 'Internal server error';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

export = app;
