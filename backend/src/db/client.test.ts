describe('db/index.ts Pool config', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('enables ssl when DATABASE_URL contains sslmode=require (production)', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://u:p@host/db?sslmode=require';
    delete process.env.DATABASE_URL_TEST;
    let captured: any;
    jest.isolateModules(() => {
      jest.doMock('pg', () => ({
        Pool: jest.fn(function (this: any, opts: any) {
          captured = opts;
          this.connect = jest.fn().mockResolvedValue({});
          this.end = jest.fn();
          this.query = jest.fn();
          this.on = jest.fn();
        }),
      }));
      require('./index');
    });
    expect(captured.ssl).toEqual({ rejectUnauthorized: true });
    expect(captured.connectionString).toBe('postgres://u:p@host/db?sslmode=require');
  });

  it('disables ssl when connection string lacks sslmode=require', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://localhost/db';
    delete process.env.DATABASE_URL_TEST;
    let captured: any;
    jest.isolateModules(() => {
      jest.doMock('pg', () => ({
        Pool: jest.fn(function (this: any, opts: any) {
          captured = opts;
          this.connect = jest.fn().mockResolvedValue({});
          this.end = jest.fn();
          this.query = jest.fn();
          this.on = jest.fn();
        }),
      }));
      require('./index');
    });
    expect(captured.ssl).toBe(false);
    expect(captured.connectionString).toBe('postgres://localhost/db');
  });

  it('uses DATABASE_URL_TEST in test env', () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL_TEST = 'postgres://localhost/test_db';
    let captured: any;
    jest.isolateModules(() => {
      jest.doMock('pg', () => ({
        Pool: jest.fn(function (this: any, opts: any) {
          captured = opts;
          this.connect = jest.fn().mockResolvedValue({});
          this.end = jest.fn();
          this.query = jest.fn();
          this.on = jest.fn();
        }),
      }));
      require('./index');
    });
    expect(captured.connectionString).toBe('postgres://localhost/test_db');
    expect(captured.ssl).toBe(false);
  });
});
