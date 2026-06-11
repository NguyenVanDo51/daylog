"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPresignedPutUrl = getPresignedPutUrl;
exports.getObjectBuffer = getObjectBuffer;
exports.putObject = putObject;
exports.deleteObject = deleteObject;
const crypto_1 = require("crypto");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const r2 = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
    // AWS SDK v3 ≥ 3.600 auto-injects CRC32 checksums; R2 rejects presigned PUTs that
    // include a checksum query param the client doesn't echo back.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
});
const BUCKET = process.env.R2_BUCKET || '';
async function getPresignedPutUrl(contentType = 'image/webp') {
    const ext = contentType === 'video/mp4' ? 'mp4'
        : contentType === 'image/jpeg' ? 'jpg'
            : 'webp';
    const key = `photos/${(0, crypto_1.randomUUID)()}.${ext}`;
    const command = new client_s3_1.PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
    const url = await (0, s3_request_presigner_1.getSignedUrl)(r2, command, { expiresIn: 3600 });
    return { url, key };
}
async function getObjectBuffer(key) {
    const command = new client_s3_1.GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await r2.send(command);
    const chunks = [];
    // aws-sdk types Body as a sprawling union (Readable | ReadableStream | Blob);
    // at runtime on Node it is an async-iterable Readable stream.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const chunk of response.Body) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}
async function putObject(key, buffer, contentType = 'image/webp') {
    await r2.send(new client_s3_1.PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
}
async function deleteObject(key) {
    await r2.send(new client_s3_1.DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
//# sourceMappingURL=r2.js.map