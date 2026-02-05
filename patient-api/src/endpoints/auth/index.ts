import { Express } from "express";
import {
    AuditService,
    AuditAction,
    AuditResourceType,
} from "../../services/audit.service";
import Clinic, { PatientPortalDashboardFormat } from "../../models/Clinic";
import BrandInvitation, { InvitationType } from "../../models/BrandInvitation";
import {
    createJWTToken,
    getCurrentUser,
} from "../../config/jwt";
import CustomWebsite from "../../models/CustomWebsite";
import MfaToken from "../../models/MfaToken";
import User from "../../models/User";
import UserRoles from "../../models/UserRoles";
import { MailsSender } from "../../services/mailsSender";
import {
    signInSchema,
    signUpSchema,
    forgotPasswordSchema,
    resetPasswordWithCodeSchema,
    updateProfileSchema,
} from "@fuse/validators";

export function registerAuthEndpoints(
    app: Express,
    authenticateJWT: any,
    verificationCodes: Map<string, { code: string; expiresAt: number; firstName?: string }>,
    passwordResetCodes: Map<string, { code: string; expiresAt: number; firstName?: string; verified: boolean }>,
    generateUniqueSlug: (clinicName: string, excludeId?: string) => Promise<string>,
    getDefaultCustomWebsiteValues: (clinicId: string) => any,
    authLimiter?: any
) {

    // MFA Verify endpoint - verify OTP code and issue JWT token
    app.post("/auth/mfa/verify", authLimiter, async (req, res) => {
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
                // HIPAA Audit: Log rate limit
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
                // Increment failed attempts
                mfaRecord.failedAttempts += 1;
                await mfaRecord.save();

                // HIPAA Audit: Log failed MFA attempt
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

            // Check if doctor is approved - ONLY when logging into the Doctor Portal
            const portalContext = req.headers['x-portal-context'];
            const isDoctorPortal = portalContext === 'doctor';
            
            if (isDoctorPortal && user.hasAnyRoleSync(["doctor"]) && !user.isApprovedDoctor) {
                await mfaRecord.destroy();
                return res.status(403).json({
                    success: false,
                    message:
                        "Your doctor application is currently under review. You will receive an email once your account is approved and you can access the Doctor Portal.",
                    pendingApproval: true,
                });
            }

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

            // HIPAA Audit: Log successful login (after MFA)
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
            // HIPAA: Do not log detailed errors in production
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
    });

    // MFA Resend endpoint - resend OTP code
    app.post("/auth/mfa/resend", authLimiter, async (req, res) => {
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
            mfaRecord.failedAttempts = 0; // Reset failed attempts on resend
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
            // HIPAA: Do not log detailed errors in production
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
    });

    // Send verification code to email
    app.post("/auth/send-verification-code", async (req, res) => {
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
            const code = Math.floor(100000 + Math.random() * 900000).toString();

            // Store code with 10-minute expiration
            const expiresAt = Date.now() + 10 * 60 * 1000;

            // Check if user exists to personalize email
            let firstName: string | undefined;
            try {
                const existingUser = await User.findByEmail(email);
                if (existingUser) {
                    firstName = existingUser.firstName;
                }
            } catch (error) {
                // Continue even if user lookup fails
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
    });

    // Verify code and sign in
    app.post("/auth/verify-code", async (req, res) => {
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
                // User exists - sign them in

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
    });

    // Forgot password - send reset code
    app.post("/auth/forgot-password", authLimiter, async (req, res) => {
        try {
            const validation = forgotPasswordSchema.safeParse(req.body);

            if (!validation.success) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: validation.error.format(),
                });
            }

            const { email } = validation.data;

            // Find user by email
            const user = await User.findByEmail(email);

            // For security, don't reveal if user exists or not
            // Always return success message, but only send email if user exists
            if (user) {
                // Check if user is activated
                if (!user.activated) {
                    return res.status(200).json({
                        success: true,
                        message: "If an account exists with this email, a reset code has been sent.",
                    });
                }

                // Generate 6-digit code
                const code = Math.floor(100000 + Math.random() * 900000).toString();

                // Store code with 10-minute expiration
                const expiresAt = Date.now() + 10 * 60 * 1000;

                passwordResetCodes.set(email.toLowerCase(), {
                    code,
                    expiresAt,
                    firstName: user.firstName,
                    verified: false,
                });

                // Send email with code
                const emailSent = await MailsSender.sendPasswordResetCode(
                    email,
                    code,
                    user.firstName
                );

                if (!emailSent) {
                    return res.status(500).json({
                        success: false,
                        message: "Failed to send reset code. Please try again.",
                    });
                }

                // HIPAA Audit: Log password reset request
                await AuditService.log({
                    userId: user.id,
                    userEmail: user.email,
                    action: AuditAction.PASSWORD_RESET,
                    resourceType: AuditResourceType.USER,
                    resourceId: user.id,
                    ipAddress: AuditService.getClientIp(req),
                    userAgent: req.headers["user-agent"],
                    details: { email: user.email },
                });

                if (process.env.NODE_ENV === "development") {
                    console.log("✅ Password reset code sent");
                }
            }

            // Always return success for security (don't reveal if user exists)
            res.status(200).json({
                success: true,
                message: "If an account exists with this email, a reset code has been sent.",
            });
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("❌ Forgot password error:", error);
            } else {
                console.error("❌ Forgot password error");
            }
            res.status(500).json({
                success: false,
                message: "Failed to process password reset request. Please try again.",
            });
        }
    });

    // Verify reset code
    app.post("/auth/verify-reset-code", authLimiter, async (req, res) => {
        try {
            const { email, code } = req.body;

            if (!email || !code) {
                return res.status(400).json({
                    success: false,
                    message: "Email and code are required",
                });
            }

            // Get stored code
            const storedData = passwordResetCodes.get(email.toLowerCase());

            if (!storedData) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired reset code",
                });
            }

            // Check if code is expired
            if (storedData.expiresAt < Date.now()) {
                passwordResetCodes.delete(email.toLowerCase());
                return res.status(401).json({
                    success: false,
                    message: "Reset code has expired. Please request a new one.",
                });
            }

            // Verify code
            if (storedData.code !== code.trim()) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid reset code",
                });
            }

            // Mark code as verified
            storedData.verified = true;
            passwordResetCodes.set(email.toLowerCase(), storedData);

            if (process.env.NODE_ENV === "development") {
                console.log("✅ Password reset code verified");
            }

            res.status(200).json({
                success: true,
                message: "Code verified successfully",
            });
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("❌ Verify reset code error:", error);
            } else {
                console.error("❌ Verify reset code error");
            }
            res.status(500).json({
                success: false,
                message: "Verification failed. Please try again.",
            });
        }
    });

    // Reset password with verified code
    app.post("/auth/reset-password", authLimiter, async (req, res) => {
        try {
            const validation = resetPasswordWithCodeSchema.safeParse(req.body);

            if (!validation.success) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: validation.error.format(),
                });
            }

            const { email, code, password } = validation.data;

            // Get stored code
            const storedData = passwordResetCodes.get(email.toLowerCase());

            if (!storedData) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired reset code",
                });
            }

            // Check if code is expired
            if (storedData.expiresAt < Date.now()) {
                passwordResetCodes.delete(email.toLowerCase());
                return res.status(401).json({
                    success: false,
                    message: "Reset code has expired. Please request a new one.",
                });
            }

            // Verify code matches
            if (storedData.code !== code.trim()) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid reset code",
                });
            }

            // Check if code was verified
            if (!storedData.verified) {
                return res.status(401).json({
                    success: false,
                    message: "Code must be verified first",
                });
            }

            // Find user
            const user = await User.findByEmail(email);
            if (!user) {
                // For security, don't reveal if user exists
                passwordResetCodes.delete(email.toLowerCase());
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired reset code",
                });
            }

            // Hash new password
            const passwordHash = await User.hashPassword(password);

            // Update user password
            await user.update({
                passwordHash,
                temporaryPasswordHash: null, // Clear temporary password if exists
            });

            // Delete used code
            passwordResetCodes.delete(email.toLowerCase());

            // HIPAA Audit: Log password reset completion
            await AuditService.log({
                userId: user.id,
                userEmail: user.email,
                action: AuditAction.PASSWORD_RESET,
                resourceType: AuditResourceType.USER,
                resourceId: user.id,
                ipAddress: AuditService.getClientIp(req),
                userAgent: req.headers["user-agent"],
                details: { email: user.email, passwordReset: true },
            });

            if (process.env.NODE_ENV === "development") {
                console.log("✅ Password reset successfully");
            }

            res.status(200).json({
                success: true,
                message: "Password reset successfully",
            });
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("❌ Reset password error:", error);
            } else {
                console.error("❌ Reset password error");
            }
            res.status(500).json({
                success: false,
                message: "Failed to reset password. Please try again.",
            });
        }
    });

    // Email verification endpoint
    app.get("/auth/verify-email", async (req, res) => {
        try {
            const { token } = req.query;

            if (!token || typeof token !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Verification token is required",
                });
            }

            // Find user with this activation token and load roles
            const user = await User.findOne({
                where: {
                    activationToken: token,
                },
                include: [{ model: UserRoles, as: "userRoles" }],
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

                // Create JWT token for automatic login
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

            // Get the frontend origin from the request (same logic as verification email)
            const frontendOrigin =
                req.get("origin") || req.get("referer")?.split("/").slice(0, 3).join("/");
            if (process.env.NODE_ENV === "development") {
                console.log("🌐 Frontend origin detected for welcome email");
            }

            // Doctors should verify email but NOT auto-login (need approval first)
            // This only applies when verifying from the Doctor Portal
            const portalContext = req.headers['x-portal-context'];
            const isDoctorPortal = portalContext === 'doctor';
            
            if (isDoctorPortal && user.hasAnyRoleSync(["doctor"]) && !user.isApprovedDoctor) {
                if (process.env.NODE_ENV === "development") {
                    console.log("✅ Doctor email verified - awaiting approval, NOT logging in");
                }
                
                return res.status(200).json({
                    success: true,
                    message: "Email verified successfully! Your application is now under review. You will be notified via email once approved and can then sign in.",
                    requiresApproval: true,
                });
            }

            // Send welcome email (skip for doctors on doctor portal as they already got pending review email)
            await MailsSender.sendWelcomeEmail(
                user.email,
                user.firstName,
                frontendOrigin
            );

            // Create JWT token for automatic login (non-doctor users only)
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
    });

    // Resend verification email endpoint
    app.post("/auth/resend-verification", async (req, res) => {
        try {
            const { email } = req.body;

            if (!email || typeof email !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Email is required",
                });
            }

            // Find user by email
            const user = await User.findOne({
                where: {
                    email: email.toLowerCase().trim(),
                },
            });

            if (!user) {
                // For security, don't reveal if email exists
                return res.status(200).json({
                    success: true,
                    message: "If an account exists with this email, a verification email will be sent.",
                });
            }

            // Check if user is already activated
            if (user.activated) {
                return res.status(200).json({
                    success: true,
                    message: "This account is already verified. You can sign in.",
                });
            }

            // Generate new activation token
            const activationToken = user.generateActivationToken();
            await user.save();

            // Get frontend origin from request
            const frontendOrigin =
                req.get("origin") || req.get("referer")?.split("/").slice(0, 3).join("/");

            // Send verification email
            const emailSent = await MailsSender.sendVerificationEmail(
                user.email,
                activationToken,
                user.firstName,
                frontendOrigin
            );

            if (emailSent) {
                console.log("✅ Verification email resent to:", email);
            } else {
                console.error("❌ Failed to resend verification email to:", email);
            }

            res.status(200).json({
                success: true,
                message: "If an account exists with this email, a verification email will be sent.",
            });
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.error("Resend verification error:", error);
            } else {
                console.error("Resend verification error occurred");
            }
            res.status(500).json({
                success: false,
                message: "Failed to send verification email. Please try again.",
            });
        }
    });

    app.post("/auth/signout", authenticateJWT, async (req, res) => {
        try {
            // HIPAA Audit: Log logout
            await AuditService.logLogout(req);

            // With JWT, signout is handled client-side by removing the token
            // No server-side session to destroy
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
    });

    app.get("/auth/me", authenticateJWT, async (req, res) => {
        try {
            // Get user data from JWT
            const currentUser = getCurrentUser(req);

            // Fetch fresh user data from database with UserRoles
            const user = await User.findByPk(currentUser?.id, {
                include: [{ model: UserRoles, as: 'userRoles', required: false }],
            });
            if (!user) {
                // User was deleted from database but JWT token still exists
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

            // Include clinic details for affiliates to check if onboarding is needed
            if (user.clinicId && user.userRoles?.affiliate) {
                const clinic = await Clinic.findByPk(user.clinicId, {
                    attributes: ['id', 'name', 'slug', 'isActive', 'affiliateOwnerClinicId'],
                });
                if (clinic) {
                    userData.clinic = {
                        id: clinic.id,
                        name: clinic.name,
                        slug: clinic.slug,
                        isActive: clinic.isActive,
                    };

                    // Include parent clinic slug and custom domain for affiliates
                    if (clinic.affiliateOwnerClinicId) {
                        const parentClinic = await Clinic.findByPk(clinic.affiliateOwnerClinicId, {
                            attributes: ['id', 'slug', 'customDomain', 'isCustomDomain'],
                        });
                        if (parentClinic) {
                            userData.clinic.parentClinicSlug = parentClinic.slug;
                            if (parentClinic.isCustomDomain && parentClinic.customDomain) {
                                userData.clinic.parentClinicCustomDomain = parentClinic.customDomain;
                            }
                        }
                    }
                }
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
    });

    // User profile update endpoint
    app.put("/auth/profile", authenticateJWT, async (req, res) => {
        try {
            const currentUser = getCurrentUser(req);
            if (!currentUser) {
                return res.status(401).json({
                    success: false,
                    message: "Not authenticated",
                });
            }

            // Validate request body using updateProfileSchema
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

            // Check if this is a plan selection request (doesn't require firstName/lastName)
            const isPlanSelection = selectedPlanCategory && selectedPlanType;

            // HIPAA Compliance: Validate required fields for profile updates
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

            // Prepare update data based on what's being updated
            const updateData: any = {};

            // Update profile fields if provided
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

            // Update user with the prepared data
            await user.update(updateData);

            // HIPAA Audit: Log profile update (PHI modification)
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
    });

    // Auth routes
    app.post("/auth/signup", authLimiter, async (req, res) => {
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
                dob,
                gender,
                phoneNumber,
                clinicName,
                clinicId,
                website,
                businessType,
                npiNumber,
                patientPortalDashboardFormat,
                invitationSlug,
            } = validation.data;

            // Extract doctorLicenseStatesCoverage separately to avoid TypeScript issues
            const doctorLicenseStatesCoverage = (validation.data as any).doctorLicenseStatesCoverage;

            // Validate required fields for doctor role
            if (role === "doctor") {
                if (!npiNumber || npiNumber.trim() === "") {
                    return res.status(400).json({
                        success: false,
                        message: "NPI number is required for doctor accounts",
                    });
                }

                if (!doctorLicenseStatesCoverage || !Array.isArray(doctorLicenseStatesCoverage) || doctorLicenseStatesCoverage.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: "At least one licensed state is required for doctor accounts. Please select the states where you hold an active medical license.",
                    });
                }

                // Validate NPI number format (must be exactly 10 digits)
                if (!/^\d{10}$/.test(npiNumber.trim())) {
                    return res.status(400).json({
                        success: false,
                        message: "NPI number must be exactly 10 digits",
                    });
                }
            }

            // Handle brand invitation if provided
            let brandInvitation: BrandInvitation | null = null;
            let isFixedMDILink = false;

            if (invitationSlug && role === "brand") {
                // Fixed MDI link - no need to check database
                if (invitationSlug === "mdi") {
                    isFixedMDILink = true;
                } else {
                    // Doctor invitation - check database
                    brandInvitation = await BrandInvitation.findOne({
                        where: { invitationSlug },
                        include: [
                            {
                                model: Clinic,
                                as: "doctorClinic",
                                required: false,
                            },
                        ],
                    });

                    if (brandInvitation) {
                        // Validate invitation is active and not expired
                        if (!brandInvitation.isActive) {
                            return res.status(410).json({
                                success: false,
                                message: "This invitation link is no longer active",
                            });
                        }

                        if (brandInvitation.expiresAt && new Date() > brandInvitation.expiresAt) {
                            return res.status(410).json({
                                success: false,
                                message: "This invitation link has expired",
                            });
                        }
                    } else {
                        return res.status(404).json({
                            success: false,
                            message: "Invalid invitation link",
                        });
                    }
                }
            }

            // Validate clinic name for providers/brands (both require clinics)
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
            let finalClinicId = clinicId; // Use provided clinicId from request body

            // Create clinic if user is a healthcare provider and no clinicId provided
            if ((role === "provider" || role === "brand") && clinicName && !clinicId) {
                if (process.env.NODE_ENV === "development") {
                    console.log("🏥 Creating clinic");
                }

                // Generate unique slug
                const slug = await generateUniqueSlug(clinicName.trim());

                // Determine dashboard format based on invitation or default
                let dashboardFormat: PatientPortalDashboardFormat;
                if (isFixedMDILink) {
                    // Fixed MDI link - always use MD_INTEGRATIONS
                    dashboardFormat = PatientPortalDashboardFormat.MD_INTEGRATIONS;
                } else if (brandInvitation) {
                    // Use format from invitation (doctor invitation)
                    dashboardFormat = brandInvitation.patientPortalDashboardFormat;
                } else {
                    // For brand signup, default to MD_INTEGRATIONS format
                    // (can be changed later in Tenant Management portal if needed)
                    dashboardFormat =
                        patientPortalDashboardFormat === 'fuse'
                            ? PatientPortalDashboardFormat.FUSE
                            : PatientPortalDashboardFormat.MD_INTEGRATIONS;
                }

                clinic = await Clinic.create({
                    name: clinicName.trim(),
                    slug: slug,
                    logo: "", // Default empty logo, can be updated later
                    businessType: businessType || null,
                    patientPortalDashboardFormat: dashboardFormat,
                    // If this is a brand invitation from a doctor, set referrer doctor (but not the clinic relationship)
                    referrerDoctorId: brandInvitation?.invitationType === InvitationType.DOCTOR
                        ? brandInvitation.doctorId
                        : undefined,
                });

                // Note: Global form structures are created at database initialization (ensureDefaultFormStructures)

                finalClinicId = clinic.id;
                if (process.env.NODE_ENV === "development") {
                    console.log("✅ Clinic created successfully with ID:", clinic.id);
                }

                // Create default CustomWebsite for the new clinic
                try {
                    await CustomWebsite.create(getDefaultCustomWebsiteValues(clinic.id));
                    if (process.env.NODE_ENV === "development") {
                        console.log("✅ CustomWebsite created for clinic:", clinic.id);
                    }
                } catch (customWebsiteError) {
                    // Log but don't fail signup if CustomWebsite creation fails
                    console.error("⚠️ Failed to create CustomWebsite for clinic:", clinic.id, customWebsiteError);
                }

                if (process.env.NODE_ENV === "development") {
                    console.log("🚀 Creating new user");
                }
            } else if (clinicId) {
                if (process.env.NODE_ENV === "development") {
                    console.log("🔗 Associating user with existing clinic ID:", clinicId);
                }
            }

            // Map frontend role to backend role
            let mappedRole: "patient" | "doctor" | "admin" | "brand" = "patient"; // default
            if (role === "provider" || role === "doctor") {
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
                dob: dob || dateOfBirth, // Support both dob and dateOfBirth
                gender: gender ? String(gender).toLowerCase() : undefined,
                phoneNumber,
                website,
                businessType,
            });

            // Set NPI number and license coverage for doctors if provided
            if (mappedRole === "doctor") {
                if (npiNumber) {
                    user.npiNumber = npiNumber;
                }
                if (doctorLicenseStatesCoverage && Array.isArray(doctorLicenseStatesCoverage)) {
                    user.doctorLicenseStatesCoverage = doctorLicenseStatesCoverage;
                }
                await user.save();
            }

            const isDevelopment = process.env.NODE_ENV === "development";

            // Auto-activate non-doctor users in development mode
            // Doctors must verify their email regardless of environment
            if (isDevelopment && mappedRole !== "doctor") {
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

            // Update invitation usage count if invitation was used (only for doctor invitations, not fixed MDI link)
            if (brandInvitation && role === "brand" && !isFixedMDILink) {
                brandInvitation.usageCount += 1;
                await brandInvitation.save();
                if (process.env.NODE_ENV === "development") {
                    console.log("✅ Brand invitation usage count updated:", brandInvitation.usageCount);
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

            // Get the frontend origin from the request to send the verification link to the correct portal
            const frontendOrigin =
                req.get("origin") || req.get("referer")?.split("/").slice(0, 3).join("/");
            if (process.env.NODE_ENV === "development") {
                console.log("🌐 Frontend origin detected");
            }

            // Send different emails based on role
            let emailSent = false;
            if (mappedRole === "doctor") {
                // Doctors get BOTH verification email and pending review email
                // 1. Send verification email first
                const verificationEmailSent = await MailsSender.sendVerificationEmail(
                    user.email,
                    activationToken,
                    user.firstName,
                    frontendOrigin
                );
                if (verificationEmailSent) {
                    console.log("📧 Doctor verification email sent successfully");
                } else {
                    console.log("❌ Failed to send doctor verification email, but user was created");
                }
                
                // 2. Send pending review email
                const pendingEmailSent = await MailsSender.sendDoctorApplicationPendingEmail(
                    user.email,
                    user.firstName
                );
                if (pendingEmailSent) {
                    console.log("📧 Doctor application pending email sent successfully");
                } else {
                    console.log("❌ Failed to send doctor application pending email, but user was created");
                }
                
                emailSent = verificationEmailSent || pendingEmailSent;
            } else {
                // Other roles get standard verification email
                emailSent = await MailsSender.sendVerificationEmail(
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

            const successMessage = mappedRole === "doctor"
                ? "Doctor account created successfully! Please check your email to verify your account. Once verified, your application will be reviewed by our team."
                : "User registered successfully. Please check your email to activate your account.";

            res.status(201).json({
                success: true,
                message: successMessage,
                user: user.toSafeJSON(), // Return safe user data
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
    });

    // Google OAuth - Initiate login
    app.get("/auth/google/login", (req, res) => {
        const returnUrl = (req.query.returnUrl as string) || "http://localhost:3000";
        const clinicId = (req.query.clinicId as string) || "";

        // Store return URL and clinic ID in state parameter
        const state = Buffer.from(JSON.stringify({ returnUrl, clinicId })).toString(
            "base64"
        );

        const googleAuthUrl =
            `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}` +
            `&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/auth/google/callback")}` +
            `&response_type=code` +
            `&scope=email%20profile` +
            `&state=${state}`;

        console.log("🔐 Redirecting to Google OAuth:", googleAuthUrl);
        res.redirect(googleAuthUrl);
    });

    // Google OAuth - Handle callback
    app.get("/auth/google/callback", async (req, res) => {
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
            const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    code,
                    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                    redirect_uri:
                        process.env.GOOGLE_REDIRECT_URI ||
                        "http://localhost:3001/auth/google/callback",
                    grant_type: "authorization_code",
                }),
            });

            const tokenData = (await tokenResponse.json()) as {
                access_token?: string;
                error?: string;
            };

            if (!tokenData.access_token) {
                throw new Error("Failed to get access token");
            }

            // Get user info from Google
            const userInfoResponse = await fetch(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` },
                }
            );

            const googleUser = (await userInfoResponse.json()) as {
                email?: string;
                given_name?: string;
                family_name?: string;
            };

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

                // Create new user with Google account
                try {
                    // Generate a random password and hash it
                    const randomPassword = Math.random().toString(36).slice(-16) + "Aa1!";
                    const passwordHash = await User.hashPassword(randomPassword);

                    user = await User.create({
                        email: email.toLowerCase().trim(),
                        firstName,
                        lastName,
                        role: "patient",
                        activated: true, // Google accounts are pre-verified
                        passwordHash, // Pass the hashed password
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
                // Update last login time
                await user.updateLastLogin();

                // Create JWT token
                const token = createJWTToken(user);

                console.log(
                    `🔓 SuperAdmin bypass (Google callback): MFA skipped for user ${user.id}`
                );

                // Redirect back to frontend with token
                const redirectUrl = `${returnUrl}?googleAuth=success&skipAccount=true&token=${token}&user=${encodeURIComponent(JSON.stringify(user.toSafeJSON()))}`;
                console.log("🔗 Redirecting to:", redirectUrl);
                return res.redirect(redirectUrl);
            }

            // Google OAuth: Skip MFA - Google already provides strong authentication
            // Update last login time
            await user.updateLastLogin();

            // Create JWT token
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
            // HIPAA: Do not log detailed error information in production
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
    });

    // Google OAuth sign-in (kept for backward compatibility with frontend modal)
    app.post("/auth/google", authLimiter, async (req, res) => {
        try {
            const { credential, clinicId } = req.body;

            if (!credential) {
                return res.status(400).json({
                    success: false,
                    message: "Google credential is required",
                });
            }

            // Verify Google token (you'll need to add google-auth-library)
            // For now, decode the JWT to get user info
            const base64Url = credential.split(".")[1];
            const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
            const jsonPayload = decodeURIComponent(
                Buffer.from(base64, "base64")
                    .toString()
                    .split("")
                    .map(function (c) {
                        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
                    })
                    .join("")
            );

            const payload = JSON.parse(jsonPayload);
            const email = payload.email;
            const firstName = payload.given_name || "";
            const lastName = payload.family_name || "";

            // Check if user exists
            let user = await User.findByEmail(email);

            if (!user) {
                // Create new user with Google account using createUser to automatically create UserRoles
                user = await User.createUser({
                    email,
                    firstName,
                    lastName,
                    password: Math.random().toString(36).slice(-16) + "Aa1!", // Random password (won't be used)
                    role: "patient",
                });

                // Set additional fields
                user.activated = true; // Google accounts are pre-verified
                user.clinicId = clinicId || null;
                await user.save();

                if (process.env.NODE_ENV === "development") {
                    console.log("✅ New user created via Google");
                }
            }

            // Load UserRoles for the user
            await user.getUserRoles();

            // SuperAdmin bypass: Skip MFA entirely for superAdmin users
            if (user.userRoles?.superAdmin === true) {
                // Update last login time
                await user.updateLastLogin();

                // Create JWT token directly
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

            // Google OAuth: Skip MFA - Google already provides strong authentication
            // Update last login time
            await user.updateLastLogin();

            // Create JWT token directly
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

            // Return success with token
            res.status(200).json({
                success: true,
                requiresMfa: false,
                token: token,
                user: user.toSafeJSON(),
                message: "Authentication successful",
            });
        } catch (error) {
            // HIPAA: Do not log detailed errors in production
            if (process.env.NODE_ENV === "development") {
                console.error("❌ Google authentication error:", error);
            } else {
                console.error("❌ Google authentication error");
            }
            res.status(500).json({
                success: false,
                message: "Google authentication failed. Please try again.",
            });
        }
    });

    app.post("/auth/signin", authLimiter, async (req, res) => {
        try {
            // Validate request body
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
                // HIPAA Audit: Log failed login attempt (user not found)
                await AuditService.logLoginFailed(req, email, "User not found");
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password",
                });
            }

            // Load UserRoles for the user
            await user.getUserRoles();

            // Validate password (permanent or temporary)
            const isValidPassword = await user.validateAnyPassword(password);
            if (!isValidPassword) {
                // HIPAA Audit: Log failed login attempt (wrong password)
                await AuditService.logLoginFailed(req, email, "Invalid password");
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password",
                });
            }

            // Check if user account is activated
            if (!user.activated) {
                // HIPAA Audit: Log failed login attempt (not activated)
                await AuditService.logLoginFailed(req, email, "Account not activated");
                return res.status(401).json({
                    success: false,
                    message:
                        "Please check your email and activate your account before signing in.",
                    needsActivation: true,
                });
            }

            // Check if doctor is approved - ONLY when logging into the Doctor Portal
            // Use X-Portal-Context header to identify the portal
            const portalContext = req.headers['x-portal-context'];
            const isDoctorPortal = portalContext === 'doctor';
            
            if (isDoctorPortal && user.hasAnyRoleSync(["doctor"]) && !user.isApprovedDoctor) {
                // HIPAA Audit: Log failed login attempt (doctor not approved)
                await AuditService.logLoginFailed(req, email, "Doctor account pending approval");
                return res.status(403).json({
                    success: false,
                    message:
                        "Your doctor application is currently under review. You will receive an email once your account is approved and you can access the Doctor Portal.",
                    pendingApproval: true,
                });
            }

            // SuperAdmin bypass: Skip MFA entirely for superAdmin users
            if (user.userRoles?.superAdmin === true) {
                // Update last login time
                await user.updateLastLogin();

                // Create JWT token directly
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

            // HIPAA MFA: Generate OTP code and require verification
            const otpCode = MfaToken.generateCode();
            const mfaSessionToken = MfaToken.generateMfaToken();
            const expiresAt = MfaToken.getExpirationTime();

            // Delete any existing MFA tokens for this user (cleanup)
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

            // Return MFA required response (don't give JWT yet)
            res.status(200).json({
                success: true,
                requiresMfa: true,
                mfaToken: mfaSessionToken,
                message: "Verification code sent to your email",
            });
        } catch (error: any) {
            // Temporarily log detailed error for debugging
            console.error("❌ Authentication error occurred:", {
                message: error?.message,
                name: error?.name,
                stack: error?.stack?.split('\n').slice(0, 5).join('\n'),
            });
            res.status(500).json({
                success: false,
                message: "Authentication failed. Please try again.",
            });
        }
    });
}