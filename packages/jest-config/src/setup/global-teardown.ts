/**
 * Global teardown for integration tests
 * Runs once after all integration tests complete
 */

export default async () => {
  console.log('[TEARDOWN] Cleaning up integration test environment...');
  console.log('[TEARDOWN] Test database will be cleaned by dropping/recreating between test runs');
  console.log('[TEARDOWN] Integration test cleanup complete');
};
