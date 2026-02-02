import { authenticateJWT } from "@/config/jwt";
import { Router } from "express";
import { getAffiliatePayouts, getBrandPayouts, getDoctorPayouts, getPharmacyPayouts, getTenantPayouts } from "../controllers/payouts.controller";

const router = Router();

router.get("/payouts/tenant", authenticateJWT, getTenantPayouts);
router.get("/payouts/brand", authenticateJWT, getBrandPayouts);
router.get("/payouts/affiliate", authenticateJWT, getAffiliatePayouts);
router.get("/payouts/doctor", authenticateJWT, getDoctorPayouts);
router.get("/payouts/pharmacy", authenticateJWT, getPharmacyPayouts);

export default router;