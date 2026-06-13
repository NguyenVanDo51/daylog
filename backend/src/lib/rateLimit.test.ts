describe('rateLimit middleware', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  it('exports all four limiters as Express middleware functions', () => {
    jest.isolateModules(() => {
      const mod = require('./rateLimit');
      expect(typeof mod.authLimiter).toBe('function');
      expect(typeof mod.presignLimiter).toBe('function');
      expect(typeof mod.inviteLookupLimiter).toBe('function');
      expect(typeof mod.globalLimiter).toBe('function');
      // Express middleware expects (req, res, next) — arity 3.
      expect(mod.authLimiter.length).toBe(3);
      expect(mod.presignLimiter.length).toBe(3);
      expect(mod.inviteLookupLimiter.length).toBe(3);
      expect(mod.globalLimiter.length).toBe(3);
    });
  });

  it('constructs cleanly under both test and production NODE_ENV', () => {
    for (const env of ['test', 'production', 'development']) {
      process.env.NODE_ENV = env;
      jest.isolateModules(() => {
        const mod = require('./rateLimit');
        expect(typeof mod.authLimiter).toBe('function');
        expect(typeof mod.presignLimiter).toBe('function');
        expect(typeof mod.inviteLookupLimiter).toBe('function');
        expect(typeof mod.globalLimiter).toBe('function');
      });
    }
  });
});
