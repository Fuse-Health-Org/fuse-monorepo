import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// SECURITY: No fallback secrets - fail hard if not configured
if (!process.env.JWT_SECRET) {
  // HIPAA: Do not log detailed instructions in production
  throw new Error('JWT_SECRET environment variable is required');
}

// SECURITY: Validate JWT_SECRET minimum length for HIPAA compliance
if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters for security compliance');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '30m'; // 30 minutes for HIPAA compliance

export interface JWTPayload {
  userId: string;
  userRole: 'patient' | 'provider' | 'admin' | 'brand';
  clinicId?: string;
  loginTime: number;
  iat?: number;
  exp?: number;
  // Impersonation fields (set when superAdmin is viewing as another user)
  impersonating?: boolean;
  impersonatedBy?: string;
}

// Create JWT token
export const createJWTToken = (user: any): string => {
  // HIPAA: Do not include PII (email) in JWT payload
  const payload: JWTPayload = {
    userId: user.id,
    userRole: user.role,
    clinicId: user.clinicId,
    loginTime: Date.now(),
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'patient-portal-api',
    audience: 'patient-portal-frontend',
  });
};

// Create impersonation JWT token (separate function to prevent accidental impersonation field injection)
export const createImpersonationToken = (targetUser: any, impersonatorId: string): string => {
  const payload: JWTPayload = {
    userId: targetUser.id,
    userRole: targetUser.role,
    clinicId: targetUser.clinicId,
    loginTime: Date.now(),
    impersonating: true,
    impersonatedBy: impersonatorId,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'patient-portal-api',
    audience: 'patient-portal-frontend',
  });
};

// Verify JWT token
export const verifyJWTToken = (token: string): JWTPayload | null => {
  try {
    // First try with issuer/audience validation
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'patient-portal-api',
      audience: 'patient-portal-frontend',
    }) as JWTPayload;

    return decoded;
  } catch (error: any) {
    // Fallback: try without issuer/audience for backwards compatibility with old tokens
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      // Map old token format to new format if needed
      // HIPAA: Do not include PII in returned payload
      return {
        userId: decoded.userId,
        userRole: decoded.role || decoded.userRole,
        loginTime: decoded.loginTime || decoded.iat * 1000,
        iat: decoded.iat,
        exp: decoded.exp,
        // Include impersonation fields if present
        impersonating: decoded.impersonating,
        impersonatedBy: decoded.impersonatedBy,
      };
    } catch (fallbackError) {
      // HIPAA: Do not log token details or error specifics
      return null;
    }
  }
};

// Extract token from Authorization header
export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove 'Bearer ' prefix
};

// Middleware to authenticate JWT requests
export const authenticateJWT = (req: any, res: any, next: any) => {
  // Allowlist public endpoints that must not require auth (e.g., Caddy on-demand TLS ask)
  if (req && (req.path === '/clinic/allow-custom-domain')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const decoded = verifyJWTToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Attach user info to request
  req.user = decoded;
  next();
};

// Check if user is authenticated (for backward compatibility)
export const isAuthenticated = (req: any): boolean => {
  return !!(req.user && req.user.userId);
};

// Get current user from JWT (for backward compatibility)
export const getCurrentUser = (req: any) => {
  if (!isAuthenticated(req)) {
    return null;
  }

  return {
    id: req.user.userId,
    role: req.user.userRole,
    clinicId: req.user.clinicId,
    loginTime: new Date(req.user.loginTime),
    // Include impersonation fields if present in JWT
    impersonating: req.user.impersonating,
    impersonatedBy: req.user.impersonatedBy,
  };
};