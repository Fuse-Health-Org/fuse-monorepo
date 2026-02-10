import { Express } from "express";
import { olympiaPharmacyApiService } from "./api.service";
import { olympiaPharmacyAuthService } from "./auth.service";

// ============= OLYMPIA PHARMACY ADMIN API =============
// Provides admin access to create/search/update patients and create prescriptions

export function registerOlympiaAdminEndpoints(
  app: Express,
  authenticateJWT: any
) {
  // ========== Connection Status ==========
  app.get("/olympia/status", authenticateJWT, async (req, res) => {
    try {
      const isConfigured = olympiaPharmacyAuthService.isConfigured();

      if (!isConfigured) {
        return res.json({
          success: true,
          connected: false,
          config: {
            hasCredentials: false,
            tokenValid: false,
            apiAccessible: false,
          },
        });
      }

      // Try to get a token to verify connection
      try {
        await olympiaPharmacyAuthService.getAccessToken();
        return res.json({
          success: true,
          connected: true,
          config: {
            hasCredentials: true,
            tokenValid: true,
            apiAccessible: true,
          },
        });
      } catch {
        return res.json({
          success: true,
          connected: false,
          config: {
            hasCredentials: true,
            tokenValid: false,
            apiAccessible: false,
          },
        });
      }
    } catch (error: any) {
      console.error("Error checking Olympia status:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to check Olympia connection status",
      });
    }
  });

  // ========== Patient Endpoints ==========

  // Create Patient
  app.post("/olympia/patients", authenticateJWT, async (req, res) => {
    try {
      console.log("📥 [Olympia] Create Patient - Request:", JSON.stringify(req.body, null, 2));
      const result = await olympiaPharmacyApiService.createPatient(req.body);
      console.log("📤 [Olympia] Create Patient - Response:", JSON.stringify(result, null, 2));
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("❌ [Olympia] Create Patient - Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        success: false,
        message: error.response?.data?.message || error.message || "Failed to create patient",
        errors: error.response?.data?.errors,
      });
    }
  });

  // Search Patients
  app.post("/olympia/patients/search", authenticateJWT, async (req, res) => {
    try {
      console.log("📥 [Olympia] Search Patients - Request:", JSON.stringify(req.body, null, 2));
      const results = await olympiaPharmacyApiService.searchPatients(req.body);
      console.log("📤 [Olympia] Search Patients - Response:", JSON.stringify(results, null, 2));
      res.json({ success: true, data: results });
    } catch (error: any) {
      console.error("❌ [Olympia] Search Patients - Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        success: false,
        message: error.response?.data?.message || error.message || "Failed to search patients",
      });
    }
  });

  // Update Patient
  app.put("/olympia/patients/:uuid", authenticateJWT, async (req, res) => {
    try {
      console.log("📥 [Olympia] Update Patient - UUID:", req.params.uuid, "Request:", JSON.stringify(req.body, null, 2));
      const result = await olympiaPharmacyApiService.updatePatient({
        uuid: req.params.uuid,
        ...req.body,
      });
      console.log("📤 [Olympia] Update Patient - Response:", JSON.stringify(result, null, 2));
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("❌ [Olympia] Update Patient - Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        success: false,
        message: error.response?.data?.message || error.message || "Failed to update patient",
        errors: error.response?.data?.errors,
      });
    }
  });

  // ========== Prescription Endpoints ==========

  // Create Prescription
  app.post("/olympia/prescriptions", authenticateJWT, async (req, res) => {
    try {
      // Validate vendor_order_id is present
      if (!req.body.vendor_order_id) {
        return res.status(400).json({
          success: false,
          message: "vendor_order_id is required for every Olympia prescription order",
        });
      }

      console.log("📥 [Olympia] Create Prescription - Request:", JSON.stringify(req.body, null, 2));
      const result = await olympiaPharmacyApiService.createPrescription(req.body);
      console.log("📤 [Olympia] Create Prescription - Response:", JSON.stringify(result, null, 2));
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("❌ [Olympia] Create Prescription - Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        success: false,
        message: error.response?.data?.message || error.message || "Failed to create prescription",
        errors: error.response?.data?.errors,
      });
    }
  });

  console.log("✅ Olympia Pharmacy admin endpoints registered at /olympia/*");
}
