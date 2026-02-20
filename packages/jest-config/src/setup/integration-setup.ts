/**
 * Integration test setup file
 * Runs before each integration test suite
 * Sets up database connection and test environment
 */

// Set test environment variables
process.env.NODE_ENV = 'test';

// Set longer timeout for integration tests
jest.setTimeout(30000);

// Keep errors visible
global.console = {
  ...console,
  error: console.error,
};

// Export database utilities for use in tests
export { cleanTestDatabase, initTestDatabase, seedTestDatabase, closeTestDatabase } from './database';
