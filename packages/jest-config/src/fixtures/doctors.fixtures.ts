/**
 * Doctor test fixtures
 * Provides sample doctor data for testing
 */

import { createUserFixture, UserFixture } from './users.fixtures';

export interface DoctorFixture extends UserFixture {
  npiNumber?: string;
  isApprovedDoctor: boolean;
  doctorLicenseStatesCoverage?: string[];
}

/**
 * Create a doctor fixture with optional overrides
 */
export const createDoctorFixture = (overrides: Partial<DoctorFixture> = {}): DoctorFixture => {
  const baseUser = createUserFixture({
    role: 'doctor',
    ...overrides,
  });

  return {
    ...baseUser,
    npiNumber: '1234567890',
    isApprovedDoctor: true,
    doctorLicenseStatesCoverage: ['CA', 'NY', 'TX'],
    ...overrides,
  };
};

/**
 * Predefined doctor fixtures
 */
export const doctorFixtures = {
  approved: createDoctorFixture({
    id: 'doctor-approved-001',
    firstName: 'Dr. Sarah',
    lastName: 'Anderson',
    email: 'dr.anderson@example.com',
    npiNumber: '1234567890',
    isApprovedDoctor: true,
    doctorLicenseStatesCoverage: ['CA', 'NY', 'FL'],
  }),

  pending: createDoctorFixture({
    id: 'doctor-pending-001',
    firstName: 'Dr. Robert',
    lastName: 'Taylor',
    email: 'dr.taylor@example.com',
    npiNumber: '0987654321',
    isApprovedDoctor: false,
    doctorLicenseStatesCoverage: ['TX'],
  }),

  multiState: createDoctorFixture({
    id: 'doctor-multistate-001',
    firstName: 'Dr. Jennifer',
    lastName: 'Lee',
    email: 'dr.lee@example.com',
    npiNumber: '1122334455',
    isApprovedDoctor: true,
    doctorLicenseStatesCoverage: ['CA', 'NY', 'TX', 'FL', 'IL'],
  }),

  specialist: createDoctorFixture({
    id: 'doctor-specialist-001',
    firstName: 'Dr. Michael',
    lastName: 'Chen',
    email: 'dr.chen@example.com',
    npiNumber: '5544332211',
    isApprovedDoctor: true,
    doctorLicenseStatesCoverage: ['CA', 'WA'],
  }),
};

/**
 * Create multiple doctor fixtures
 */
export const createDoctorFixtures = (count: number, baseOverrides: Partial<DoctorFixture> = {}): DoctorFixture[] => {
  return Array.from({ length: count }, (_, index) =>
    createDoctorFixture({
      ...baseOverrides,
      firstName: `Dr. Doctor${index + 1}`,
      email: `doctor${index + 1}@example.com`,
      npiNumber: `${1000000000 + index}`,
    })
  );
};
