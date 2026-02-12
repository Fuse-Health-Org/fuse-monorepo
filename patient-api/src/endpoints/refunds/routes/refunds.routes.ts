import { Router } from "express";
import { authenticateJWT } from "@/config/jwt";
import { createRefund } from "../controllers/refunds.controller";

const router = Router();

router.post("/refunds", authenticateJWT, createRefund);

export default router;
