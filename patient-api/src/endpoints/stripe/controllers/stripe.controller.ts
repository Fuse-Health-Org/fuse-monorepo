import { getCurrentUser } from "@/config/jwt";
import { StripeConnectService } from "@services/stripe/connect.service";
import { Request, Response } from "express";

export const createStripeConnectSession = async (req: Request, res: Response) => {
    try {
        console.log("🔄 Creating Stripe Connect session", req.body);
        const currentUser = getCurrentUser(req);
        console.log("🔍 Current user:", currentUser);
        if (!currentUser) {
          return res.status(401).json({
            success: false,
            message: "Not authenticated",
          });
        }
    
        const userWithClinic: any = currentUser;
        const clinicId = userWithClinic?.clinicId;
    
        if (!clinicId) {
          return res.status(400).json({
            success: false,
            message: "No clinic associated with user",
          });
        }
    
        // Get merchant model from request body (defaults to 'platform')
        const { merchantModel } = req.body;
        const validMerchantModel =
          merchantModel === "direct" ? "direct" : "platform";
    
        console.log(
          `🔄 Creating Stripe Connect session for clinic: ${clinicId} (${validMerchantModel} model)`
        );
    
        // Create account session with merchant model
        const clientSecret = await new StripeConnectService().createAccountSession(
          clinicId,
          validMerchantModel
        );
    
        if (!clientSecret) {
          throw new Error("Client secret was not generated");
        }
    
        res.status(200).json({
          success: true,
          data: {
            client_secret: clientSecret,
          },
        });
      } catch (error: any) {
        console.error("❌ Error creating Stripe Connect session:", error);
        if (error.type === 'StripeInvalidRequestError') {
          console.error("❌ Stripe error details:", JSON.stringify(error.raw, null, 2));
        }
        res.status(500).json({
          success: false,
          message: error.message || "Failed to create Connect session",
          error: process.env.NODE_ENV === "development" ? error.stack : undefined,
        });
      }
}

export const getStripeConnectStatus = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
    
        if (!currentUser) {
          return res.status(401).json({
            success: false,
            message: "Not authenticated",
          });
        }
    
        const userWithClinic: any = currentUser;
        const clinicId = userWithClinic?.clinicId;
    
        if (!clinicId) {
          return res.status(400).json({
            success: false,
            message: "No clinic associated with user",
          });
        }
    
        console.log(`🔍 Fetching Stripe Connect status for clinic: ${clinicId}`);
    
        // Get account status
        const status = await new StripeConnectService().getAccountStatus(clinicId);
    
        res.status(200).json({
          success: true,
          data: status,
        });
      } catch (error: any) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error fetching Stripe Connect status:", error);
        } else {
          console.error("❌ Error fetching Stripe Connect status");
        }
        res.status(500).json({
          success: false,
          message: error.message || "Failed to fetch Connect status",
        });
      }
}

export const createStripeConnectAccountLink = async (req: Request, res: Response) => {
    try {
        const currentUser = getCurrentUser(req);
    
        if (!currentUser) {
          return res.status(401).json({
            success: false,
            message: "Not authenticated",
          });
        }
    
        const userWithClinic: any = currentUser;
        const clinicId = userWithClinic?.clinicId;
    
        if (!clinicId) {
          return res.status(400).json({
            success: false,
            message: "No clinic associated with user",
          });
        }
    
        const { refreshUrl, returnUrl } = req.body;
    
        if (!refreshUrl || !returnUrl) {
          return res.status(400).json({
            success: false,
            message: "refreshUrl and returnUrl are required",
          });
        }
    
        console.log(`🔄 Creating Stripe account link for clinic: ${clinicId}`);
    
        const accountLinkUrl = await new StripeConnectService().createAccountLink(
          clinicId,
          refreshUrl,
          returnUrl
        );
    
        res.status(200).json({
          success: true,
          data: {
            url: accountLinkUrl,
          },
        });
      } catch (error: any) {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Error creating account link:", error);
        } else {
          console.error("❌ Error creating account link");
        }
        res.status(500).json({
          success: false,
          message: error.message || "Failed to create account link",
        });
      }
}