/**
 * Integration tests for signin endpoint
 * These tests use a real test database and test the full authentication flow
 */

import { sequelize } from '../../../config/database';
import User from '../../../models/User';
import UserRoles from '../../../models/UserRoles';
import MfaToken from '../../../models/MfaToken';
import { seedTestUsers, TEST_USERS, TEST_USER_PASSWORD } from '@fuse/jest-config';

describe('Auth - Signin (Integration Tests)', () => {
  beforeAll(async () => {
    // Initialize database connection
    await sequelize.authenticate();
    console.log('[TEST] Database connection established');

    // Sync database schema (create tables from models)
    await sequelize.sync({ force: true });
    console.log('[TEST] Database schema synchronized');

    // Seed test users
    await seedTestUsers(User, UserRoles);
  });

  afterAll(async () => {
    // Clean up and close database connection
    await sequelize.close();
  });

  describe('Database Setup', () => {
    it('should have test database connected', async () => {
      const tables = await sequelize.getQueryInterface().showAllTables();
      expect(tables.length).toBeGreaterThan(0);
      expect(tables).toContain('users');
    });

    it('should have test users seeded', async () => {
      const patient = await User.findOne({
        where: { email: TEST_USERS.patient.email },
      });

      expect(patient).toBeDefined();
      expect(patient?.email).toBe(TEST_USERS.patient.email);
      expect(patient?.firstName).toBe(TEST_USERS.patient.firstName);
    });

    it('should have user roles created', async () => {
      const patient = await User.findOne({
        where: { email: TEST_USERS.patient.email },
        include: [{ model: UserRoles, as: 'userRoles' }],
      });

      expect(patient).toBeDefined();
      expect(patient?.userRoles).toBeDefined();
      expect(patient?.userRoles?.patient).toBe(true);
    });
  });

  describe('User Model', () => {
    it('should validate password correctly', async () => {
      const patient = await User.findOne({
        where: { email: TEST_USERS.patient.email },
      });

      expect(patient).toBeDefined();

      if (patient) {
        const isValid = await patient.validateAnyPassword(TEST_USER_PASSWORD);
        expect(isValid).toBe(true);

        const isInvalid = await patient.validateAnyPassword('WrongPassword!');
        expect(isInvalid).toBe(false);
      }
    });

    it('should find user by email', async () => {
      const user = await User.findByEmail(TEST_USERS.admin.email);

      expect(user).toBeDefined();
      expect(user?.email).toBe(TEST_USERS.admin.email);
      expect(user?.role).toBe('admin');
    });
  });

  describe('MFA Flow', () => {
    it('should create MFA token record', async () => {
      const patient = await User.findOne({
        where: { email: TEST_USERS.patient.email },
      });

      expect(patient).toBeDefined();

      if (patient) {
        // Create an MFA token
        const otpCode = MfaToken.generateCode();
        const mfaSessionToken = MfaToken.generateMfaToken();
        const expiresAt = MfaToken.getExpirationTime();

        const mfaRecord = await MfaToken.create({
          userId: patient.id,
          code: otpCode,
          mfaToken: mfaSessionToken,
          expiresAt,
          email: patient.email,
          verified: false,
          resendCount: 0,
          failedAttempts: 0,
        });

        expect(mfaRecord).toBeDefined();
        expect(mfaRecord.code).toBe(otpCode);
        expect(mfaRecord.mfaToken).toBe(mfaSessionToken);
        expect(mfaRecord.userId).toBe(patient.id);

        // Clean up
        await mfaRecord.destroy();
      }
    });

    it('should validate MFA code correctly', async () => {
      const patient = await User.findOne({
        where: { email: TEST_USERS.patient.email },
      });

      expect(patient).toBeDefined();

      if (patient) {
        const otpCode = '123456';
        const mfaSessionToken = MfaToken.generateMfaToken();
        const expiresAt = MfaToken.getExpirationTime();

        const mfaRecord = await MfaToken.create({
          userId: patient.id,
          code: otpCode,
          mfaToken: mfaSessionToken,
          expiresAt,
          email: patient.email,
          verified: false,
          resendCount: 0,
          failedAttempts: 0,
        });

        // Fetch the record
        const foundRecord = await MfaToken.findOne({
          where: { mfaToken: mfaSessionToken },
        });

        expect(foundRecord).toBeDefined();
        expect(foundRecord?.code).toBe(otpCode);
        expect(foundRecord?.isExpired()).toBe(false);

        // Clean up
        await mfaRecord.destroy();
      }
    });
  });
});
