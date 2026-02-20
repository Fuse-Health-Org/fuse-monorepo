/**
 * Database utilities for integration tests
 * Provides helpers for database setup, cleanup, and seeding
 */

import { execSync } from 'child_process';
import path from 'path';

/**
 * Run migrations on test database
 * Uses sequelize-cli to run pending migrations
 */
export const runTestMigrations = async () => {
  try {
    console.log('[DB] Running migrations on test database...');

    // Set NODE_ENV to test to ensure correct database is used
    const env = { ...process.env, NODE_ENV: 'test' };

    // Run migrations using sequelize-cli
    // The working directory should be the patient-api directory
    const patientApiPath = path.resolve(__dirname, '../../../../patient-api');

    execSync('npx sequelize-cli db:migrate', {
      cwd: patientApiPath,
      env,
      stdio: 'inherit',
    });

    console.log('[DB] Migrations completed successfully');
  } catch (error) {
    console.error('[DB ERROR] Failed to run migrations:', error);
    throw error;
  }
};

/**
 * Undo all migrations on test database
 * Useful for cleaning up after tests
 */
export const undoAllTestMigrations = async () => {
  try {
    console.log('[DB] Undoing all migrations on test database...');

    const env = { ...process.env, NODE_ENV: 'test' };
    const patientApiPath = path.resolve(__dirname, '../../../../patient-api');

    execSync('npx sequelize-cli db:migrate:undo:all', {
      cwd: patientApiPath,
      env,
      stdio: 'inherit',
    });

    console.log('[DB] All migrations undone successfully');
  } catch (error) {
    console.error('[DB ERROR] Failed to undo migrations:', error);
    throw error;
  }
};

/**
 * Initialize test database connection
 * This should be called at the start of integration tests
 */
export const initTestDatabase = async (sequelize: any) => {
  try {
    await sequelize.authenticate();
    console.log('[DB] Test database connection established');

    // Sync database schema (creates tables if they don't exist)
    await sequelize.sync({ force: false });
    console.log('[DB] Test database schema synchronized');

    return sequelize;
  } catch (error) {
    console.error('[DB ERROR] Unable to connect to test database:', error);
    throw error;
  }
};

/**
 * Clean up test database
 * Truncates all tables to ensure clean state between tests
 */
export const cleanTestDatabase = async (sequelize: any) => {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();

    // PostgreSQL: Disable foreign key checks by wrapping in transaction
    await sequelize.query('SET session_replication_role = replica;');

    // Truncate all tables (except SequelizeMeta which tracks migrations)
    for (const table of tables) {
      if (table !== 'SequelizeMeta') {
        await sequelize.query(`TRUNCATE TABLE "${table}" CASCADE;`);
      }
    }

    // Re-enable foreign key checks
    await sequelize.query('SET session_replication_role = DEFAULT;');

    console.log('[DB] Test database cleaned');
  } catch (error) {
    console.error('[DB ERROR] Error cleaning test database:', error);
    throw error;
  }
};

/**
 * Close test database connection
 */
export const closeTestDatabase = async (sequelize: any) => {
  try {
    await sequelize.close();
    console.log('[DB] Test database connection closed');
  } catch (error) {
    console.error('[DB ERROR] Error closing test database:', error);
    throw error;
  }
};

/**
 * Seed test database with initial data
 */
export const seedTestDatabase = async (sequelize: any, seedData: any) => {
  try {
    const models = sequelize.models;

    for (const [modelName, data] of Object.entries(seedData)) {
      if (models[modelName]) {
        await models[modelName].bulkCreate(data as any[]);
      }
    }

    console.log('[DB] Test database seeded with initial data');
  } catch (error) {
    console.error('[DB ERROR] Error seeding test database:', error);
    throw error;
  }
};
