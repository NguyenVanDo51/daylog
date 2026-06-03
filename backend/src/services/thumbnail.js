const sharp = require('sharp');
const { randomUUID } = require('crypto');
const { getObjectBuffer, putObject } = require('./r2');

async function generateThumbnail(r2Key) {
  const buffer = await getObjectBuffer(r2Key);
  const thumb = await sharp(buffer)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const thumbKey = `thumbnails/${randomUUID()}.webp`;
  await putObject(thumbKey, thumb);
  return thumbKey;
}

module.exports = { generateThumbnail };
