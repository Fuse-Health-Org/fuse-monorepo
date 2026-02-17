import { Router } from "express";
import { authenticateJWT } from "@/config/jwt";
import {
  listBelugaProducts,
  getBelugaProduct,
  createBelugaProduct,
  updateBelugaProduct,
  deleteBelugaProduct,
} from "../controllers/beluga-products.controller";

const router = Router();

router.get("/", authenticateJWT, listBelugaProducts);
router.get("/:id", authenticateJWT, getBelugaProduct);
router.post("/", authenticateJWT, createBelugaProduct);
router.put("/:id", authenticateJWT, updateBelugaProduct);
router.delete("/:id", authenticateJWT, deleteBelugaProduct);

export default router;
