import { Express } from "express";
import UserService from "../services/user.service";
import { patientUpdateSchema } from "@fuse/validators";
import { AuditService } from "../services/audit.service";

export function registerPatientEndpoints(
  app: Express,
  authenticateJWT: any,
  getCurrentUser: any
) {
  const userService = new UserService();

  app.put("/patient", authenticateJWT, async (req, res) => {
    try {
      const currentUser = getCurrentUser(req);

      if (!currentUser) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // Validate request body using patientUpdateSchema
      const validation = patientUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const { address, ...data } = validation.data;

      const result = await userService.updateUserPatient(
        currentUser.id,
        data,
        address
      );

      if (result.success) {
        // HIPAA Audit: Log PHI modification (patient updating their own profile)
        await AuditService.logPatientUpdate(
          req,
          currentUser.id,
          Object.keys(data)
        );
        res.status(200).json(result);
      } else {
        res.status(400).json(result.error);
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error updating patient:", error);
      } else {
        console.error("❌ Error updating patient");
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });
}
