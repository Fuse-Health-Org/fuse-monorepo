/**
 * Test user seeding for integration tests
 * Creates users with different roles in the test database
 */

import bcrypt from 'bcrypt';

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'patient' | 'doctor' | 'admin' | 'brand' | 'affiliate';
  phoneNumber?: string;
  activated: boolean;
}

/**
 * Default password for all test users (for convenience in testing)
 */
export const TEST_USER_PASSWORD = 'Test123!SecurePassword';

/**
 * Predefined test users for integration tests
 */
export const TEST_USERS: Record<string, TestUser> = {
  patient: {
    email: 'test-patient@example.com',
    password: TEST_USER_PASSWORD,
    firstName: 'Test',
    lastName: 'Patient',
    role: 'patient',
    phoneNumber: '555-0001',
    activated: true,
  },
  doctor: {
    email: 'test-doctor@example.com',
    password: TEST_USER_PASSWORD,
    firstName: 'Test',
    lastName: 'Doctor',
    role: 'doctor',
    phoneNumber: '555-0002',
    activated: true,
  },
  admin: {
    email: 'test-admin@example.com',
    password: TEST_USER_PASSWORD,
    firstName: 'Test',
    lastName: 'Admin',
    role: 'admin',
    phoneNumber: '555-0003',
    activated: true,
  },
  superadmin: {
    email: 'test-superadmin@example.com',
    password: TEST_USER_PASSWORD,
    firstName: 'Test',
    lastName: 'SuperAdmin',
    role: 'admin', // Using admin role with special permissions
    phoneNumber: '555-0004',
    activated: true,
  },
  brand: {
    email: 'test-brand@example.com',
    password: TEST_USER_PASSWORD,
    firstName: 'Test',
    lastName: 'Brand',
    role: 'brand',
    phoneNumber: '555-0005',
    activated: true,
  },
  affiliate: {
    email: 'test-affiliate@example.com',
    password: TEST_USER_PASSWORD,
    firstName: 'Test',
    lastName: 'Affiliate',
    role: 'affiliate',
    phoneNumber: '555-0006',
    activated: true,
  },
};

/**
 * Create test users in the database
 * This should be called during test setup
 */
export const seedTestUsers = async (User: any, UserRoles: any) => {
  try {
    console.log('[DB] Seeding test users...');

    const passwordHash = await bcrypt.hash(TEST_USER_PASSWORD, 10);
    const createdUsers = [];

    for (const [key, userData] of Object.entries(TEST_USERS)) {
      // Check if user already exists
      const existingUser = await User.findOne({
        where: { email: userData.email },
      });

      if (existingUser) {
        console.log(`[DB] Test user already exists: ${userData.email}`);
        continue;
      }

      // Create user
      const user = await User.create({
        email: userData.email,
        passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        phoneNumber: userData.phoneNumber,
        activated: userData.activated,
      });

      // Create user roles
      await UserRoles.create({
        userId: user.id,
        patient: userData.role === 'patient',
        doctor: userData.role === 'doctor',
        admin: userData.role === 'admin' || key === 'superadmin',
        brand: userData.role === 'brand',
        affiliate: userData.role === 'affiliate',
      });

      createdUsers.push(user);
      console.log(`[DB] Created test user: ${userData.email} (${userData.role})`);
    }

    console.log(`[DB] Test user seeding complete (${createdUsers.length} created)`);
    return createdUsers;
  } catch (error) {
    console.error('[DB ERROR] Failed to seed test users:', error);
    throw error;
  }
};

/**
 * Clean up test users from the database
 */
export const cleanupTestUsers = async (User: any) => {
  try {
    const emails = Object.values(TEST_USERS).map((u) => u.email);

    const deleted = await User.destroy({
      where: {
        email: emails,
      },
    });

    console.log(`[DB] Cleaned up ${deleted} test users`);
  } catch (error) {
    console.error('[DB ERROR] Failed to cleanup test users:', error);
    throw error;
  }
};
