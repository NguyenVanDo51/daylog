const express = require('express');
const app = express();

app.use(express.json());

app.use('/auth', require('./routes/auth'));
app.use('/albums', require('./routes/albums'));
app.use('/photos', require('./routes/photos'));
app.use('/', require('./routes/milestones'));
app.use('/', require('./routes/invites'));
app.use('/albums/:id/timeline', require('./routes/timeline'));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
