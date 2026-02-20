const baseConfig = require('@fuse/jest-config/dist/configs/jest.unit.config').default;

module.exports = {
  ...baseConfig,
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.unit.test.ts'],
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
