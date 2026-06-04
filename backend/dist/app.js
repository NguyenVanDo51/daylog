"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("./routes/auth"));
const albums_1 = __importDefault(require("./routes/albums"));
const photos_1 = __importDefault(require("./routes/photos"));
const milestones_1 = __importDefault(require("./routes/milestones"));
const invites_1 = __importDefault(require("./routes/invites"));
const timeline_1 = __importDefault(require("./routes/timeline"));
const members_1 = __importDefault(require("./routes/members"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', auth_1.default);
app.use('/albums', albums_1.default);
app.use('/photos', photos_1.default);
app.use('/', milestones_1.default);
app.use('/', invites_1.default);
app.use('/albums/:id/timeline', timeline_1.default);
app.use('/albums/:id/members', members_1.default);
app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
});
module.exports = app;
//# sourceMappingURL=app.js.map