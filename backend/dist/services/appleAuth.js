"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAppleToken = verifyAppleToken;
const apple_signin_auth_1 = __importDefault(require("apple-signin-auth"));
async function verifyAppleToken(idToken) {
    const payload = (await apple_signin_auth_1.default.verifyIdToken(idToken, {
        audience: process.env.APPLE_CLIENT_ID || '',
        ignoreExpiration: false,
    }));
    return {
        sub: payload.sub,
        name: payload.name ?? null,
        email: payload.email ?? null,
    };
}
//# sourceMappingURL=appleAuth.js.map