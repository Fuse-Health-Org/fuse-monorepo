import sgMail from "@sendgrid/mail";

// Initialize SendGrid with API key from environment
const sendgridApiKey = process.env.SENDGRID_API_KEY;
if (!sendgridApiKey) {
  console.error("❌ SENDGRID_API_KEY environment variable is not set");
} else {
  sgMail.setApiKey(sendgridApiKey);
  if (process.env.NODE_ENV === "development") {
    console.log("✅ SendGrid initialized");
  }
}

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class MailsSender {
  private static readonly FROM_EMAIL = "noreply@fusehealth.com";

  /**
   * Send a verification email to activate user account
   */
  static async sendVerificationEmail(
    email: string,
    activationToken: string,
    firstName: string,
    frontendOrigin?: string
  ): Promise<boolean> {
    // Determine the frontend URL based on environment
    const getFrontendUrl = () => {
      // Use provided origin from the request
      if (frontendOrigin) {
        return frontendOrigin;
      }

      if (process.env.FRONTEND_URL) {
        return process.env.FRONTEND_URL;
      }

      // Fallback based on NODE_ENV
      if (process.env.NODE_ENV === "production") {
        return "https://app.fuse.health";
      }

      return "http://localhost:3002";
    };

    const activationUrl = `${getFrontendUrl()}/verify-email?token=${activationToken}`;
    if (process.env.NODE_ENV === "development") {
      console.log("🔗 Activation URL generated for verification email");
    }

    const msg: any = {
      to: email,
      from: this.FROM_EMAIL,
      subject: "Activate Your Fuse Brand Partner Account",
      text: `Hello ${firstName},\n\nWelcome to Fuse! Please activate your brand partner account by clicking the link below:\n\n${activationUrl}\n\nThis link will expire in 24 hours.\n\nBest regards,\nThe Fuse Team`,
      // Disable click tracking to prevent URL rewriting
      trackingSettings: {
        clickTracking: {
          enable: false,
        },
        openTracking: {
          enable: false,
        },
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Fuse!</h1>
          </div>
          
          <div style="padding: 40px 30px; background-color: #f8f9fa;">
            <h2 style="color: #333; margin-top: 0;">Hello ${firstName},</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Thank you for signing up as a brand partner with Fuse. To complete your registration and access your dashboard, please activate your account by clicking the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${activationUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: bold; 
                        display: inline-block;">
                Activate Your Account
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              <strong>Note:</strong> This activation link will expire in 24 hours. If you didn't create an account with us, please ignore this email.
            </p>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <span style="word-break: break-all;">${activationUrl}</span>
              </p>
            </div>
          </div>
          
          <div style="background-color: #333; padding: 20px; text-align: center;">
            <p style="color: #ccc; margin: 0; font-size: 14px;">
              Best regards,<br>
              The Fuse Team
            </p>
          </div>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      console.log("✅ Verification email sent");
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Failed to send verification email:", error);
      } else {
        console.error("❌ Failed to send verification email");
      }

      return false;
    }
  }

  /**
   * Send a general email
   */
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    const msg: any = {
      to: options.to,
      from: this.FROM_EMAIL,
      subject: options.subject,
      trackingSettings: {
        clickTracking: {
          enable: false,
        },
        openTracking: {
          enable: false,
        },
      },
    };

    if (options.text) {
      msg.text = options.text;
    }

    if (options.html) {
      msg.html = options.html;
    }

    try {
      await sgMail.send(msg);
      console.log("✅ Email sent");
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Failed to send email:", error);
      } else {
        console.error("❌ Failed to send email");
      }
      return false;
    }
  }

  /**
   * Send welcome email after successful activation
   */
  static async sendWelcomeEmail(
    email: string,
    firstName: string,
    frontendOrigin?: string
  ): Promise<boolean> {
    // Use same URL logic as verification email
    const getFrontendUrl = () => {
      // Use provided origin from the request (same as verification email)
      if (frontendOrigin) {
        return frontendOrigin;
      }

      if (process.env.FRONTEND_URL) {
        return process.env.FRONTEND_URL;
      }

      if (process.env.NODE_ENV === "production") {
        return "https://app.fuse.health";
      }

      return "http://localhost:3002";
    };

    const frontendUrl = getFrontendUrl();

    const msg: any = {
      to: email,
      from: this.FROM_EMAIL,
      subject: "Welcome to Fuse - Your Account is Active!",
      text: `Hello ${firstName},\n\nYour brand partner account has been successfully activated! You can now access your dashboard and start managing your brand presence.\n\nLogin at: ${frontendUrl}/signin\n\nBest regards,\nThe Fuse Team`,
      // Disable click tracking to prevent URL rewriting
      trackingSettings: {
        clickTracking: {
          enable: false,
        },
        openTracking: {
          enable: false,
        },
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Account Activated!</h1>
          </div>
          
          <div style="padding: 40px 30px; background-color: #f8f9fa;">
            <h2 style="color: #333; margin-top: 0;">Hello ${firstName},</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Congratulations! Your Fuse brand partner account has been successfully activated. You now have full access to your dashboard and can start managing your brand presence.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${frontendUrl}/signin" 
                 style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: bold; 
                        display: inline-block;">
                Access Your Dashboard
              </a>
            </div>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              We're excited to have you as a partner. If you have any questions or need assistance, please don't hesitate to reach out to our support team.
            </p>
          </div>
          
          <div style="background-color: #333; padding: 20px; text-align: center;">
            <p style="color: #ccc; margin: 0; font-size: 14px;">
              Best regards,<br>
              The Fuse Team
            </p>
          </div>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      console.log("✅ Welcome email sent");

      return true;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Failed to send welcome email:", error);
      } else {
        console.error("❌ Failed to send welcome email");
      }
      return false;
    }
  }

  /**
   * Send patient welcome email with temporary password
   */
  static async sendPatientWelcomeEmail(
    email: string,
    firstName: string,
    temporaryPassword: string,
    clinicName?: string
  ): Promise<boolean> {
    const getFrontendUrl = () => {
      if (process.env.PATIENT_PORTAL_URL) {
        return process.env.PATIENT_PORTAL_URL;
      }

      if (process.env.NODE_ENV === "production") {
        return "https://patient.fuse.health";
      }

      return "http://localhost:3002";
    };

    const loginUrl = `${getFrontendUrl()}/login`;
    const clinic = clinicName || "Your Healthcare Provider";

    const msg: any = {
      to: email,
      from: this.FROM_EMAIL,
      subject: `Welcome to ${clinic} Patient Portal`,
      text: `Hello ${firstName},\n\nYour patient account has been created. You can now access your patient portal using the following credentials:\n\nEmail: ${email}\nTemporary Password: ${temporaryPassword}\n\nLogin at: ${loginUrl}\n\nFor your security, we recommend changing your password after your first login.\n\nBest regards,\n${clinic}`,
      // Disable click tracking
      trackingSettings: {
        clickTracking: {
          enable: false,
        },
        openTracking: {
          enable: false, // Track opens for patient engagement, Track closed for HIPAA/SOC2
        },
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Your Patient Portal!</h1>
          </div>
          
          <div style="padding: 40px 30px; background-color: #f8f9fa;">
            <h2 style="color: #333; margin-top: 0;">Hello ${firstName},</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Your patient account with <strong>${clinic}</strong> has been created. You can now access your patient portal to view your health information, manage appointments, and communicate with your care team.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #e5e7eb;">
              <h3 style="margin-top: 0; color: #333;">Your Login Credentials</h3>
              <p style="margin: 10px 0; color: #666;">
                <strong>Email:</strong> ${email}
              </p>
              <p style="margin: 10px 0; color: #666;">
                <strong>Temporary Password:</strong> 
                <span style="background-color: #fef3c7; padding: 4px 8px; border-radius: 4px; font-family: monospace; color: #92400e;">
                  ${temporaryPassword}
                </span>
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" 
                 style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: bold; 
                        display: inline-block;">
                Access Patient Portal
              </a>
            </div>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <p style="color: #92400e; font-size: 14px; margin: 0;">
                <strong>🔒 Security Tip:</strong> For your security, we recommend changing your password after your first login.
              </p>
            </div>
          </div>
          
          <div style="background-color: #333; padding: 20px; text-align: center;">
            <p style="color: #ccc; margin: 0; font-size: 14px;">
              Best regards,<br>
              ${clinic}
            </p>
            <p style="color: #999; margin: 10px 0 0 0; font-size: 12px;">
              If you didn't expect this email, please contact your healthcare provider.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      console.log("✅ Patient welcome email sent");
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Failed to send patient welcome email:", error);
      } else {
        console.error("❌ Failed to send patient welcome email");
      }
      return false;
    }
  }

  /**
   * Send a 6-digit verification code for email sign-in
   */
  static async sendVerificationCode(
    email: string,
    code: string,
    firstName?: string
  ): Promise<boolean> {
    const greeting = firstName ? `Hello ${firstName}` : "Hello";

    const msg: any = {
      to: email,
      from: this.FROM_EMAIL,
      subject: "Your Fuse Verification Code",
      text: `${greeting},\n\nYour verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.\n\nBest regards,\nThe Fuse Team`,
      // Disable click tracking
      trackingSettings: {
        clickTracking: {
          enable: false,
        },
        openTracking: {
          enable: false,
        },
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Verification Code</h1>
          </div>
          
          <div style="padding: 40px 30px; background-color: #f8f9fa;">
            <h2 style="color: #333; margin-top: 0;">${greeting},</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Use this verification code to continue:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background-color: #f3f4f6; 
                          padding: 20px; 
                          border-radius: 12px; 
                          display: inline-block;
                          border: 2px solid #e5e7eb;">
                <span style="font-size: 36px; 
                            font-weight: bold; 
                            letter-spacing: 8px; 
                            color: #667eea;
                            font-family: 'Courier New', monospace;">
                  ${code}
                </span>
              </div>
            </div>
            
            <p style="color: #666; font-size: 14px; text-align: center;">
              <strong>This code will expire in 10 minutes.</strong>
            </p>
            
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
          
          <div style="background-color: #333; padding: 20px; text-align: center;">
            <p style="color: #ccc; margin: 0; font-size: 14px;">
              Best regards,<br>
              The Fuse Team
            </p>
          </div>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      console.log("✅ Verification code sent");
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Failed to send verification code:", error);
      } else {
        console.error("❌ Failed to send verification code");
      }
      return false;
    }
  }

  /**
   * Send a 6-digit MFA verification code for HIPAA-compliant sign-in
   */
  static async sendMfaCode(
    email: string,
    code: string,
    firstName?: string
  ): Promise<boolean> {
    const greeting = firstName ? `Hello ${firstName}` : "Hello";

    const msg: any = {
      to: email,
      from: this.FROM_EMAIL,
      subject: "Your Fuse Sign-In Verification Code",
      text: `${greeting},\n\nYour sign-in verification code is: ${code}\n\nThis code will expire in 5 minutes.\n\nIf you didn't attempt to sign in, please secure your account immediately.\n\nBest regards,\nThe Fuse Team`,
      // Disable click tracking for security
      trackingSettings: {
        clickTracking: {
          enable: false,
        },
        openTracking: {
          enable: false,
        },
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Sign-In Verification</h1>
          </div>
          
          <div style="padding: 40px 30px; background-color: #f8f9fa;">
            <h2 style="color: #333; margin-top: 0;">${greeting},</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Enter this verification code to complete your sign-in:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background-color: #ecfdf5; 
                          padding: 24px 32px; 
                          border-radius: 12px; 
                          display: inline-block;
                          border: 2px solid #10b981;">
                <span style="font-size: 42px; 
                            font-weight: bold; 
                            letter-spacing: 12px; 
                            color: #059669;
                            font-family: 'Courier New', monospace;">
                  ${code}
                </span>
              </div>
            </div>
            
            <p style="color: #666; font-size: 14px; text-align: center;">
              <strong>⏱️ This code will expire in 5 minutes.</strong>
            </p>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 30px; border-left: 4px solid #f59e0b;">
              <p style="color: #92400e; font-size: 14px; margin: 0;">
                <strong>🔒 Security Notice:</strong> If you didn't attempt to sign in, please secure your account immediately by changing your password.
              </p>
            </div>
          </div>
          
          <div style="background-color: #333; padding: 20px; text-align: center;">
            <p style="color: #ccc; margin: 0; font-size: 14px;">
              Best regards,<br>
              The Fuse Team
            </p>
            <p style="color: #999; margin: 10px 0 0 0; font-size: 12px;">
              This is an automated security message for HIPAA compliance.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      console.log("✅ MFA verification code sent");
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Failed to send MFA verification code:", error);
      } else {
        console.error("❌ Failed to send MFA verification code");
      }
      return false;
    }
  }

  /**
   * Send password reset code to user's email
   */
  static async sendPasswordResetCode(
    email: string,
    code: string,
    firstName?: string
  ): Promise<boolean> {
    const greeting = firstName ? `Hello ${firstName}` : "Hello";

    const msg: any = {
      to: email,
      from: this.FROM_EMAIL,
      subject: "Your Fuse Password Reset Code",
      text: `${greeting},\n\nYour password reset code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request a password reset, please ignore this email and your password will remain unchanged.\n\nBest regards,\nThe Fuse Team`,
      // Disable click tracking
      trackingSettings: {
        clickTracking: {
          enable: false,
        },
        openTracking: {
          enable: false,
        },
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset</h1>
          </div>
          
          <div style="padding: 40px 30px; background-color: #f8f9fa;">
            <h2 style="color: #333; margin-top: 0;">${greeting},</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              You requested to reset your password. Use this verification code to continue:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background-color: #f3f4f6; 
                          padding: 20px; 
                          border-radius: 12px; 
                          display: inline-block;
                          border: 2px solid #e5e7eb;">
                <span style="font-size: 36px; 
                            font-weight: bold; 
                            letter-spacing: 8px; 
                            color: #ef4444;
                            font-family: 'Courier New', monospace;">
                  ${code}
                </span>
              </div>
            </div>
            
            <p style="color: #666; font-size: 14px; text-align: center;">
              <strong>This code will expire in 10 minutes.</strong>
            </p>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 30px; border-left: 4px solid #f59e0b;">
              <p style="color: #92400e; font-size: 14px; margin: 0;">
                <strong>🔒 Security Notice:</strong> If you didn't request a password reset, please ignore this email and your password will remain unchanged.
              </p>
            </div>
          </div>
          
          <div style="background-color: #333; padding: 20px; text-align: center;">
            <p style="color: #ccc; margin: 0; font-size: 14px;">
              Best regards,<br>
              The Fuse Team
            </p>
          </div>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      console.log("✅ Password reset code sent");
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Failed to send password reset code:", error);
      } else {
        console.error("❌ Failed to send password reset code");
      }
      return false;
    }
  }

  /**
   * Send email to doctor when they sign up, notifying them their application is under review
   */
  static async sendDoctorApplicationPendingEmail(
    email: string,
    firstName: string
  ): Promise<boolean> {
    const msg: any = {
      to: email,
      from: this.FROM_EMAIL,
      subject: "Doctor Application Received - Under Review",
      text: `Hello ${firstName},\n\nThank you for applying to join the Fuse ecosystem as a healthcare provider.\n\nWe have received your application and it is currently under review. Our team will carefully verify your credentials to ensure the highest level of care for our patients.\n\nOnce your application is approved, you will receive an email granting you access to the Doctor Portal where you can start managing patient care, prescriptions, and consultations.\n\nThis verification process typically takes 24-48 hours. If you have any questions, please don't hesitate to contact our support team.\n\nBest regards,\nThe Fuse Team`,
      trackingSettings: {
        clickTracking: {
          enable: false,
        },
        openTracking: {
          enable: false,
        },
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🏥 Application Received</h1>
          </div>
          
          <div style="padding: 40px 30px; background-color: #f8f9fa;">
            <h2 style="color: #333; margin-top: 0;">Hello ${firstName},</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Thank you for applying to join the <strong>Fuse ecosystem</strong> as a healthcare provider.
            </p>
            
            <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <p style="color: #1e40af; font-size: 15px; margin: 0; line-height: 1.6;">
                <strong>📋 Your Application Status: Under Review</strong><br><br>
                We have received your application and it is currently being reviewed by our team. We carefully verify all doctor credentials to ensure the highest level of care and security for our patients.
              </p>
            </div>
            
            <h3 style="color: #333; margin-top: 30px;">What Happens Next?</h3>
            
            <ul style="color: #666; font-size: 15px; line-height: 1.8;">
              <li><strong>Verification:</strong> Our team will review your credentials and application details</li>
              <li><strong>Timeline:</strong> This process typically takes 24-48 hours</li>
              <li><strong>Approval:</strong> Once approved, you'll receive full access to the Doctor Portal</li>
              <li><strong>Portal Access:</strong> Manage patient care, prescriptions, and consultations</li>
            </ul>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 25px; border-left: 4px solid #f59e0b;">
              <p style="color: #92400e; font-size: 14px; margin: 0;">
                <strong>⚕️ Important:</strong> Only licensed healthcare providers will be approved. Approving someone as a doctor gives them significant permissions within the Fuse ecosystem to prescribe medications, access patient data, and provide medical consultations.
              </p>
            </div>
            
            <p style="color: #666; font-size: 15px; line-height: 1.6; margin-top: 25px;">
              If you have any questions about your application status, please contact our support team.
            </p>
          </div>
          
          <div style="background-color: #333; padding: 20px; text-align: center;">
            <p style="color: #ccc; margin: 0; font-size: 14px;">
              Best regards,<br>
              The Fuse Team
            </p>
            <p style="color: #999; margin: 10px 0 0 0; font-size: 12px;">
              This is an automated message regarding your doctor application.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      console.log("✅ Doctor application pending email sent");
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Failed to send doctor application pending email:", error);
      } else {
        console.error("❌ Failed to send doctor application pending email");
      }
      return false;
    }
  }

  /**
   * Send email to doctor when their application is approved, granting access to the portal
   */
  static async sendDoctorApprovedEmail(
    email: string,
    firstName: string,
    frontendOrigin?: string
  ): Promise<boolean> {
    // Determine the doctor portal URL
    const getDoctorPortalUrl = () => {
      if (process.env.DOCTOR_PORTAL_URL) {
        return process.env.DOCTOR_PORTAL_URL;
      }

      if (process.env.NODE_ENV === "production") {
        return "https://doctor.fuse.health";
      }

      return "http://localhost:3003";
    };

    const portalUrl = frontendOrigin || getDoctorPortalUrl();
    const loginUrl = `${portalUrl}/signin`;

    const msg: any = {
      to: email,
      from: this.FROM_EMAIL,
      subject: "🎉 Doctor Application Approved - Welcome to Fuse!",
      text: `Hello Dr. ${firstName},\n\nCongratulations! Your doctor application has been approved.\n\nYou now have full access to the Fuse Doctor Portal where you can:\n\n• Manage patient consultations and care\n• Review and approve prescriptions\n• Access patient medical histories\n• Communicate securely with patients\n• Coordinate with pharmacies and care teams\n\nAccess your portal here: ${loginUrl}\n\nAs a verified healthcare provider on Fuse, you play a crucial role in delivering high-quality care to our patients. We're excited to have you as part of our medical team.\n\nIf you have any questions or need assistance getting started, our support team is here to help.\n\nBest regards,\nThe Fuse Team`,
      trackingSettings: {
        clickTracking: {
          enable: false,
        },
        openTracking: {
          enable: false,
        },
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 32px;">🎉 Welcome to Fuse!</h1>
            <p style="color: #d1fae5; margin: 10px 0 0 0; font-size: 16px;">Your Doctor Application has been Approved</p>
          </div>
          
          <div style="padding: 40px 30px; background-color: #f8f9fa;">
            <h2 style="color: #333; margin-top: 0;">Hello Dr. ${firstName},</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Congratulations! Your doctor application has been <strong style="color: #10b981;">approved</strong>. You now have full access to the Fuse Doctor Portal.
            </p>
            
            <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #10b981;">
              <p style="color: #065f46; font-size: 15px; margin: 0; line-height: 1.6;">
                <strong>✅ You're all set!</strong><br><br>
                As a verified healthcare provider, you can now access all features of the Doctor Portal and begin providing care to patients.
              </p>
            </div>
            
            <h3 style="color: #333; margin-top: 30px;">What You Can Do Now:</h3>
            
            <ul style="color: #666; font-size: 15px; line-height: 1.8;">
              <li><strong>Patient Care:</strong> Manage consultations and patient relationships</li>
              <li><strong>Prescriptions:</strong> Review, approve, and manage prescriptions</li>
              <li><strong>Medical Records:</strong> Securely access patient medical histories</li>
              <li><strong>Communication:</strong> Connect with patients through secure messaging</li>
              <li><strong>Coordination:</strong> Work seamlessly with pharmacies and care teams</li>
            </ul>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${loginUrl}" 
                 style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                        color: white; 
                        padding: 16px 36px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: bold; 
                        font-size: 16px;
                        display: inline-block;
                        box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">
                🏥 Access Doctor Portal
              </a>
            </div>
            
            <div style="background-color: #e0f2fe; padding: 15px; border-radius: 8px; margin-top: 25px; border-left: 4px solid #0284c7;">
              <p style="color: #075985; font-size: 14px; margin: 0;">
                <strong>🔐 Security & Compliance:</strong> As a healthcare provider on Fuse, you have access to protected health information (PHI). Please ensure you follow all HIPAA guidelines and security best practices when using the platform.
              </p>
            </div>
            
            <p style="color: #666; font-size: 15px; line-height: 1.6; margin-top: 25px;">
              We're excited to have you as part of the Fuse medical team. If you need any assistance getting started or have questions, our support team is here to help.
            </p>
          </div>
          
          <div style="background-color: #333; padding: 20px; text-align: center;">
            <p style="color: #ccc; margin: 0; font-size: 14px;">
              Best regards,<br>
              The Fuse Team
            </p>
            <p style="color: #999; margin: 10px 0 0 0; font-size: 12px;">
              You're receiving this email because your doctor application was approved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      console.log("✅ Doctor approved email sent");
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Failed to send doctor approved email:", error);
      } else {
        console.error("❌ Failed to send doctor approved email");
      }
      return false;
    }
  }
}
