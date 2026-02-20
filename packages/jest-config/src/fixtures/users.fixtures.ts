/**
 * User test fixtures
 * Provides sample user data for testing
 */

import { randomUUID } from 'crypto';

export interface UserFixture {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  role: 'patient' | 'doctor' | 'admin' | 'brand' | 'affiliate';
  activated: boolean;
  phoneNumber?: string;
  dob?: string;
  gender?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generate a mock password hash (for testing only)
 */
const MOCK_PASSWORD_HASH = '$2b$12$mockPasswordHashForTestingOnly1234567890abcdefghijklmnopqr';

/**
 * Create a user fixture with optional overrides
 */
export const createUserFixture = (overrides: Partial<UserFixture> = {}): UserFixture => {
  const id = overrides.id || randomUUID();
  const timestamp = new Date();

  return {
    id,
    firstName: 'John',
    lastName: 'Doe',
    email: `john.doe.${id.slice(0, 8)}@example.com`,
    passwordHash: MOCK_PASSWORD_HASH,
    role: 'patient',
    activated: true,
    phoneNumber: '555-0100',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
};

/**
 * Predefined user fixtures
 */
export const userFixtures = {
  patient: createUserFixture({
    id: 'patient-001',
    firstName: 'Jane',
    lastName: 'Patient',
    email: 'jane.patient@example.com',
    role: 'patient',
    dob: '1990-01-15',
    gender: 'female',
  }),

  doctor: createUserFixture({
    id: 'doctor-001',
    firstName: 'Dr. Michael',
    lastName: 'Smith',
    email: 'dr.smith@example.com',
    role: 'doctor',
  }),

  admin: createUserFixture({
    id: 'admin-001',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    role: 'admin',
  }),

  brand: createUserFixture({
    id: 'brand-001',
    firstName: 'Brand',
    lastName: 'Manager',
    email: 'brand@example.com',
    role: 'brand',
  }),

  affiliate: createUserFixture({
    id: 'affiliate-001',
    firstName: 'Affiliate',
    lastName: 'Partner',
    email: 'affiliate@example.com',
    role: 'affiliate',
  }),

  unactivated: createUserFixture({
    id: 'unactivated-001',
    firstName: 'Unactivated',
    lastName: 'User',
    email: 'unactivated@example.com',
    activated: false,
  }),
};

/**
 * Create multiple user fixtures
 */
export const createUserFixtures = (count: number, baseOverrides: Partial<UserFixture> = {}): UserFixture[] => {
  return Array.from({ length: count }, (_, index) =>
    createUserFixture({
      ...baseOverrides,
      firstName: `User${index + 1}`,
      email: `user${index + 1}@example.com`,
    })
  );
};
