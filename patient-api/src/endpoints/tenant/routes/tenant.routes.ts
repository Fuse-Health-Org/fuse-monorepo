import { authenticateJWT } from "@/config/jwt";
import express from "express";
import { deleteTenantProductById, getTenantById, getTenantProductById, getTenantProducts, getTenants, retryProductSelection, updateProductSelection, updateTenantProductPrice } from "../controllers/tenant.controller";

const router = express.Router();

router.get("/tenants", authenticateJWT, getTenants);
router.get("/tenants/:id", authenticateJWT, getTenantById);

//Products
router.post("/tenant-products/retry-selection", authenticateJWT, retryProductSelection);
router.get("/tenant-products/:id", getTenantProductById);
router.post("/tenant-products/update-selection", authenticateJWT, updateProductSelection);
router.post("/tenant-products/update", authenticateJWT, updateTenantProductPrice);
router.get("/tenant-products", authenticateJWT, getTenantProducts);
router.delete("/tenant-products/:id", authenticateJWT, deleteTenantProductById);

export default router;