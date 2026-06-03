import * as apn from '@parse/node-apn';

let provider: apn.Provider | undefined;

function getProvider(): apn.Provider {
  if (!provider) {
    provider = new apn.Provider({
      token: {
        key: (process.env.APNS_KEY || '').replace(/\\n/g, '\n'),
        keyId: process.env.APNS_KEY_ID || '',
        teamId: process.env.APNS_TEAM_ID || '',
      },
      production: process.env.NODE_ENV === 'production',
    });
  }
  return provider;
}

export async function sendPush(
  apnsTokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  if (!apnsTokens.length) return;
  const note = new apn.Notification();
  note.alert = { title, body };
  note.payload = data;
  note.topic = process.env.APNS_BUNDLE_ID || '';
  note.expiry = Math.floor(Date.now() / 1000) + 3600;
  await getProvider().send(note, apnsTokens);
}
