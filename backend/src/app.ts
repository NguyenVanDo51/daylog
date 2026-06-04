import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { authLimiter, globalLimiter } from './lib/rateLimit';
import authRoutes from './routes/auth';
import albumsRoutes from './routes/albums';
import photosRoutes from './routes/photos';
import milestonesRoutes from './routes/milestones';
import invitesRoutes from './routes/invites';
import timelineRoutes from './routes/timeline';
import calendarRoutes from './routes/calendar';
import membersRoutes from './routes/members';
import reactionsRoutes from './routes/reactions';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? false,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
app.use(express.json({ limit: '100kb' }));
app.use(globalLimiter);
app.use('/auth', authLimiter);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/albums', albumsRoutes);
app.use('/photos', photosRoutes);
app.use('/', milestonesRoutes);
app.use('/', invitesRoutes);
app.use('/albums/:id/timeline', timelineRoutes);
app.use('/albums/:id/calendar', calendarRoutes);
app.use('/albums/:id/members', membersRoutes);
app.use('/photos/:photoId/reactions', reactionsRoutes);

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
