# Auth Feature

This feature handles all authentication-related endpoints following the vertical slice architecture pattern.

## Structure

```
features/auth/
├── controllers/
│   └── auth.controller.ts    # All auth endpoint handlers
├── routes/
│   └── auth.routes.ts         # Auth route definitions
├── utils/
│   ├── google.utils.ts        # Google OAuth utilities
│   └── verification.utils.ts  # Email verification utilities
├── index.ts                   # Feature exports and initialization
└── README.md                  # This file
```

## Endpoints

### Public Endpoints

- `POST /auth/signup` - User registration
- `POST /auth/signin` - User sign in with email and password
- `POST /auth/mfa/verify` - Verify MFA code and issue JWT token
- `POST /auth/mfa/resend` - Resend MFA code
- `POST /auth/send-verification-code` - Send verification code to email
- `POST /auth/verify-code` - Verify code and sign in
- `GET /auth/verify-email` - Email verification endpoint
- `GET /auth/google/login` - Initiate Google OAuth login
- `GET /auth/google/callback` - Handle Google OAuth callback
- `POST /auth/google` - Google OAuth sign-in (for frontend modal)

### Protected Endpoints

- `POST /auth/signout` - User sign out
- `GET /auth/me` - Get current user
- `PUT /auth/profile` - Update user profile

## Features

- **Email/Password Authentication**: Traditional authentication with MFA support
- **Google OAuth**: Single sign-on with Google accounts
- **Multi-Factor Authentication (MFA)**: OTP codes sent via email
- **Email Verification**: Account activation via email links
- **Profile Management**: Update user profile information
- **HIPAA Compliance**: Audit logging for all authentication events
- **SuperAdmin Bypass**: Skip MFA for superadmin users

## Utilities

### Google OAuth Utilities

- `decodeGoogleCredential()` - Decode Google JWT credential
- `buildGoogleAuthUrl()` - Build Google Auth URL
- `exchangeGoogleCode()` - Exchange authorization code for access token
- `getGoogleUserInfo()` - Get user info from Google

### Verification Utilities

- `verificationCodes` - In-memory store for email verification codes
- `startVerificationCodeCleanup()` - Cleanup expired codes every 5 minutes
- `generateVerificationCode()` - Generate 6-digit verification code
- `getVerificationExpiration()` - Get expiration time (10 minutes)

## Dependencies

- `@fuse/validators` - Zod schemas for request validation
- `User`, `UserRoles`, `Clinic`, `MfaToken` - Database models
- `MailsSender` - Email service
- `AuditService` - HIPAA audit logging
- `JWT utilities` - Token creation and validation

## Usage

The auth feature is automatically registered in `main.ts`:

```typescript
import { authRoutes } from "./features/auth";
app.use("/", authRoutes);
```

## Notes

- All endpoints follow HIPAA compliance with audit logging
- MFA is required for all non-superadmin users (except Google OAuth)
- Google OAuth users skip MFA as Google provides strong authentication
- Verification codes expire after 10 minutes
- MFA codes expire after 10 minutes with max 3 resend attempts
- Failed MFA attempts are rate-limited (max 5 attempts)

