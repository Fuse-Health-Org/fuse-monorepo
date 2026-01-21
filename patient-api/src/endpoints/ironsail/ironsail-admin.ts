import { Express } from "express";
import { getIronSailToken, IRONSAIL_API_BASE } from "./ironsail-auth";

// ============= IRONSAIL ADMIN API =============
// Provides admin access to browse IronSail pharmacies and medication catalogs

export function registerIronSailAdminEndpoints(
  app: Express,
  authenticateJWT: any
) {
  // List available IronSail pharmacies
  app.get("/ironsail/pharmacies", authenticateJWT, async (req, res) => {
    try {
      const token = await getIronSailToken();

      const headers: Record<string, string> = {
        "Accept": "application/json",
        "Content-Type": "application/json"
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${IRONSAIL_API_BASE}/pharmacies`, {
        method: "GET",
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[IronSail] Failed to fetch pharmacies:", errorText);
        return res.status(response.status).json({
          success: false,
          message: "Failed to fetch pharmacies from IronSail",
          error: errorText
        });
      }

      const data = await response.json() as { data?: any[] };
      console.log(`[IronSail] Fetched ${data.data?.length || 0} pharmacies`);

      return res.json({
        success: true,
        data: data.data || [],
        count: data.data?.length || 0
      });
    } catch (error: any) {
      console.error("[IronSail] Error fetching pharmacies:", error?.message);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch pharmacies",
        error: error?.message
      });
    }
  });

  // Get medications/products for a specific IronSail pharmacy
  app.get("/ironsail/pharmacies/:pharmacyId/medications", authenticateJWT, async (req, res) => {
    try {
      const { pharmacyId } = req.params;
      const { page = "1", search } = req.query;

      const token = await getIronSailToken();

      const headers: Record<string, string> = {
        "Accept": "application/json",
        "Content-Type": "application/json"
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      let url = `${IRONSAIL_API_BASE}/pharmacies/${pharmacyId}/medications?page=${page}`;
      if (search) {
        url += `&search=${encodeURIComponent(search as string)}`;
      }

      console.log(`[IronSail] Fetching medications from: ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[IronSail] Failed to fetch medications:", errorText);
        return res.status(response.status).json({
          success: false,
          message: "Failed to fetch medications from IronSail",
          error: errorText
        });
      }

      const data = await response.json() as {
        data?: any[];
        pagination?: { page: number; per_page: number; total: number; total_pages: number }
      };
      console.log(`[IronSail] Fetched ${data.data?.length || 0} medications for pharmacy ${pharmacyId}`);

      return res.json({
        success: true,
        data: data.data || [],
        pagination: data.pagination || {
          page: parseInt(page as string),
          per_page: 25,
          total: data.data?.length || 0,
          total_pages: 1
        }
      });
    } catch (error: any) {
      console.error("[IronSail] Error fetching medications:", error?.message);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch medications",
        error: error?.message
      });
    }
  });

  // Get details of a specific medication
  app.get("/ironsail/medications/:medicationId", authenticateJWT, async (req, res) => {
    try {
      const { medicationId } = req.params;
      const { pharmacyId } = req.query;

      if (!pharmacyId) {
        return res.status(400).json({
          success: false,
          message: "pharmacyId query parameter is required"
        });
      }

      const token = await getIronSailToken();

      const headers: Record<string, string> = {
        "Accept": "application/json",
        "Content-Type": "application/json"
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Fetch all medications and find the specific one
      const response = await fetch(`${IRONSAIL_API_BASE}/pharmacies/${pharmacyId}/medications`, {
        method: "GET",
        headers
      });

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          message: "Failed to fetch medication details"
        });
      }

      const data = await response.json() as { data?: any[] };
      const medication = data.data?.find((med: any) => med.medication_id === medicationId);

      if (!medication) {
        return res.status(404).json({
          success: false,
          message: "Medication not found"
        });
      }

      return res.json({
        success: true,
        data: medication
      });
    } catch (error: any) {
      console.error("[IronSail] Error fetching medication details:", error?.message);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch medication details",
        error: error?.message
      });
    }
  });

  console.log("✅ IronSail Admin endpoints registered");
}
