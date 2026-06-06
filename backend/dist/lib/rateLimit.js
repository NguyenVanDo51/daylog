"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalLimiter = exports.inviteLookupLimiter = exports.presignLimiter = exports.authLimiter = void 0;
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const isTest = process.env.NODE_ENV === 'test';
// 10 req/min per IP — for auth endpoints
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
});
// 30 req/min per authenticated user — for presign endpoint
// Applied after requireAuth so req.user is available
exports.presignLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60_000,
    max: 30,
    keyGenerator: (req) => req.user?.id ?? (req.ip ? (0, express_rate_limit_1.ipKeyGenerator)(req.ip) : 'anonymous'),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
    validate: { trustProxy: false },
});
// 5 req/min per IP — for unauthenticated invite lookup
exports.inviteLookupLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60_000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
});
// 100 req/min per IP — global fallback
exports.globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
});
//# sourceMappingURL=rateLimit.js.map