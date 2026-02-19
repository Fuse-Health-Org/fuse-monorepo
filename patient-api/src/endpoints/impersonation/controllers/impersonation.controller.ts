import { Request, Response } from 'express';
import User from '../../../models/User';
import UserRoles from '../../../models/UserRoles';
import Clinic from '../../../models/Clinic';
import { createImpersonationToken, createJWTToken, getCurrentUser } from '../../../config/jwt';
import { AuditService } from '../../../services/audit.service';

export const startImpersonation = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    // Only superAdmins can impersonate
    const admin = await User.findByPk(currentUser.id, {
      include: [{ model: UserRoles, as: 'userRoles', required: false }],
    });
    if (!admin || !admin.hasRoleSync('superAdmin')) {
      return res.status(403).json({ success: false, message: 'Forbidden: SuperAdmin access required' });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    // Fetch the user to impersonate
    const targetUser = await User.findByPk(userId, {
      include: [{ model: UserRoles, as: 'userRoles', required: false }],
    });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Fetch clinic info for the response
    const clinic = targetUser.clinicId
      ? await Clinic.findByPk(targetUser.clinicId, { attributes: ['id', 'name', 'slug'] })
      : null;

    // Create impersonation JWT token (30min, with impersonation metadata)
    const impersonationToken = createImpersonationToken(targetUser, admin.id);

    // Audit log: admin impersonation start
    await AuditService.logImpersonateStart(req, admin.id, targetUser.id, targetUser.email);

    res.status(200).json({
      success: true,
      data: {
        token: impersonationToken,
        impersonatedUser: {
          id: targetUser.id,
          email: targetUser.email,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
        },
        clinic: clinic ? { id: clinic.id, name: clinic.name, slug: clinic.slug } : null,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error starting impersonation:', error);
    }
    res.status(500).json({ success: false, message: 'Failed to start impersonation' });
  }
};

export const exitImpersonation = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    // Check if currently impersonating
    const impersonatedBy = (req as any).user?.impersonatedBy;
    if (!impersonatedBy) {
      return res.status(400).json({ success: false, message: 'Not currently impersonating' });
    }

    // Fetch the original admin user
    const admin = await User.findByPk(impersonatedBy, {
      include: [{ model: UserRoles, as: 'userRoles', required: false }],
    });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Original admin user not found' });
    }

    // Create new JWT token for original admin (standard 30min token)
    const adminToken = createJWTToken(admin);

    // Audit log: admin impersonation end
    await AuditService.logImpersonateEnd(req, admin.id, currentUser.id);

    res.status(200).json({
      success: true,
      data: {
        token: adminToken,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error exiting impersonation:', error);
    }
    res.status(500).json({ success: false, message: 'Failed to exit impersonation' });
  }
};
