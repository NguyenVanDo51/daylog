"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQRCode = generateQRCode;
const qrcode_1 = __importDefault(require("qrcode"));
async function generateQRCode(text) {
    return qrcode_1.default.toDataURL(text, { type: 'image/png', width: 300 });
}
//# sourceMappingURL=qrcode.js.map