const appleSignin = require('apple-signin-auth');

async function verifyAppleToken(idToken) {
  const payload = await appleSignin.verifyIdToken(idToken, {
    audience: process.env.APPLE_CLIENT_ID,
    ignoreExpiration: false,
  });
  return {
    sub: payload.sub,
    name: payload.name || null,
    email: payload.email || null,
  };
}

module.exports = { verifyAppleToken };
