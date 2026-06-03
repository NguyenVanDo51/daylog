import express, { Request, Response, NextFunction } from 'express';
import authRoutes from './routes/auth';
import albumsRoutes from './routes/albums';
import photosRoutes from './routes/photos';
import milestonesRoutes from './routes/milestones';
import invitesRoutes from './routes/invites';
import timelineRoutes from './routes/timeline';
import membersRoutes from './routes/members';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/albums', albumsRoutes);
app.use('/photos', photosRoutes);
app.use('/', milestonesRoutes);
app.use('/', invitesRoutes);
app.use('/albums/:id/timeline', timelineRoutes);
app.use('/albums/:id/members', membersRoutes);

interface HttpError extends Error {
  status?: number;
}

app.use((err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

export = app;
