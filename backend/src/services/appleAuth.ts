import appleSignin, { AppleIdTokenType } from 'apple-signin-auth';

export interface AppleTokenPayload {
  sub: string;
  name: string | null;
  email: string | null;
}

// Apple's id_token does not include `name` in its standard claim set
// (the typed `AppleIdTokenType` reflects that). Apple only returns the
// user's name on first sign-in via a separate `user` field on the OAuth
// response, not inside the JWT. We still read `name` defensively in case
// a custom claim is present, hence the loose access.
type ApplePayloadWithName = AppleIdTokenType & { name?: string | null };

export async function verifyAppleToken(idToken: string): Promise<AppleTokenPayload> {
  const payload = (await appleSignin.verifyIdToken(idToken, {
    audience: process.env.APPLE_CLIENT_ID || '',
    ignoreExpiration: false,
  })) as ApplePayloadWithName;
  return {
    sub: payload.sub,
    name: payload.name ?? null,
    email: payload.email ?? null,
  };
}
