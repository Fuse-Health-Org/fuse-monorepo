# Backend Refactoring Guide

This guide documents the refactoring of the patient-api backend from a monolithic `main.ts` file to a modular vertical slice architecture.

## Goals

1. **Vertical Slice Architecture**: Organize code by feature, not by technical layer
2. **Reusable Components**: Extract common logic into utilities and services
3. **Maintainability**: Make the codebase easier to understand and modify
4. **Scalability**: Enable multiple developers to work on different features simultaneously
5. **Clean main.ts**: Keep the main entry point minimal and focused on configuration

## Architecture Pattern

### Vertical Slice Structure

Each feature follows this structure:

```
features/
└── feature-name/
    ├── controllers/
    │   └── feature.controller.ts    # Request handlers
    ├── routes/
    │   └── feature.routes.ts         # Route definitions
    ├── services/                     # Optional: feature-specific services
    │   └── feature.service.ts
    ├── utils/                        # Optional: feature-specific utilities
    │   └── feature.utils.ts
    ├── index.ts                      # Feature exports
    └── README.md                     # Feature documentation
```

### Benefits

- **Cohesion**: Related code stays together
- **Independence**: Features can be developed and tested independently
- **Discoverability**: Easy to find all code related to a feature
- **Reusability**: Shared logic is extracted to utilities and services

## Refactored Features

### ✅ Auth Feature

**Location**: `features/auth/`

**Endpoints Refactored** (13 total):
- POST /auth/signup
- POST /auth/signin
- POST /auth/mfa/verify
- POST /auth/mfa/resend
- POST /auth/send-verification-code
- POST /auth/verify-code
- GET /auth/verify-email
- GET /auth/google/login
- GET /auth/google/callback
- POST /auth/google
- POST /auth/signout
- GET /auth/me
- PUT /auth/profile

**Utilities Created**:
- `google.utils.ts` - Google OAuth helpers
- `verification.utils.ts` - Email verification helpers

**Lines Removed from main.ts**: ~1,420 lines

### ✅ Sequences Feature

**Location**: `features/sequences/`

**Status**: Already refactored

### ✅ Templates Feature

**Location**: `features/templates/`

**Status**: Already refactored

### ✅ Contacts Feature

**Location**: `features/contacts/`

**Status**: Already refactored

### ✅ Tags Feature

**Location**: `features/tags/`

**Status**: Already refactored

## Remaining Features to Refactor

Based on the endpoint analysis, here are the remaining features:

### High Priority

1. **Clinic Management** (~15 endpoints)
   - GET /clinic/by-slug/:slug
   - GET /clinic/:id
   - PUT /clinic/:id
   - etc.

2. **Products Management** (~10 endpoints)
   - GET /products/by-clinic/:clinicId
   - POST /products
   - PUT /products/:id
   - DELETE /products/:id
   - etc.

3. **Treatments Management** (~8 endpoints)
   - GET /treatments/by-clinic-slug/:slug
   - POST /treatments
   - GET /treatments/:id
   - etc.

4. **Orders & Payments** (~15 endpoints)
   - POST /orders/create-payment-intent
   - POST /confirm-payment
   - POST /payments/product/sub
   - etc.

5. **Questionnaires & Forms** (~20 endpoints)
   - GET /questionnaires/standardized
   - GET /global-form-structures
   - POST /global-form-structures
   - etc.

### Medium Priority

6. **Custom Websites** (~6 endpoints)
7. **Subscriptions** (~8 endpoints)
8. **Webhooks** (Stripe, MD, Pharmacy)
9. **Analytics & Dashboard**
10. **Doctor Portal**

### Low Priority

11. **File Uploads**
12. **Pharmacy Integration**
13. **MD Integration**
14. **Support Tickets**

## Refactoring Checklist

When refactoring a feature:

- [ ] Create feature directory structure
- [ ] Create routes file with all endpoints
- [ ] Create controller with all handlers
- [ ] Extract reusable logic to utilities
- [ ] Extract business logic to services (if needed)
- [ ] Create feature index.ts with exports
- [ ] Register routes in main.ts
- [ ] Comment out old endpoints in main.ts
- [ ] Test that endpoints still work
- [ ] Create feature README.md
- [ ] Update this guide

## Shared Services

These services are used across multiple features and should remain in `services/`:

- `MailsSender` - Email service
- `AuditService` - HIPAA audit logging
- `UserService` - User management
- `OrderService` - Order processing
- `PaymentService` - Payment processing
- `StripeService` - Stripe integration
- `WebSocketService` - Real-time communication
- `SmsService` - SMS notifications

## Shared Utilities

These utilities are used across multiple features and should remain in `utils/`:

- `hipaa-masking.ts` - PHI data masking
- `logger.ts` - Logging utilities
- `pagination.ts` - Pagination helpers
- `questionnaireAnswers.ts` - Questionnaire processing

## Configuration

Configuration files remain in `config/`:

- `database.ts` - Database connection
- `jwt.ts` - JWT authentication
- `s3.ts` - S3 file storage
- `session.ts` - Session management

## Models

All Sequelize models remain in `models/` as they are shared across features.

## Migration Strategy

1. **Incremental Approach**: Refactor one feature at a time
2. **No Breaking Changes**: Keep all endpoints working during refactoring
3. **Comment Old Code**: Don't delete old code immediately, comment it out
4. **Test Each Feature**: Verify endpoints work after refactoring
5. **Document Everything**: Update docs as you go

## Testing

After refactoring a feature:

1. Build the project: `pnpm build`
2. Check for TypeScript errors
3. Test all endpoints manually or with automated tests
4. Verify audit logs are still working
5. Check that error handling is preserved

## Current Status

- **Total Endpoints in main.ts**: ~169
- **Refactored Endpoints**: ~40 (Auth + Sequences + Templates + Contacts + Tags)
- **Remaining Endpoints**: ~129
- **Lines in main.ts**: ~16,331 → Target: <2,000

## Next Steps

1. Refactor Clinic Management feature
2. Refactor Products Management feature
3. Refactor Treatments Management feature
4. Continue with remaining features

## Notes

- Always maintain HIPAA compliance with audit logging
- Keep error messages generic (no PHI in logs)
- Preserve all validation logic
- Maintain backward compatibility
- Use TypeScript strict mode
- Follow existing code style

