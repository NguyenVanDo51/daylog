module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.ts'],
  testTimeout: 15000,
  // Run tests serially — the test suite shares a real Postgres database and
  // the beforeEach TRUNCATE is not safe to run concurrently across workers.
  maxWorkers: 1,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  // expo-server-sdk is pure ESM; redirect to a CJS-compatible manual mock so
  // tests that don't explicitly mock the push service still compile in Jest's
  // CommonJS environment. Tests in push.test.ts override this with jest.mock().
  moduleNameMapper: {
    '^expo-server-sdk$': '<rootDir>/__mocks__/expo-server-sdk.js',
  },
  transformIgnorePatterns: ['/node_modules/(?!(uuid)/)'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/db/schema.ts',
    '!src/db/migrations/**',
    '!src/**/*.test.ts',
  ],
  coverageThreshold: {
    global: { statements: 90, branches: 90, functions: 90, lines: 90 },
  },
};
