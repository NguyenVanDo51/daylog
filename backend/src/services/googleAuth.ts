import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface GoogleTokenPayload {
  sub: string;
  name: string | null;
  picture: string | null;
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleTokenPayload> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    throw new Error('Google token has no payload');
  }
  return {
    sub: payload.sub,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}
