import { Express } from "express";
import { Op } from "sequelize";
import AuditLog, { AuditAction, AuditResourceType } from "../models/AuditLog";
import User from "../models/User";
import UserRoles from "../models/UserRoles";

export function registerAuditLogsEndpoints(
  app: Express,
  authenticateJWT: any,
  getCurrentUser: any
) {
  /**
   * GET /admin/audit-logs
   * Fetch audit logs with filtering and pagination
   * Only accessible by admin users
   */
  app.get("/admin/audit-logs", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      // Only admins can access audit logs
      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });
      if (!user || !user.hasRoleSync("admin")) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Admin access required",
        });
      }

      // Pagination
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = (page - 1) * limit;

      // Filters
      const action = req.query.action as string;
      const resourceType = req.query.resourceType as string;
      const userId = req.query.userId as string;
      const userEmail = req.query.userEmail as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const success = req.query.success as string;
      const search = req.query.search as string;

      // Build where clause
      const whereClause: any = {};

      if (
        action &&
        Object.values(AuditAction).includes(action as AuditAction)
      ) {
        whereClause.action = action;
      }

      if (
        resourceType &&
        Object.values(AuditResourceType).includes(
          resourceType as AuditResourceType
        )
      ) {
        whereClause.resourceType = resourceType;
      }

      if (userId) {
        whereClause.userId = userId;
      }

      if (userEmail) {
        whereClause.userEmail = { [Op.iLike]: `%${userEmail}%` };
      }

      if (startDate) {
        whereClause.createdAt = {
          ...whereClause.createdAt,
          [Op.gte]: new Date(startDate),
        };
      }

      if (endDate) {
        whereClause.createdAt = {
          ...whereClause.createdAt,
          [Op.lte]: new Date(endDate),
        };
      }

      if (success !== undefined && success !== "") {
        whereClause.success = success === "true";
      }

      if (search) {
        whereClause[Op.or] = [
          { userEmail: { [Op.iLike]: `%${search}%` } },
          { resourceId: { [Op.iLike]: `%${search}%` } },
          { ipAddress: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const { rows: logs, count } = await AuditLog.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "firstName", "lastName", "email"],
            required: false,
          },
        ],
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      // Check which users are superAdmins and flag their logs
      const userIds = logs.map((log) => log.userId).filter(Boolean) as string[];
      const superAdminUserIds = new Set<string>();

      if (userIds.length > 0) {
        const superAdminRoles = await UserRoles.findAll({
          where: {
            userId: { [Op.in]: userIds },
            superAdmin: true,
          },
        });
        superAdminRoles.forEach((r) => {
          if (r.superAdmin === true) {
            superAdminUserIds.add(r.userId);
          }
        });
      }

      // Add isSuperAdmin flag to each log
      const logsWithFlags = logs.map((log) => ({
        ...log.toJSON(),
        isSuperAdmin: log.userId ? superAdminUserIds.has(log.userId) : false,
      }));

      res.status(200).json({
        success: true,
        data: {
          logs: logsWithFlags,
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit),
          },
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching audit logs:", error);
      } else {
        console.error("❌ Error fetching audit logs");
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch audit logs" });
    }
  });

  /**
   * GET /admin/audit-logs/actions
   * Get list of available audit actions
   */
  app.get("/admin/audit-logs/actions", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });
      if (!user || !user.hasRoleSync("admin")) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      res.status(200).json({
        success: true,
        data: {
          actions: Object.values(AuditAction),
          resourceTypes: Object.values(AuditResourceType),
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching audit actions:", error);
      } else {
        console.error("❌ Error fetching audit actions");
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch audit actions" });
    }
  });

  /**
   * GET /admin/audit-logs/stats
   * Get audit log statistics
   */
  app.get("/admin/audit-logs/stats", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });
      if (!user || !user.hasRoleSync("admin")) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      // Get stats for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [totalLogs, last30DaysLogs, failedLogins, phiAccesses] =
        await Promise.all([
          AuditLog.count(),
          AuditLog.count({
            where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
          }),
          AuditLog.count({
            where: {
              action: AuditAction.LOGIN_FAILED,
              createdAt: { [Op.gte]: thirtyDaysAgo },
            },
          }),
          AuditLog.count({
            where: {
              action: AuditAction.VIEW,
              resourceType: {
                [Op.in]: [
                  AuditResourceType.PATIENT,
                  AuditResourceType.ORDER,
                  AuditResourceType.PRESCRIPTION,
                ],
              },
              createdAt: { [Op.gte]: thirtyDaysAgo },
            },
          }),
        ]);

      res.status(200).json({
        success: true,
        data: {
          totalLogs,
          last30DaysLogs,
          failedLogins,
          phiAccesses,
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching audit stats:", error);
      } else {
        console.error("❌ Error fetching audit stats");
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch audit stats" });
    }
  });

  /**
   * GET /admin/audit-logs/export
   * Export audit logs as CSV
   */
  app.get("/admin/audit-logs/export", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      const user = await User.findByPk(currentUser.id, {
        include: [{ model: UserRoles, as: "userRoles", required: false }],
      });
      if (!user || !user.hasRoleSync("admin")) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      // Date range filters (default to last 30 days)
      const startDate =
        (req.query.startDate as string) ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = (req.query.endDate as string) || new Date().toISOString();

      const whereClause: any = {
        createdAt: {
          [Op.gte]: new Date(startDate),
          [Op.lte]: new Date(endDate),
        },
      };

      const action = req.query.action as string;
      const resourceType = req.query.resourceType as string;

      if (
        action &&
        Object.values(AuditAction).includes(action as AuditAction)
      ) {
        whereClause.action = action;
      }

      if (
        resourceType &&
        Object.values(AuditResourceType).includes(
          resourceType as AuditResourceType
        )
      ) {
        whereClause.resourceType = resourceType;
      }

      const logs = await AuditLog.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "firstName", "lastName", "email"],
            required: false,
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: 10000, // Max 10k records for export
      });

      // Generate CSV
      const csvHeaders = [
        "Timestamp",
        "User Email",
        "User Name",
        "Action",
        "Resource Type",
        "Resource ID",
        "IP Address",
        "Success",
        "Details",
      ].join(",");

      const csvRows = logs.map((log) => {
        const userName = log.user
          ? `${log.user.firstName} ${log.user.lastName}`
          : "N/A";
        const details = log.details
          ? JSON.stringify(log.details).replace(/"/g, '""')
          : "";

        return [
          log.createdAt.toISOString(),
          log.userEmail || "N/A",
          `"${userName}"`,
          log.action,
          log.resourceType,
          log.resourceId || "N/A",
          log.ipAddress || "N/A",
          log.success ? "Yes" : "No",
          `"${details}"`,
        ].join(",");
      });

      const csvContent = [csvHeaders, ...csvRows].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="audit-logs-${
          new Date().toISOString().split("T")[0]
        }.csv"`
      );
      res.send(csvContent);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error exporting audit logs:", error);
      } else {
        console.error("❌ Error exporting audit logs");
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to export audit logs" });
    }
  });
}
