/**
 * @fuse/jest-config
 * Shared Jest configuration and testing utilities for Fuse Health applications
 */

// Export configurations
export { default as unitConfig } from './configs/jest.unit.config';
export { default as integrationConfig } from './configs/jest.integration.config';

// Export mocks
export * from './mocks';

// Export fixtures
export * from './fixtures';

// Export utilities
export * from './utils';

// Export setup utilities
export * from './setup/database';
export * from './setup/test-users';
