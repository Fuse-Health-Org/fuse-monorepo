import { Request, Response, NextFunction } from 'express';

/**
 * PHI Masking Middleware
 *
 * When the request comes from an impersonation session (req.user.impersonating === true),
 * intercepts res.json() to recursively mask known PHI fields before sending the response.
 * For non-impersonation requests, this middleware is a no-op (zero overhead).
 *
 * HIPAA 45 CFR 164.502(b) — Minimum Necessary: limits PHI exposure during impersonation.
 */

// PHI field names and their masking functions
const PHI_MASKERS: Record<string, (value: any) => any> = {
  firstName: () => '[REDACTED]',
  lastName: () => '[REDACTED]',
  email: (v: any) => {
    if (typeof v !== 'string' || !v.includes('@')) return '***@***.com';
    return v.charAt(0) + '***@***.com';
  },
  phoneNumber: (v: any) => {
    if (typeof v !== 'string' || v.length < 4) return '***-***-****';
    return '***-***-' + v.slice(-4);
  },
  phone: (v: any) => {
    if (typeof v !== 'string' || v.length < 4) return '***-***-****';
    return '***-***-' + v.slice(-4);
  },
  dob: () => '**/**/****',
  dateOfBirth: () => '**/**/****',
  address: () => '[Address Hidden]',
  address1: () => '[Address Hidden]',
  address2: () => '[Address Hidden]',
  apartment: () => '[Address Hidden]',
  zipCode: () => '*****',
  postalCode: () => '*****',
  ssn: () => '***-**-****',
  socialSecurityNumber: () => '***-**-****',
};

function maskValue(key: string, value: any): any {
  const masker = PHI_MASKERS[key];
  if (masker && value != null) {
    return masker(value);
  }
  return value;
}

function maskObject(data: any): any {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map((item) => maskObject(item));
  }

  if (typeof data === 'object' && !(data instanceof Date)) {
    const masked: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      const value = data[key];
      if (key in PHI_MASKERS) {
        masked[key] = maskValue(key, value);
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = maskObject(value);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }

  return data;
}

export function phiMaskingMiddleware(req: Request, res: Response, next: NextFunction) {
  // Override res.json — check impersonation status at call time (after authenticateJWT runs)
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    const user = (req as any).user;
    if (user?.impersonating) {
      return originalJson(maskObject(body));
    }
    return originalJson(body);
  };

  next();
}
