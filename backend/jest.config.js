module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout: 15000,
  transformIgnorePatterns: [
    '/node_modules/(?!(uuid)/)',
  ],
};
