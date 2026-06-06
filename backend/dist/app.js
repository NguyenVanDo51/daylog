"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const rateLimit_1 = require("./lib/rateLimit");
const auth_1 = __importDefault(require("./routes/auth"));
const albums_1 = __importDefault(require("./routes/albums"));
const photos_1 = __importDefault(require("./routes/photos"));
const invites_1 = __importDefault(require("./routes/invites"));
const timeline_1 = __importDefault(require("./routes/timeline"));
const calendar_1 = __importDefault(require("./routes/calendar"));
const members_1 = __importDefault(require("./routes/members"));
const reactions_1 = __importDefault(require("./routes/reactions"));
const day_labels_1 = __importDefault(require("./routes/day-labels"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(express_1.default.json({ limit: '100kb' }));
app.use(rateLimit_1.globalLimiter);
app.use('/auth', rateLimit_1.authLimiter);
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', auth_1.default);
app.use('/albums', albums_1.default);
app.use('/photos', photos_1.default);
app.use('/', invites_1.default);
app.use('/albums/:id/timeline', timeline_1.default);
app.use('/albums/:id/calendar', calendar_1.default);
app.use('/albums/:id/members', members_1.default);
app.use('/photos/:photoId/reactions', reactions_1.default);
app.use('/albums/:id/day-labels', day_labels_1.default);
app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    const message = status < 500 ? (err.message || 'Error') : 'Internal server error';
    if (status >= 500)
        console.error(err);
    res.status(status).json({ error: message });
});
module.exports = app;
//# sourceMappingURL=app.js.map