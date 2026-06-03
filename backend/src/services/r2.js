const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET;

async function getPresignedPutUrl() {
  const key = `photos/${crypto.randomUUID()}.webp`;
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: 'image/webp' });
  const url = await getSignedUrl(r2, command, { expiresIn: 3600 });
  return { url, key };
}

async function getObjectBuffer(key) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await r2.send(command);
  const chunks = [];
  for await (const chunk of response.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function putObject(key, buffer, contentType = 'image/webp') {
  await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
}

module.exports = { getPresignedPutUrl, getObjectBuffer, putObject };
