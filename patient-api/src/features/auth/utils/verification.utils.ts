/**
 * In-memory store for email verification codes
 * Format: { email: { code: string, expiresAt: number, firstName?: string } }
 */
export const verificationCodes = new Map<
  string,
  { code: string; expiresAt: number; firstName?: string }
>();

/**
 * Clean up expired codes every 5 minutes
 */
export function startVerificationCodeCleanup() {
  setInterval(
    () => {
      const now = Date.now();
      for (const [email, data] of verificationCodes.entries()) {
        if (data.expiresAt < now) {
          verificationCodes.delete(email);
        }
      }
    },
    5 * 60 * 1000
  );
}

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Get verification code expiration time (10 minutes from now)
 */
export function getVerificationExpiration(): number {
  return Date.now() + 10 * 60 * 1000;
}

