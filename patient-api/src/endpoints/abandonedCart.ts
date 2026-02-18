import { Router, Request, Response } from "express";
import { authenticateJWT } from "../config/jwt";

const router = Router();

router.post("/abandoned-cart/process", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { AbandonedCartTriggerService } = await import("../services/abandonedCartTrigger.service");
    
    const { lookbackHours = 24, abandonmentThresholdHours = 1 } = req.body;

    const result = await AbandonedCartTriggerService.processAbandonedCarts(
      lookbackHours,
      abandonmentThresholdHours
    );

    return res.json({
      success: true,
      message: 'Abandoned cart processing completed',
      data: result,
    });
  } catch (error: any) {
    console.error('[Abandoned Cart API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
