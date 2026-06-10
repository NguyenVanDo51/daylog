import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface GoogleTokenPayload {
  /** Google user ID */
  sub: string;
  /** Google user name */
  name: string | null;
  /** Google user picture */
  picture: string | null;
  /** Google user email */
  email: string | null;
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
    email: payload.email ?? null,
  };
}
