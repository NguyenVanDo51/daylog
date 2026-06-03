const apn = require('@parse/node-apn');

let provider;

function getProvider() {
  if (!provider) {
    provider = new apn.Provider({
      token: {
        key: (process.env.APNS_KEY || '').replace(/\\n/g, '\n'),
        keyId: process.env.APNS_KEY_ID,
        teamId: process.env.APNS_TEAM_ID,
      },
      production: process.env.NODE_ENV === 'production',
    });
  }
  return provider;
}

async function sendPush(apnsTokens, title, body, data = {}) {
  if (!apnsTokens.length) return;
  const note = new apn.Notification();
  note.alert = { title, body };
  note.payload = data;
  note.topic = process.env.APNS_BUNDLE_ID;
  note.expiry = Math.floor(Date.now() / 1000) + 3600;
  await getProvider().send(note, apnsTokens);
}

module.exports = { sendPush };
