/**
 * Patient test fixtures
 * Provides sample patient data for testing
 */

import { createUserFixture, UserFixture } from './users.fixtures';

export interface PatientFixture extends UserFixture {
  allergies?: any[];
  diseases?: any[];
  medications?: any[];
  pharmacyPatientId?: string;
  mdPatientId?: string;
  emergencyContact?: string;
}

/**
 * Create a patient fixture with optional overrides
 */
export const createPatientFixture = (overrides: Partial<PatientFixture> = {}): PatientFixture => {
  const baseUser = createUserFixture({
    role: 'patient',
    ...overrides,
  });

  return {
    ...baseUser,
    dob: '1985-05-20',
    gender: 'male',
    phoneNumber: '555-0123',
    allergies: [],
    diseases: [],
    medications: [],
    ...overrides,
  };
};

/**
 * Predefined patient fixtures
 */
export const patientFixtures = {
  basic: createPatientFixture({
    id: 'patient-basic-001',
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice.johnson@example.com',
    dob: '1992-03-15',
    gender: 'female',
  }),

  withAllergies: createPatientFixture({
    id: 'patient-allergies-001',
    firstName: 'Bob',
    lastName: 'Williams',
    email: 'bob.williams@example.com',
    allergies: [
      { name: 'Penicillin', severity: 'high' },
      { name: 'Peanuts', severity: 'medium' },
    ],
  }),

  withMedications: createPatientFixture({
    id: 'patient-meds-001',
    firstName: 'Carol',
    lastName: 'Davis',
    email: 'carol.davis@example.com',
    medications: [
      { name: 'Metformin', dosage: '500mg', frequency: 'twice daily' },
      { name: 'Lisinopril', dosage: '10mg', frequency: 'once daily' },
    ],
  }),

  withDiseases: createPatientFixture({
    id: 'patient-diseases-001',
    firstName: 'David',
    lastName: 'Martinez',
    email: 'david.martinez@example.com',
    diseases: [
      { name: 'Type 2 Diabetes', diagnosedDate: '2020-01-15' },
      { name: 'Hypertension', diagnosedDate: '2019-06-20' },
    ],
  }),

  withPharmacyId: createPatientFixture({
    id: 'patient-pharmacy-001',
    firstName: 'Emma',
    lastName: 'Garcia',
    email: 'emma.garcia@example.com',
    pharmacyPatientId: 'PHARM-12345',
    mdPatientId: 'MD-67890',
  }),
};

/**
 * Create multiple patient fixtures
 */
export const createPatientFixtures = (count: number, baseOverrides: Partial<PatientFixture> = {}): PatientFixture[] => {
  return Array.from({ length: count }, (_, index) =>
    createPatientFixture({
      ...baseOverrides,
      firstName: `Patient${index + 1}`,
      email: `patient${index + 1}@example.com`,
    })
  );
};
