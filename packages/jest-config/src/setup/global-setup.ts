/**
 * Global setup for integration tests
 * Runs once before all integration tests
 */

export default async () => {
  console.log('[SETUP] Setting up integration test environment...');

  // Set test environment
  process.env.NODE_ENV = 'test';

  // Verify TEST_DATABASE_URL is set
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL environment variable is required for integration tests.\n' +
      'Please set it in your .env.local file.\n' +
      'Example: TEST_DATABASE_URL=postgresql://username:password@localhost:5432/fuse_db_test'
    );
  }

  console.log('[SETUP] Using test database:', process.env.TEST_DATABASE_URL.replace(/:[^:@]+@/, ':***@'));
  console.log('[SETUP] Database schema will be created using Sequelize.sync() in test suites');
  console.log('[SETUP] Integration test environment ready');
};
