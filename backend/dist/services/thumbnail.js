"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateThumbnail = generateThumbnail;
const sharp_1 = __importDefault(require("sharp"));
const crypto_1 = require("crypto");
const r2_1 = require("./r2");
async function generateThumbnail(r2Key) {
    const buffer = await (0, r2_1.getObjectBuffer)(r2Key);
    const image = (0, sharp_1.default)(buffer);
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const thumb = await image
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    const key = `thumbnails/${(0, crypto_1.randomUUID)()}.webp`;
    await (0, r2_1.putObject)(key, thumb);
    return { key, width, height };
}
//# sourceMappingURL=thumbnail.js.map