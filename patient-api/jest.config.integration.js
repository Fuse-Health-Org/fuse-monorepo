const baseConfig = require('@fuse/jest-config/dist/configs/jest.integration.config').default;

module.exports = {
  ...baseConfig,
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.integration.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/bundle/',
    '/coverage/',
    '/__tests__/',
  ],
};
