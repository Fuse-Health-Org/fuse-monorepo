import type { Config } from 'jest';

const config: Config = {
  displayName: 'integration',
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test file patterns
  testMatch: ['**/*.integration.test.ts'],

  // Module resolution
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        types: ['jest', 'node'],
      },
    }],
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/node_modules/@fuse/jest-config/dist/setup/integration-setup.js'],
  globalSetup: '<rootDir>/node_modules/@fuse/jest-config/dist/setup/global-setup.js',
  globalTeardown: '<rootDir>/node_modules/@fuse/jest-config/dist/setup/global-teardown.js',

  // Don't clear mocks for integration tests (we want to use real implementations)
  clearMocks: false,
  resetMocks: false,
  restoreMocks: false,

  // Longer timeout for integration tests
  testTimeout: 30000,

  // Run tests serially (to avoid database conflicts)
  maxWorkers: 1,
};

export default config;
