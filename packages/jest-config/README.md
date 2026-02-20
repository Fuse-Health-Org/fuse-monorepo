# @fuse/jest-config

Shared Jest configuration and testing utilities for Fuse Health applications.

## Features

- **Unified Configuration**: Separate configs for unit and integration tests
- **Mock Factories**: Pre-built mocks for database, auth, and external clients
- **Test Fixtures**: Sample data for users, patients, doctors, and more
- **Test Utilities**: Helpers for common testing tasks
- **Auth Helpers**: Sign-in utilities using environment credentials
- **Database Setup**: Tools for integration test database management

## Installation

This package is already included in the monorepo workspace. To use it in your package:

```json
{
  "dependencies": {
    "@fuse/jest-config": "workspace:*"
  },
  "devDependencies": {
    "jest": "catalog:",
    "ts-jest": "catalog:",
    "@types/jest": "catalog:"
  }
}
```

## Quick Start

### 1. Create Jest Configuration Files

Create two Jest config files in your package root:

**jest.config.unit.js**
```javascript
const baseConfig = require('@fuse/jest-config/dist/configs/jest.unit.config').default;

module.exports = {
  ...baseConfig,
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.unit.test.ts'],
};
```

**jest.config.integration.js**
```javascript
const baseConfig = require('@fuse/jest-config/dist/configs/jest.integration.config').default;

module.exports = {
  ...baseConfig,
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.integration.test.ts'],
};
```

### 2. Add Test Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "pnpm test:unit && pnpm test:integration",
    "test:unit": "jest --config=jest.config.unit.js",
    "test:integration": "jest --config=jest.config.integration.js",
    "test:watch": "jest --config=jest.config.unit.js --watch"
  }
}
```

### 3. Set Up Environment Variables

Add test credentials to your `.env.local`:

```bash
# Test User Credentials
TEST_USER_EMAIL=test-user@example.com
TEST_USER_PASSWORD=Test123!SecurePassword

# Test API URL
TEST_API_URL=http://localhost:3001
```

## Writing Tests

### Unit Tests

Unit tests should be named `*.unit.test.ts` and mock all external dependencies.

```typescript
import {
  createMockRequest,
  createMockResponse,
  createModelInstance,
  userFixtures,
} from '@fuse/jest-config';
import User from '../models/User';

// Mock external dependencies
jest.mock('../models/User');

describe('User Service (Unit)', () => {
  it('should create a user', async () => {
    const mockUser = createModelInstance(userFixtures.patient);
    (User.create as jest.Mock).mockResolvedValue(mockUser);

    // Your test logic here
  });
});
```

### Integration Tests

Integration tests should be named `*.integration.test.ts` and test against a real database.

```typescript
import supertest from 'supertest';
import { signInWithTestCredentials, createPatientFixture } from '@fuse/jest-config';
import app from '../app';

describe('Auth API (Integration)', () => {
  let request: supertest.SuperTest<supertest.Test>;

  beforeAll(() => {
    request = supertest(app);
  });

  it('should sign in with valid credentials', async () => {
    const { token, user } = await signInWithTestCredentials();

    expect(token).toBeDefined();
    expect(user.email).toBeDefined();
  });

  it('should create a new patient', async () => {
    const response = await request
      .post('/api/patients')
      .send(createPatientFixture())
      .expect(201);

    expect(response.body.success).toBe(true);
  });
});
```

## API Reference

### Mocks

#### Database Mocks
```typescript
import {
  createMockSequelize,
  createMockModel,
  createMockTransaction,
} from '@fuse/jest-config';

const mockDB = createMockSequelize();
const mockUserModel = createMockModel('User');
const mockTx = createMockTransaction();
```

#### Auth Mocks
```typescript
import {
  createMockRequest,
  createMockResponse,
  createMockAuthenticatedRequest,
  createMockJWTToken,
} from '@fuse/jest-config';

const req = createMockRequest({ body: { email: 'test@example.com' } });
const res = createMockResponse();
const authReq = createMockAuthenticatedRequest(mockUser);
const token = createMockJWTToken('user-id', 'patient');
```

#### Client Mocks
```typescript
import {
  createMockStripeClient,
  createMockS3Client,
  createMockSendGridClient,
  createMockAxios,
} from '@fuse/jest-config';

const stripe = createMockStripeClient();
const s3 = createMockS3Client();
const sendgrid = createMockSendGridClient();
const axios = createMockAxios();
```

### Fixtures

#### User Fixtures
```typescript
import {
  createUserFixture,
  userFixtures,
  createUserFixtures,
} from '@fuse/jest-config';

// Pre-defined fixtures
const patient = userFixtures.patient;
const doctor = userFixtures.doctor;
const admin = userFixtures.admin;

// Create custom fixture
const customUser = createUserFixture({
  email: 'custom@example.com',
  role: 'patient',
});

// Create multiple fixtures
const users = createUserFixtures(10);
```

#### Patient & Doctor Fixtures
```typescript
import {
  createPatientFixture,
  patientFixtures,
  createDoctorFixture,
  doctorFixtures,
} from '@fuse/jest-config';

const patient = createPatientFixture({ allergies: ['Penicillin'] });
const doctor = createDoctorFixture({ isApprovedDoctor: true });
```

### Utilities

#### Auth Utilities
```typescript
import {
  signInWithTestCredentials,
  signIn,
  createAuthenticatedClient,
  getAuthHeaders,
} from '@fuse/jest-config';

// Sign in with env credentials
const { token, user } = await signInWithTestCredentials();

// Sign in with custom credentials
const auth = await signIn('test@example.com', 'password');

// Create authenticated HTTP client
const client = createAuthenticatedClient(token);

// Get auth headers for supertest
const headers = getAuthHeaders(token);
```

#### Test Utilities
```typescript
import {
  wait,
  retry,
  randomEmail,
  waitFor,
  createMockFile,
} from '@fuse/jest-config';

await wait(1000); // Wait 1 second
const result = await retry(() => fetchData(), { maxAttempts: 3 });
const email = randomEmail('test'); // test.1234567890.5678@example.com
await waitFor(() => condition === true, { timeout: 5000 });
const file = createMockFile('test.pdf', 'content');
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run tests in watch mode
pnpm test:watch

# Run from root (all packages)
pnpm --filter @fuse/api test:unit
```

## Best Practices

### Unit Tests
- Mock all external dependencies (database, APIs, file system)
- Test business logic in isolation
- Use fixtures for consistent test data
- Keep tests fast (< 100ms per test)

### Integration Tests
- Use a test database (separate from development)
- Clean up test data after each test
- Test the full request/response cycle
- Mock only external APIs (not your own database)

### Test Organization
```
src/
├── endpoints/
│   ├── auth/
│   │   ├── __tests__/
│   │   │   ├── signin.unit.test.ts
│   │   │   └── signin.integration.test.ts
│   │   └── index.ts
├── services/
│   ├── __tests__/
│   │   ├── user.service.unit.test.ts
│   │   └── user.service.integration.test.ts
│   └── user.service.ts
```

## Troubleshooting

### Tests are running slowly
- Make sure unit tests are mocking all dependencies
- Use `--maxWorkers=1` for integration tests to avoid DB conflicts
- Check if database connections are being closed properly

### Module resolution errors
- Ensure `tsconfig-paths` is registered in Jest config
- Check that path aliases in `tsconfig.json` match Jest's `moduleNameMapper`

### Database connection errors
- Verify `DATABASE_URL` is set in `.env.local`
- Ensure test database is running
- Check database permissions

## Contributing

When adding new testing utilities:

1. Add the utility to the appropriate file in `src/`
2. Export it from `src/index.ts`
3. Update this README with usage examples
4. Add tests for the utility itself

## License

UNLICENSED
