import { getCurrentUser } from "src/config/jwt";
import DashboardService from "src/services/dashboard.service";
import { Request, Response } from 'express';
import User from "src/models/User";


export const getDashboardMetrics = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
            return res
                .status(401)
                .json({ success: false, message: "Not authenticated" });
        }

        const { startDate, endDate, clinicId } = req.query;

        if (!clinicId || typeof clinicId !== "string") {
            return res
                .status(400)
                .json({ success: false, message: "clinicId is required" });
        }

        // Verify user has access to this clinic
        const user = await User.findByPk(currentUser.id);
        if (!user || user.clinicId !== clinicId) {
            return res
                .status(403)
                .json({ success: false, message: "Access denied to this clinic" });
        }

        const start = startDate
            ? new Date(startDate as string)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate as string) : new Date();

        const dashboardService = new DashboardService();
        const metrics = await dashboardService.getDashboardMetrics(clinicId, {
            start,
            end,
        });

        res.json({ success: true, data: metrics });
    } catch (error) {
        if (process.env.NODE_ENV === "development") {
            console.error("❌ Error fetching dashboard metrics:", error);
        } else {
            console.error("❌ Error fetching dashboard metrics");
        }
        res
            .status(500)
            .json({ success: false, message: "Failed to fetch dashboard metrics" });
    }
}

export const getDashboardRevenueChart = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
            return res
                .status(401)
                .json({ success: false, message: "Not authenticated" });
        }

        const { startDate, endDate, interval, clinicId } = req.query;

        if (!clinicId || typeof clinicId !== "string") {
            return res
                .status(400)
                .json({ success: false, message: "clinicId is required" });
        }

        // Verify user has access to this clinic
        const user = await User.findByPk(currentUser.id);
        if (!user || user.clinicId !== clinicId) {
            return res
                .status(403)
                .json({ success: false, message: "Access denied to this clinic" });
        }

        const start = startDate
            ? new Date(startDate as string)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate as string) : new Date();
        const chartInterval =
            interval === "daily" || interval === "weekly" ? interval : "daily";

        const dashboardService = new DashboardService();
        const chartData = await dashboardService.getRevenueOverTime(
            clinicId,
            { start, end },
            chartInterval
        );

        res.json({ success: true, data: chartData });
    } catch (error) {
        if (process.env.NODE_ENV === "development") {
            console.error("❌ Error fetching revenue chart:", error);
        } else {
            console.error("❌ Error fetching revenue chart");
        }
        res
            .status(500)
            .json({ success: false, message: "Failed to fetch revenue chart" });
    }
}

export const getDashboardEarningsReport = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }
    
        const { startDate, endDate, clinicId } = req.query;
    
        if (!clinicId || typeof clinicId !== "string") {
          return res
            .status(400)
            .json({ success: false, message: "clinicId is required" });
        }
    
        // Verify user has access to this clinic
        const user = await User.findByPk(currentUser.id);
        if (!user || user.clinicId !== clinicId) {
          return res
            .status(403)
            .json({ success: false, message: "Access denied to this clinic" });
        }
    
        const start = startDate
          ? new Date(startDate as string)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate as string) : new Date();
    
        const dashboardService = new DashboardService();
        const earningsReport = await dashboardService.getEarningsReport(clinicId, {
          start,
          end,
        });
    
        res.json({ success: true, data: earningsReport });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error fetching earnings report:", error);
        } else {
          console.error("❌ Error fetching earnings report");
        }
        res
          .status(500)
          .json({ success: false, message: "Failed to fetch earnings report" });
      }
}

export const getDashboardRecentActivity = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }
    
        const { limit, clinicId } = req.query;
    
        if (!clinicId || typeof clinicId !== "string") {
          return res
            .status(400)
            .json({ success: false, message: "clinicId is required" });
        }
    
        // Verify user has access to this clinic
        const user = await User.findByPk(currentUser.id);
        if (!user || user.clinicId !== clinicId) {
          return res
            .status(403)
            .json({ success: false, message: "Access denied to this clinic" });
        }
    
        const activityLimit = limit ? parseInt(limit as string) : 10;
    
        const dashboardService = new DashboardService();
        const recentActivity = await dashboardService.getRecentActivity(
          clinicId,
          activityLimit
        );
    
        res.json({ success: true, data: recentActivity });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error fetching recent activity:", error);
        } else {
          console.error("❌ Error fetching recent activity");
        }
        res
          .status(500)
          .json({ success: false, message: "Failed to fetch recent activity" });
      }
}

export const getDashboardProjectedRevenue = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
        if (!currentUser) {
          return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
        }
    
        const { endDate, daysToProject, clinicId } = req.query;
    
        if (!clinicId || typeof clinicId !== "string") {
          return res
            .status(400)
            .json({ success: false, message: "clinicId is required" });
        }
    
        if (!daysToProject) {
          return res
            .status(400)
            .json({ success: false, message: "daysToProject is required" });
        }
    
        // Verify user has access to this clinic
        const user = await User.findByPk(currentUser.id);
        if (!user || user.clinicId !== clinicId) {
          return res
            .status(403)
            .json({ success: false, message: "Access denied to this clinic" });
        }
    
        const projectionEndDate = endDate
          ? new Date(endDate as string)
          : new Date();
        const days = parseInt(daysToProject as string);
    
        const dashboardService = new DashboardService();
        const projectedRevenue =
          await dashboardService.getProjectedRecurringRevenue(
            clinicId,
            projectionEndDate,
            days
          );
    
        res.json({ success: true, data: projectedRevenue });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error fetching projected revenue:", error);
        } else {
          console.error("❌ Error fetching projected revenue");
        }
        res
          .status(500)
          .json({ success: false, message: "Failed to fetch projected revenue" });
      }
}