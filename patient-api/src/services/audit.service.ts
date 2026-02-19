import { Request } from 'express';
import AuditLog, { AuditAction, AuditResourceType } from '../models/AuditLog';
import UserRoles from '../models/UserRoles';

/**
 * HIPAA Audit Service
 * 
 * Provides easy-to-use methods for logging PHI access and system events.
 * All logs are stored in the audit_logs table with 6-year retention requirement.
 * 
 * NOTE: SuperAdmin users are NEVER logged for audit purposes.
 * 
 * Usage:
 *   import { AuditService } from '../services/audit.service';
 *   
 *   // In your endpoint:
 *   await AuditService.logFromRequest(req, {
 *     action: AuditAction.VIEW,
 *     resourceType: AuditResourceType.PATIENT,
 *     resourceId: patient.id,
 *   });
 */

interface AuditLogParams {
    action: AuditAction;
    resourceType: AuditResourceType;
    resourceId?: string | null;
    details?: Record<string, any> | null;
    success?: boolean;
    errorMessage?: string | null;
}

interface RequestUser {
    id?: string;
    userId?: string;
    email?: string;
    userEmail?: string;
    clinicId?: string;
}

export class AuditService {
    /**
     * Extract client IP from request (handles proxies)
     */
    static getClientIp(req: Request): string | null {
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            // x-forwarded-for can be a comma-separated list; first is the client
            const ips = typeof forwarded === 'string' ? forwarded : forwarded[0];
            return ips?.split(',')[0]?.trim() || null;
        }
        return req.socket?.remoteAddress || req.ip || null;
    }

    /**
     * Extract user agent from request
     */
    static getUserAgent(req: Request): string | null {
        const ua = req.headers['user-agent'];
        // Truncate to 500 chars to fit DB column
        return ua ? ua.substring(0, 500) : null;
    }

    /**
     * Get user info from request (works with JWT auth)
     */
    static getUserFromRequest(req: Request): RequestUser | null {
        const user = (req as any).user;
        if (!user) return null;
        return {
            id: user.userId || user.id,
            email: user.userEmail || user.email,
            clinicId: user.clinicId,
        };
    }

    /**
     * Check if a user is a superAdmin (excluded from audit logging)
     * SuperAdmin can only be set directly in the database - never via API
     */
    static async isSuperAdmin(userId?: string | null): Promise<boolean> {
        if (!userId) return false;

        try {
            const userRoles = await UserRoles.findOne({ 
                where: { userId }
            });
            return userRoles?.superAdmin === true;
        } catch (error) {
            // If we can't check, assume not superAdmin and continue logging
            return false;
        }
    }

    /**
     * Log an audit event from an Express request
     * Automatically extracts user, IP, and user agent from the request
     */
    static async logFromRequest(
        req: Request,
        params: AuditLogParams
    ): Promise<AuditLog | null> {
        try {
            const user = this.getUserFromRequest(req);

            // Auto-enrich details when request comes from an impersonation session
            const reqUser = (req as any).user;
            let details = params.details || null;
            if (reqUser?.impersonating && reqUser?.impersonatedBy) {
                details = {
                    ...(details || {}),
                    impersonatedBy: reqUser.impersonatedBy,
                    isImpersonationSession: true,
                };
            }

            return await AuditLog.log({
                userId: user?.id || null,
                userEmail: user?.email || null,
                action: params.action,
                resourceType: params.resourceType,
                resourceId: params.resourceId || null,
                ipAddress: this.getClientIp(req),
                userAgent: this.getUserAgent(req),
                details,
                clinicId: user?.clinicId || null,
                success: params.success ?? true,
                errorMessage: params.errorMessage || null,
            });
        } catch (error) {
            // Audit logging should never break the main flow
            console.error('⚠️  Failed to write audit log:', error);
            return null;
        }
    }

    /**
     * Log a manual audit event (when request is not available)
     */
    static async log(params: {
        userId?: string | null;
        userEmail?: string | null;
        action: AuditAction;
        resourceType: AuditResourceType;
        resourceId?: string | null;
        ipAddress?: string | null;
        userAgent?: string | null;
        details?: Record<string, any> | null;
        clinicId?: string | null;
        success?: boolean;
        errorMessage?: string | null;
    }): Promise<AuditLog | null> {
        try {
            // SuperAdmins are never logged — except for impersonation events
            const isImpersonationEvent =
                params.action === AuditAction.IMPERSONATE_START ||
                params.action === AuditAction.IMPERSONATE_END;
            if (!isImpersonationEvent && await this.isSuperAdmin(params.userId)) {
                return null;
            }

            return await AuditLog.log(params);
        } catch (error) {
            console.error('⚠️  Failed to write audit log:', error);
            return null;
        }
    }

    // ============================================
    // Convenience methods for common operations
    // ============================================

    /**
     * Log a successful login
     */
    static async logLogin(req: Request, user: { id: string; email: string; clinicId?: string }): Promise<void> {
        // SuperAdmins are never logged
        if (await this.isSuperAdmin(user.id)) {
            return;
        }

        await AuditLog.log({
            userId: user.id,
            userEmail: user.email,
            action: AuditAction.LOGIN,
            resourceType: AuditResourceType.SESSION,
            ipAddress: this.getClientIp(req),
            userAgent: this.getUserAgent(req),
            clinicId: user.clinicId || null,
            success: true,
        });
    }

    /**
     * Log a failed login attempt
     */
    static async logLoginFailed(req: Request, email: string, reason: string): Promise<void> {
        await AuditLog.log({
            userId: null,
            userEmail: email,
            action: AuditAction.LOGIN_FAILED,
            resourceType: AuditResourceType.SESSION,
            ipAddress: this.getClientIp(req),
            userAgent: this.getUserAgent(req),
            success: false,
            errorMessage: reason,
            details: { attemptedEmail: email },
        });
    }

    /**
     * Log a logout
     */
    static async logLogout(req: Request): Promise<void> {
        await this.logFromRequest(req, {
            action: AuditAction.LOGOUT,
            resourceType: AuditResourceType.SESSION,
        });
    }

    /**
     * Log viewing a patient record (PHI access)
     */
    static async logPatientView(req: Request, patientId: string, details?: Record<string, any>): Promise<void> {
        await this.logFromRequest(req, {
            action: AuditAction.VIEW,
            resourceType: AuditResourceType.PATIENT,
            resourceId: patientId,
            details,
        });
    }

    /**
     * Log updating a patient record (PHI modification)
     */
    static async logPatientUpdate(req: Request, patientId: string, changedFields: string[]): Promise<void> {
        await this.logFromRequest(req, {
            action: AuditAction.UPDATE,
            resourceType: AuditResourceType.PATIENT,
            resourceId: patientId,
            details: { changedFields },
        });
    }

    /**
     * Log viewing an order (contains PHI)
     */
    static async logOrderView(req: Request, orderId: string): Promise<void> {
        await this.logFromRequest(req, {
            action: AuditAction.VIEW,
            resourceType: AuditResourceType.ORDER,
            resourceId: orderId,
        });
    }

    /**
     * Log updating an order
     */
    static async logOrderUpdate(req: Request, orderId: string, action: string): Promise<void> {
        await this.logFromRequest(req, {
            action: AuditAction.UPDATE,
            resourceType: AuditResourceType.ORDER,
            resourceId: orderId,
            details: { orderAction: action },
        });
    }

    /**
     * Log viewing a prescription (PHI)
     */
    static async logPrescriptionView(req: Request, prescriptionId: string): Promise<void> {
        await this.logFromRequest(req, {
            action: AuditAction.VIEW,
            resourceType: AuditResourceType.PRESCRIPTION,
            resourceId: prescriptionId,
        });
    }

    /**
     * Log message/chat access (PHI)
     */
    static async logMessageView(req: Request, chatId: string, patientId?: string): Promise<void> {
        await this.logFromRequest(req, {
            action: AuditAction.VIEW,
            resourceType: AuditResourceType.MESSAGE,
            resourceId: chatId,
            details: patientId ? { patientId } : undefined,
        });
    }

    /**
     * Log sending a message
     */
    static async logMessageSent(req: Request, chatId: string, recipientId: string): Promise<void> {
        await this.logFromRequest(req, {
            action: AuditAction.CREATE,
            resourceType: AuditResourceType.MESSAGE,
            resourceId: chatId,
            details: { recipientId },
        });
    }

    /**
     * Log email sent (for PHI-containing emails)
     */
    static async logEmailSent(req: Request | null, recipientEmail: string, subject: string, userId?: string): Promise<void> {
        if (req) {
            await this.logFromRequest(req, {
                action: AuditAction.EMAIL_SENT,
                resourceType: AuditResourceType.DOCUMENT,
                details: {
                    recipientEmail,
                    subject,
                    // Don't log email body - may contain PHI
                },
            });
        } else {
            await AuditLog.log({
                userId: userId || null,
                action: AuditAction.EMAIL_SENT,
                resourceType: AuditResourceType.DOCUMENT,
                details: { recipientEmail, subject },
                success: true,
            });
        }
    }

    /**
     * Log questionnaire template creation
     */
    static async logTemplateCreate(req: Request, templateId: string, details?: Record<string, any>): Promise<void> {
        await this.logFromRequest(req, {
            action: AuditAction.CREATE,
            resourceType: AuditResourceType.QUESTIONNAIRE_TEMPLATE,
            resourceId: templateId,
            details,
        });
    }

    /**
     * Log questionnaire template update
     */
    static async logTemplateUpdate(req: Request, templateId: string, updatedFields?: string[]): Promise<void> {
        await this.logFromRequest(req, {
            action: AuditAction.UPDATE,
            resourceType: AuditResourceType.QUESTIONNAIRE_TEMPLATE,
            resourceId: templateId,
            details: updatedFields ? { updatedFields } : undefined,
        });
    }

    /**
     * Log questionnaire template deletion
     */
    static async logTemplateDelete(req: Request, templateId: string): Promise<void> {
        await this.logFromRequest(req, {
            action: AuditAction.DELETE,
            resourceType: AuditResourceType.QUESTIONNAIRE_TEMPLATE,
            resourceId: templateId,
        });
    }

    /**
     * Log admin impersonation start
     */
    static async logImpersonateStart(
        req: Request,
        adminId: string,
        targetUserId: string,
        targetUserEmail: string
    ): Promise<void> {
        await this.logFromRequest(req, {
            action: AuditAction.IMPERSONATE_START,
            resourceType: AuditResourceType.USER,
            resourceId: targetUserId,
            details: {
                adminId,
                targetUserId,
                targetUserEmail,
            },
        });
    }

    /**
     * Log admin impersonation end
     */
    static async logImpersonateEnd(
        req: Request,
        adminId: string,
        impersonatedUserId: string
    ): Promise<void> {
        await this.logFromRequest(req, {
            action: AuditAction.IMPERSONATE_END,
            resourceType: AuditResourceType.USER,
            resourceId: impersonatedUserId,
            details: {
                adminId,
                impersonatedUserId,
            },
        });
    }
}

// Export enums for convenience
export { AuditAction, AuditResourceType };

