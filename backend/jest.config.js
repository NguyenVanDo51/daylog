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
  transformIgnorePatterns: ['/node_modules/(?!(uuid|expo-server-sdk)/)'],
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
