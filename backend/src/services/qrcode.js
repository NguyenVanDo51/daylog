const QRCode = require('qrcode');

async function generateQRCode(text) {
  return QRCode.toDataURL(text, { type: 'image/png', width: 300 });
}

module.exports = { generateQRCode };
