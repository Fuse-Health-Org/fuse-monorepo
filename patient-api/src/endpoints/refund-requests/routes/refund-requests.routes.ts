import { Router } from "express";
import { authenticateJWT } from "@/config/jwt";
import {
  createRefundRequest,
  getRefundRequests,
  getRefundRequestByOrder,
  approveRefundRequest,
  denyRefundRequest,
} from "../controllers/refund-requests.controller";

const router = Router();

// Brand admin creates a refund request
router.post("/refund-requests", authenticateJWT, createRefundRequest);

// Get refund requests for a clinic
router.get("/refund-requests/clinic/:clinicId", authenticateJWT, getRefundRequests);

// Get refund request status for a specific order
router.get("/refund-requests/order/:orderId", authenticateJWT, getRefundRequestByOrder);

// Tenant admin approves a refund request
router.post("/refund-requests/:id/approve", authenticateJWT, approveRefundRequest);

// Tenant admin denies a refund request
router.post("/refund-requests/:id/deny", authenticateJWT, denyRefundRequest);

export default router;
