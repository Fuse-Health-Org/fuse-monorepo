import { Request, Response } from 'express';
import { 
  signUpSchema, 
  signInSchema, 
  updateProfileSchema 
} from '@fuse/validators';
import User from '../../../models/User';
import UserRoles from '../../../models/UserRoles';
import Clinic from '../../../models/Clinic';
import MfaToken from '../../../models/MfaToken';
import { createJWTToken, getCurrentUser } from '../../../config/jwt';
import { MailsSender } from '../../../services/mailsSender';
import { AuditService, AuditAction, AuditResourceType } from '../../../services/audit.service';
import {
  verificationCodes,
  generateVerificationCode,
  getVerificationExpiration,
} from '../utils/verification.utils';
import {
  decodeGoogleCredential,
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  getGoogleUserInfo,
} from '../utils/google.utils';

/**
 * Helper function to generate unique clinic slug
 */
async function generateUniqueSlug(
  clinicName: string,
  excludeId?: string
): Promise<string> {
  const baseSlug = clinicName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const whereClause: any = { slug: baseSlug };
  if (excludeId) {
    whereClause.id = { [require("sequelize").Op.ne]: excludeId };
  }

  const existingClinic = await Clinic.findOne({ where: whereClause });

  if (!existingClinic) {
    return baseSlug;
  }

  let counter = 1;
  while (true) {
    const slugWithNumber = `${baseSlug}-${counter}`;
    const whereClauseWithNumber: any = { slug: slugWithNumber };
    if (excludeId) {
      whereClauseWithNumber.id = { [require("sequelize").Op.ne]: excludeId };
    }

    const existingWithNumber = await Clinic.findOne({
      where: whereClauseWithNumber,
    });

    if (!existingWithNumber) {
      return slugWithNumber;
    }

    counter++;
  }
}

/**
 * POST /auth/signup
 * User registration
 */
export const signup = async (req: Request, res: Response) => {
  try {
    const validation = signUpSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const {
      firstName,
      lastName,
      email,
      password,
      role,
      dateOfBirth,
      phoneNumber,
      clinicName,
      clinicId,
      website,
      businessType,
    } = validation.data;

    // Validate clinic name for providers/brands
    if ((role === "provider" || role === "brand") && !clinicName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Clinic name is required for providers and brand users",
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.log("🔍 Checking if user exists");
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      if (process.env.NODE_ENV === "development") {
        console.log("❌ User already exists");
      }
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.log("✅ No existing user found, proceeding with registration");
    }

    // Handle clinic association
    let clinic: any = null;
    let finalClinicId = clinicId;

    // Create clinic if user is a healthcare provider and no clinicId provided
    if ((role === "provider" || role === "brand") && clinicName && !clinicId) {
      if (process.env.NODE_ENV === "development") {
        console.log("🏥 Creating clinic");
      }

      const slug = await generateUniqueSlug(clinicName.trim());

      clinic = await Clinic.create({
        name: clinicName.trim(),
        slug: slug,
        logo: "",
        businessType: businessType || null,
      });

      finalClinicId = clinic.id;
      if (process.env.NODE_ENV === "development") {
        console.log("✅ Clinic created successfully with ID:", clinic.id);
      }
    } else if (clinicId) {
      if (process.env.NODE_ENV === "development") {
        console.log("🔗 Associating user with existing clinic ID:", clinicId);
      }
    }

    // Map frontend role to backend role
    let mappedRole: "patient" | "doctor" | "admin" | "brand" = "patient";
    if (role === "provider") {
      mappedRole = "doctor";
    } else if (role === "admin") {
      mappedRole = "admin";
    } else if (role === "brand") {
      mappedRole = "brand";
    }

    // Create new user in database
    if (process.env.NODE_ENV === "development") {
      console.log("🚀 Creating new user");
    }

    const user = await User.createUser({
      firstName,
      lastName,
      email,
      password,
      role: mappedRole,
      dob: dateOfBirth,
      phoneNumber,
      website,
      businessType,
    });

    const isDevelopment = process.env.NODE_ENV === "development";

    if (isDevelopment) {
      console.log("🧪 Development mode detected: auto-activating new user");
      await user.update({
        activated: true,
        activationToken: null,
        activationTokenExpiresAt: null,
      });
    }

    // Associate user with clinic if one is provided
    if (finalClinicId) {
      user.clinicId = finalClinicId;
      await user.save();
      if (process.env.NODE_ENV === "development") {
        console.log("🔗 User associated with clinic ID:", finalClinicId);
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.log("✅ User created successfully with ID:", user.id);
    }

    // Generate activation token and send verification email
    const activationToken = user.generateActivationToken();
    await user.save();

    if (process.env.NODE_ENV === "development") {
      console.log("🔑 Generated activation token for user");
    }

    // Get the frontend origin
    const frontendOrigin =
      req.get("origin") || req.get("referer")?.split("/").slice(0, 3).join("/");
    if (process.env.NODE_ENV === "development") {
      console.log("🌐 Frontend origin detected");
    }

    // Send verification email
    const emailSent = await MailsSender.sendVerificationEmail(
      user.email,
      activationToken,
      user.firstName,
      frontendOrigin
    );

    if (emailSent) {
      console.log("📧 Verification email sent successfully");
    } else {
      console.log("❌ Failed to send verification email, but user was created");
    }

    // HIPAA Audit: Log account creation
    await AuditService.log({
      userId: user.id,
      userEmail: user.email,
      action: AuditAction.CREATE,
      resourceType: AuditResourceType.USER,
      resourceId: user.id,
      ipAddress: AuditService.getClientIp(req),
      details: { role: mappedRole, clinicId: finalClinicId },
      success: true,
    });

    res.status(201).json({
      success: true,
      message:
        "User registered successfully. Please check your email to activate your account.",
      user: user.toSafeJSON(),
      emailSent: emailSent,
    });
  } catch (error: any) {
    // HIPAA Compliance: Don't log the actual error details that might contain PHI
    if (process.env.NODE_ENV === "development") {
      console.error("Registration error occurred:", error.name);
    } else {
      console.error("Registration error occurred");
    }

    // Handle specific database errors
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid user data provided",
      });
    }

    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
};

/**
 * POST /auth/signin
 * User sign in with email and password
 */
export const signin = async (req: Request, res: Response) => {
  try {
    const validation = signInSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.format(),
      });
    }

    const { email, password } = validation.data;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      await AuditService.logLoginFailed(req, email, "User not found");
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Load UserRoles for the user
    await user.getUserRoles();

    // Validate password
    const isValidPassword = await user.validateAnyPassword(password);
    if (!isValidPassword) {
      await AuditService.logLoginFailed(req, email, "Invalid password");
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user account is activated
    if (!user.activated) {
      await AuditService.logLoginFailed(req, email, "Account not activated");
      return res.status(401).json({
        success: false,
        message:
          "Please check your email and activate your account before signing in.",
        needsActivation: true,
      });
    }

    // SuperAdmin bypass: Skip MFA entirely for superAdmin users
    if (user.userRoles?.superAdmin === true) {
      await user.updateLastLogin();
      const token = createJWTToken(user);

      if (process.env.NODE_ENV === "development") {
        console.log(`🔓 SuperAdmin bypass: MFA skipped for user ${user.id}`);
      }

      return res.status(200).json({
        success: true,
        requiresMfa: false,
        token: token,
        user: user.toSafeJSON(),
        message: "Signed in successfully",
      });
    }

    // Generate OTP code and require verification
    const otpCode = MfaToken.generateCode();
    const mfaSessionToken = MfaToken.generateMfaToken();
    const expiresAt = MfaToken.getExpirationTime();

    // Delete any existing MFA tokens for this user
    await MfaToken.destroy({ where: { userId: user.id } });

    // Create new MFA token record
    await MfaToken.create({
      userId: user.id,
      code: otpCode,
      mfaToken: mfaSessionToken,
      expiresAt,
      email: user.email,
      verified: false,
      resendCount: 0,
      failedAttempts: 0,
    });

    // Send OTP email
    const emailSent = await MailsSender.sendMfaCode(
      user.email,
      otpCode,
      user.firstName
    );

    if (!emailSent) {
      console.error("❌ Failed to send MFA code email");
      return res.status(500).json({
        success: false,
        message: "Failed to send verification code. Please try again.",
      });
    }

    // HIPAA Audit: Log MFA code sent
    await AuditService.log({
      action: AuditAction.MFA_CODE_SENT,
      resourceType: AuditResourceType.USER,
      resourceId: user.id,
      userId: user.id,
      clinicId: user.clinicId,
      details: { email: user.email },
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    if (process.env.NODE_ENV === "development") {
      console.log("🔐 MFA code sent");
    }

    res.status(200).json({
      success: true,
      requiresMfa: true,
      mfaToken: mfaSessionToken,
      message: "Verification code sent to your email",
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Authentication error occurred:", error);
    } else {
      console.error("❌ Authentication error occurred");
    }
    res.status(500).json({
      success: false,
      message: "Authentication failed. Please try again.",
    });
  }
};

/**
 * POST /auth/mfa/verify
 * Verify MFA code and issue JWT token
 */
export const verifyMfa = async (req: Request, res: Response) => {
  try {
    const { mfaToken, code } = req.body;

    if (!mfaToken || !code) {
      return res.status(400).json({
        success: false,
        message: "MFA token and verification code are required",
      });
    }

    // Find the MFA token record
    const mfaRecord = await MfaToken.findOne({
      where: { mfaToken },
      include: [{ model: User, as: "user" }],
    });

    if (!mfaRecord) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid or expired verification session. Please sign in again.",
      });
    }

    // Check if expired
    if (mfaRecord.isExpired()) {
      await mfaRecord.destroy();
      return res.status(401).json({
        success: false,
        message: "Verification code has expired. Please sign in again.",
        expired: true,
      });
    }

    // Check if rate limited
    if (mfaRecord.isRateLimited()) {
      await AuditService.log({
        action: AuditAction.MFA_FAILED,
        resourceType: AuditResourceType.USER,
        resourceId: mfaRecord.userId,
        userId: mfaRecord.userId,
        details: { reason: "rate_limited", email: mfaRecord.email },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"],
        success: false,
      });

      return res.status(429).json({
        success: false,
        message: "Too many failed attempts. Please sign in again.",
        rateLimited: true,
      });
    }

    // Verify the code
    if (mfaRecord.code !== code.trim()) {
      mfaRecord.failedAttempts += 1;
      await mfaRecord.save();

      await AuditService.log({
        action: AuditAction.MFA_FAILED,
        resourceType: AuditResourceType.USER,
        resourceId: mfaRecord.userId,
        userId: mfaRecord.userId,
        details: {
          reason: "invalid_code",
          email: mfaRecord.email,
          attempts: mfaRecord.failedAttempts,
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"],
        success: false,
      });

      return res.status(401).json({
        success: false,
        message: "Invalid verification code. Please try again.",
        attemptsRemaining: 5 - mfaRecord.failedAttempts,
      });
    }

    // Code is valid - get the user
    const user = mfaRecord.user || (await User.findByPk(mfaRecord.userId));
    if (!user) {
      await mfaRecord.destroy();
      return res.status(401).json({
        success: false,
        message: "User not found. Please sign in again.",
      });
    }

    // Load UserRoles
    await user.getUserRoles();

    // Mark MFA as verified and delete the record
    await mfaRecord.destroy();

    // Update last login time
    await user.updateLastLogin();

    // Create JWT token
    const token = createJWTToken(user);

    // HIPAA Audit: Log successful MFA verification
    await AuditService.log({
      action: AuditAction.MFA_VERIFIED,
      resourceType: AuditResourceType.USER,
      resourceId: user.id,
      userId: user.id,
      clinicId: user.clinicId,
      details: { email: user.email },
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    // HIPAA Audit: Log successful login
    await AuditService.logLogin(req, {
      id: user.id,
      email: user.email,
      clinicId: user.clinicId,
    });

    if (process.env.NODE_ENV === "development") {
      console.log("✅ MFA verified for user:", user.id);
    }

    res.status(200).json({
      success: true,
      message: "Authentication successful",
      token: token,
      user: user.toSafeJSON(),
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ MFA verification error:", error);
    } else {
      console.error("❌ MFA verification error");
    }
    res.status(500).json({
      success: false,
      message: "Verification failed. Please try again.",
    });
  }
};

/**
 * POST /auth/mfa/resend
 * Resend MFA code
 */
export const resendMfa = async (req: Request, res: Response) => {
  try {
    const { mfaToken } = req.body;

    if (!mfaToken) {
      return res.status(400).json({
        success: false,
        message: "MFA token is required",
      });
    }

    // Find the MFA token record
    const mfaRecord = await MfaToken.findOne({
      where: { mfaToken },
      include: [{ model: User, as: "user" }],
    });

    if (!mfaRecord) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid or expired verification session. Please sign in again.",
      });
    }

    // Check if can resend (max 3 resends)
    if (!mfaRecord.canResend()) {
      return res.status(429).json({
        success: false,
        message: "Maximum resend attempts reached. Please sign in again.",
        maxResends: true,
      });
    }

    // Generate new code and extend expiration
    const newCode = MfaToken.generateCode();
    mfaRecord.code = newCode;
    mfaRecord.expiresAt = MfaToken.getExpirationTime();
    mfaRecord.resendCount += 1;
    mfaRecord.failedAttempts = 0;
    await mfaRecord.save();

    // Send new OTP email
    const user = mfaRecord.user || (await User.findByPk(mfaRecord.userId));
    const emailSent = await MailsSender.sendMfaCode(
      mfaRecord.email,
      newCode,
      user?.firstName
    );

    if (!emailSent) {
      console.error("❌ Failed to resend MFA code to:", mfaRecord.email);
      return res.status(500).json({
        success: false,
        message: "Failed to send verification code. Please try again.",
      });
    }

    // HIPAA Audit: Log MFA code resend
    await AuditService.log({
      action: AuditAction.MFA_RESEND,
      resourceType: AuditResourceType.USER,
      resourceId: mfaRecord.userId,
      userId: mfaRecord.userId,
      details: { email: mfaRecord.email, resendCount: mfaRecord.resendCount },
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    if (process.env.NODE_ENV === "development") {
      console.log(
        "🔐 MFA code resent (attempt",
        mfaRecord.resendCount,
        "of 3)"
      );
    }

    res.status(200).json({
      success: true,
      message: "New verification code sent to your email",
      resendsRemaining: 3 - mfaRecord.resendCount,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ MFA resend error:", error);
    } else {
      console.error("❌ MFA resend error");
    }
    res.status(500).json({
      success: false,
      message: "Failed to resend code. Please try again.",
    });
  }
};

/**
 * POST /auth/send-verification-code
 * Send verification code to email
 */
export const sendVerificationCode = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Generate 6-digit code
    const code = generateVerificationCode();
    const expiresAt = getVerificationExpiration();

    // Check if user exists to personalize email
    let firstName: string | undefined;
    try {
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        firstName = existingUser.firstName;
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ User lookup failed, sending generic email:", error);
      } else {
        console.error("❌ User lookup failed, sending generic email");
      }
    }

    verificationCodes.set(email.toLowerCase(), { code, expiresAt, firstName });

    // Send email with code
    const emailSent = await MailsSender.sendVerificationCode(
      email,
      code,
      firstName
    );

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send verification code. Please try again.",
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.log("✅ Verification code sent");
    }

    res.status(200).json({
      success: true,
      message: "Verification code sent to your email",
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Send verification code error:", error);
    } else {
      console.error("❌ Send verification code error");
    }
    res.status(500).json({
      success: false,
      message: "Failed to send verification code. Please try again.",
    });
  }
};

/**
 * POST /auth/verify-code
 * Verify code and sign in
 */
export const verifyCode = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: "Email and code are required",
      });
    }

    // Get stored code
    const storedData = verificationCodes.get(email.toLowerCase());

    if (!storedData) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired verification code",
      });
    }

    // Check if code is expired
    if (storedData.expiresAt < Date.now()) {
      verificationCodes.delete(email.toLowerCase());
      return res.status(401).json({
        success: false,
        message: "Verification code has expired. Please request a new one.",
      });
    }

    // Verify code
    if (storedData.code !== code.trim()) {
      return res.status(401).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    // Code is valid - delete it
    verificationCodes.delete(email.toLowerCase());

    // Check if user exists
    const user = await User.findByEmail(email);

    if (user) {
      // Check if user account is activated
      if (!user.activated) {
        return res.status(401).json({
          success: false,
          message:
            "Please check your email and activate your account before signing in.",
          needsActivation: true,
        });
      }

      // Update last login time
      await user.updateLastLogin();

      // Create JWT token
      const token = createJWTToken(user);

      if (process.env.NODE_ENV === "development") {
        console.log("✅ User signed in via verification code");
      }

      return res.status(200).json({
        success: true,
        message: "Signed in successfully",
        token: token,
        user: user.toSafeJSON(),
        isExistingUser: true,
      });
    } else {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ Verification successful for new user");
      }

      return res.status(200).json({
        success: true,
        message: "Email verified successfully",
        email: email,
        isExistingUser: false,
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Verify code error:", error);
    } else {
      console.error("❌ Verify code error");
    }

    res.status(500).json({
      success: false,
      message: "Verification failed. Please try again.",
    });
  }
};

/**
 * GET /auth/verify-email
 * Email verification endpoint
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    // Find user with this activation token
    const user = await User.findOne({
      where: {
        activationToken: token,
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification token",
      });
    }

    // Check if token is valid and not expired
    if (!user.isActivationTokenValid(token)) {
      return res.status(400).json({
        success: false,
        message: "Verification token has expired. Please request a new one.",
      });
    }

    // Check if user is already activated
    if (user.activated) {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ User already activated, logging them in");
      }

      const authToken = createJWTToken(user);

      return res.status(200).json({
        success: true,
        message: "Account is already activated! You are now logged in.",
        token: authToken,
        user: user.toSafeJSON(),
      });
    }

    // Activate the user
    await user.activate();
    if (process.env.NODE_ENV === "development") {
      console.log("✅ User activated successfully");
    }

    // Get the frontend origin
    const frontendOrigin =
      req.get("origin") || req.get("referer")?.split("/").slice(0, 3).join("/");
    if (process.env.NODE_ENV === "development") {
      console.log("🌐 Frontend origin detected for welcome email");
    }

    // Send welcome email
    await MailsSender.sendWelcomeEmail(
      user.email,
      user.firstName,
      frontendOrigin
    );

    // Create JWT token for automatic login
    const authToken = createJWTToken(user);

    // HIPAA Audit: Log email verification and auto-login
    await AuditService.logLogin(req, {
      id: user.id,
      email: user.email,
      clinicId: user.clinicId,
    });

    res.status(200).json({
      success: true,
      message: "Account activated successfully! You are now logged in.",
      token: authToken,
      user: user.toSafeJSON(),
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Email verification error occurred:", error);
    } else {
      console.error("Email verification error occurred");
    }
    res.status(500).json({
      success: false,
      message: "Verification failed. Please try again.",
    });
  }
};

/**
 * GET /auth/google/login
 * Initiate Google OAuth login
 */
export const googleLogin = (req: Request, res: Response) => {
  const returnUrl = (req.query.returnUrl as string) || "http://localhost:3000";
  const clinicId = (req.query.clinicId as string) || "";

  const googleAuthUrl = buildGoogleAuthUrl(returnUrl, clinicId);

  console.log("🔐 Redirecting to Google OAuth:", googleAuthUrl);
  res.redirect(googleAuthUrl);
};

/**
 * GET /auth/google/callback
 * Handle Google OAuth callback
 */
export const googleCallback = async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!code) {
      return res.status(400).send("Authorization code missing");
    }

    // Decode state to get return URL and clinic ID
    const { returnUrl, clinicId } = JSON.parse(
      Buffer.from(state, "base64").toString()
    );

    // Exchange code for access token
    const accessToken = await exchangeGoogleCode(code);

    // Get user info from Google
    const googleUser = await getGoogleUserInfo(accessToken);

    if (process.env.NODE_ENV === "development") {
      console.log("👤 Google user info received");
    }

    const email = googleUser.email || "";
    const firstName = googleUser.given_name || "";
    const lastName = googleUser.family_name || "";

    if (!email) {
      throw new Error("Email not provided by Google");
    }

    // Check if user exists
    let user = await User.findByEmail(email);

    if (!user) {
      if (process.env.NODE_ENV === "development") {
        console.log("🆕 Creating new user via Google");
      }

      try {
        const randomPassword = Math.random().toString(36).slice(-16) + "Aa1!";
        const passwordHash = await User.hashPassword(randomPassword);

        user = await User.create({
          email: email.toLowerCase().trim(),
          firstName,
          lastName,
          role: "patient",
          activated: true,
          passwordHash,
          clinicId: clinicId || null,
        });

        if (process.env.NODE_ENV === "development") {
          console.log("✅ New user created via Google");
        }
      } catch (createError) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Failed to create user:", createError);
        } else {
          console.error("❌ Failed to create user");
        }
        throw createError;
      }
    } else {
      if (process.env.NODE_ENV === "development") {
        console.log("👤 Existing user found");
      }
    }

    // Load UserRoles for the user
    await user.getUserRoles();

    // SuperAdmin bypass: Skip MFA entirely for superAdmin users
    if (user.userRoles?.superAdmin === true) {
      await user.updateLastLogin();
      const token = createJWTToken(user);

      console.log(
        `🔓 SuperAdmin bypass (Google callback): MFA skipped for user ${user.id}`
      );

      const redirectUrl = `${returnUrl}?googleAuth=success&skipAccount=true&token=${token}&user=${encodeURIComponent(JSON.stringify(user.toSafeJSON()))}`;
      console.log("🔗 Redirecting to:", redirectUrl);
      return res.redirect(redirectUrl);
    }

    // Google OAuth: Skip MFA - Google already provides strong authentication
    await user.updateLastLogin();
    const token = createJWTToken(user);

    if (process.env.NODE_ENV === "development") {
      console.log(`🔓 Google OAuth: MFA skipped for user ${user.id}`);
    }

    // HIPAA Audit: Log successful Google OAuth login
    await AuditService.logLogin(req, {
      id: user.id,
      email: user.email,
      clinicId: user.clinicId,
    });

    // Redirect back to frontend with token
    const redirectUrl = `${returnUrl}?googleAuth=success&skipAccount=true&token=${token}&user=${encodeURIComponent(JSON.stringify(user.toSafeJSON()))}`;
    if (process.env.NODE_ENV === "development") {
      console.log("🔗 Redirecting with token");
    }
    res.redirect(redirectUrl);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Google OAuth callback error:", error);
    } else {
      console.error("❌ Google OAuth callback error occurred");
    }
    const returnUrl = req.query.state
      ? JSON.parse(Buffer.from(req.query.state as string, "base64").toString())
        .returnUrl
      : "http://localhost:3000";
    res.redirect(`${returnUrl}?googleAuth=error`);
  }
};

/**
 * POST /auth/google
 * Google OAuth sign-in (for frontend modal)
 */
export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { credential, clinicId } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
    }

    // Decode Google credential
    const payload = decodeGoogleCredential(credential);
    const email = payload.email;
    const firstName = payload.given_name || "";
    const lastName = payload.family_name || "";

    // Check if user exists
    let user = await User.findByEmail(email);

    if (!user) {
      // Create new user with Google account
      user = await User.createUser({
        email,
        firstName,
        lastName,
        password: Math.random().toString(36).slice(-16) + "Aa1!",
        role: "patient",
      });

      user.activated = true;
      user.clinicId = clinicId || null;
      await user.save();

      if (process.env.NODE_ENV === "development") {
        console.log("✅ New user created via Google");
      }
    }

    // Load UserRoles for the user
    await user.getUserRoles();

    // SuperAdmin bypass
    if (user.userRoles?.superAdmin === true) {
      await user.updateLastLogin();
      const token = createJWTToken(user);

      if (process.env.NODE_ENV === "development") {
        console.log(`🔓 SuperAdmin bypass: MFA skipped for user ${user.id}`);
      }

      return res.status(200).json({
        success: true,
        requiresMfa: false,
        token: token,
        user: user.toSafeJSON(),
        message: "Authentication successful",
      });
    }

    // Google OAuth: Skip MFA
    await user.updateLastLogin();
    const token = createJWTToken(user);

    if (process.env.NODE_ENV === "development") {
      console.log(`🔓 Google OAuth: MFA skipped for user ${user.id}`);
    }

    // HIPAA Audit: Log successful Google OAuth login
    await AuditService.logLogin(req, {
      id: user.id,
      email: user.email,
      clinicId: user.clinicId,
    });

    res.status(200).json({
      success: true,
      requiresMfa: false,
      token: token,
      user: user.toSafeJSON(),
      message: "Authentication successful",
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Google OAuth error:", error);
    } else {
      console.error("❌ Google OAuth error occurred");
    }
    res.status(500).json({
      success: false,
      message: "Google authentication failed. Please try again.",
    });
  }
};

/**
 * POST /auth/signout
 * User sign out
 */
export const signout = async (req: Request, res: Response) => {
  try {
    // HIPAA Audit: Log logout
    await AuditService.logLogout(req);

    res.status(200).json({
      success: true,
      message: "Signed out successfully",
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Sign out error occurred:", error);
    } else {
      console.error("❌ Sign out error occurred");
    }
    res.status(500).json({
      success: false,
      message: "Sign out failed",
    });
  }
};

/**
 * GET /auth/me
 * Get current user
 */
export const getMe = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);

    // Fetch fresh user data from database with UserRoles
    const user = await User.findByPk(currentUser?.id, {
      include: [{ model: UserRoles, as: 'userRoles', required: false }],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Include impersonation fields from JWT if present
    const userData = user.toSafeJSON();
    if (currentUser?.impersonating) {
      userData.impersonating = true;
      userData.impersonatedBy = currentUser.impersonatedBy;
    }

    res.status(200).json({
      success: true,
      user: userData,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Auth check error occurred:", error);
    } else {
      console.error("❌ Auth check error occurred");
    }
    res.status(500).json({
      success: false,
      message: "Auth check failed",
    });
  }
};

/**
 * PUT /auth/profile
 * Update user profile
 */
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const validation = updateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const {
      firstName,
      lastName,
      phoneNumber,
      dob,
      address,
      city,
      state,
      zipCode,
      selectedPlanCategory,
      selectedPlanType,
      selectedPlanName,
      selectedPlanPrice,
      selectedDownpaymentType,
      selectedDownpaymentName,
      selectedDownpaymentPrice,
      planSelectionTimestamp,
    } = validation.data;

    // Check if this is a plan selection request
    const isPlanSelection = selectedPlanCategory && selectedPlanType;

    // Validate required fields for profile updates
    if (!isPlanSelection && (!firstName || !lastName)) {
      return res.status(400).json({
        success: false,
        message: "First name and last name are required for profile updates",
      });
    }

    // Find user in database
    const user = await User.findByPk(currentUser.id, {
      include: [Clinic],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prepare update data
    const updateData: any = {};

    if (firstName && lastName) {
      updateData.firstName = firstName.trim();
      updateData.lastName = lastName.trim();
    }

    if (phoneNumber !== undefined)
      updateData.phoneNumber = phoneNumber?.trim() || null;
    if (dob !== undefined) updateData.dob = dob?.trim() || null;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (city !== undefined) updateData.city = city?.trim() || null;
    if (state !== undefined) updateData.state = state?.trim() || null;
    if (zipCode !== undefined) updateData.zipCode = zipCode?.trim() || null;

    // Update plan selection fields if provided
    if (selectedPlanCategory !== undefined)
      updateData.selectedPlanCategory = selectedPlanCategory?.trim() || null;
    if (selectedPlanType !== undefined)
      updateData.selectedPlanType = selectedPlanType?.trim() || null;
    if (selectedPlanName !== undefined)
      updateData.selectedPlanName = selectedPlanName?.trim() || null;
    if (selectedPlanPrice !== undefined)
      updateData.selectedPlanPrice = selectedPlanPrice || null;
    if (selectedDownpaymentType !== undefined)
      updateData.selectedDownpaymentType =
        selectedDownpaymentType?.trim() || null;
    if (selectedDownpaymentName !== undefined)
      updateData.selectedDownpaymentName =
        selectedDownpaymentName?.trim() || null;
    if (selectedDownpaymentPrice !== undefined)
      updateData.selectedDownpaymentPrice = selectedDownpaymentPrice || null;
    if (planSelectionTimestamp !== undefined)
      updateData.planSelectionTimestamp = planSelectionTimestamp
        ? new Date(planSelectionTimestamp)
        : null;

    // Update user
    await user.update(updateData);

    // HIPAA Audit: Log profile update
    await AuditService.logPatientUpdate(
      req,
      currentUser.id,
      Object.keys(updateData)
    );

    if (process.env.NODE_ENV === "development") {
      console.log("Profile updated for user:", user.id);
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: user.toSafeJSON(),
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("❌ Profile update error occurred:", error);
    } else {
      console.error("❌ Profile update error occurred");
    }
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

