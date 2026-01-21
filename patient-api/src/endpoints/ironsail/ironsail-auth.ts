import { Express } from "express";

// ============= IRONSAIL AUTHENTICATION & CONFIGURATION =============
// Handles IronSail API authentication, token management, and credential setup

// IronSail API Configuration
// Sandbox: https://sandbox.api.impetusrx.com/pharmacy/fuse-sandbox/api/v1
// Production: Will be provided when ready to go live
export const IRONSAIL_API_BASE = process.env.IRONSAIL_API_BASE_URL || "https://sandbox.api.impetusrx.com/pharmacy/fuse-sandbox/api/v1";
export const IRONSAIL_TENANT = process.env.IRONSAIL_TENANT || "fuse-sandbox";

// In-memory token cache (in production, use Redis or database)
let ironSailTokenCache: { token: string; expiresAt: number } | null = null;

// Helper to get IronSail auth token
export const getIronSailToken = async (): Promise<string | null> => {
  try {
    // Check if we have a valid cached token
    if (ironSailTokenCache && ironSailTokenCache.expiresAt > Date.now()) {
      return ironSailTokenCache.token;
    }

    // Check if we have stored credentials
    const clientId = process.env.IRONSAIL_CLIENT_ID;
    const clientSecret = process.env.IRONSAIL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.log("[IronSail] No credentials configured. Use /ironsail/setup to create credentials with setup token.");
      return null;
    }

    // Get access token
    console.log("[IronSail] Fetching new access token...");
    const tokenResponse = await fetch(`${IRONSAIL_API_BASE}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[IronSail] Failed to get token:", errorText);
      return null;
    }

    const tokenData = await tokenResponse.json() as Record<string, any>;
    console.log("[IronSail] Token response structure:", JSON.stringify(tokenData, null, 2));

    // Handle nested data structure - token might be in tokenData.data.access_token
    const accessToken = tokenData.data?.access_token || tokenData.access_token;

    if (!accessToken) {
      console.error("[IronSail] No access_token found in response:", tokenData);
      return null;
    }

    // Cache the token (30 days validity, cache for 29 days to be safe)
    ironSailTokenCache = {
      token: accessToken,
      expiresAt: Date.now() + (29 * 24 * 60 * 60 * 1000) // 29 days
    };

    console.log("[IronSail] Access token obtained and cached:", accessToken.substring(0, 20) + "...");
    return accessToken;
  } catch (error) {
    console.error("[IronSail] Error getting token:", error);
    return null;
  }
};

export function registerIronSailAuthEndpoints(
  app: Express,
  authenticateJWT: any
) {
  // Check IronSail API connection status
  app.get("/ironsail/status", authenticateJWT, async (req, res) => {
    try {
      const hasCredentials = !!(process.env.IRONSAIL_CLIENT_ID && process.env.IRONSAIL_CLIENT_SECRET);
      const hasSetupToken = !!process.env.IRONSAIL_SETUP_TOKEN;

      // Try to get a token to verify credentials work
      let tokenValid = false;
      if (hasCredentials) {
        const token = await getIronSailToken();
        tokenValid = !!token;
      }

      // Try to ping the pharmacies endpoint (requires auth)
      let apiAccessible = false;
      if (tokenValid) {
        try {
          const token = await getIronSailToken();
          const response = await fetch(`${IRONSAIL_API_BASE}/pharmacies`, {
            method: "GET",
            headers: {
              "Accept": "application/json",
              "Authorization": `Bearer ${token}`
            }
          });
          apiAccessible = response.ok;
        } catch {
          apiAccessible = false;
        }
      }

      return res.json({
        success: true,
        connected: tokenValid && apiAccessible,
        message: tokenValid && apiAccessible
          ? "IronSail API is connected and accessible"
          : !hasCredentials
            ? "Credentials not configured. Use setup token to create credentials."
            : !tokenValid
              ? "Credentials configured but token validation failed"
              : "API connection issue",
        tenant: IRONSAIL_TENANT,
        baseUrl: IRONSAIL_API_BASE,
        config: {
          hasCredentials,
          hasSetupToken,
          tokenValid,
          apiAccessible
        }
      });
    } catch (error: any) {
      console.error("[IronSail] Connection check failed:", error?.message);
      return res.json({
        success: true,
        connected: false,
        message: "Failed to check IronSail API status",
        error: error?.message
      });
    }
  });

  // Create API credentials using setup token
  // POST /ironsail/setup with { setup_token: "st_..." }
  // Note: Setup token can create up to 20 credential pairs. Use sparingly.
  app.post("/ironsail/setup", authenticateJWT, async (req, res) => {
    try {
      const { setup_token, name } = req.body;

      // Use provided token or fall back to env var
      const tokenToUse = setup_token || process.env.IRONSAIL_SETUP_TOKEN;

      if (!tokenToUse) {
        return res.status(400).json({
          success: false,
          message: "Setup token is required. Provide 'setup_token' in request body or set IRONSAIL_SETUP_TOKEN env var."
        });
      }

      console.log("[IronSail] Creating credentials with setup token...");

      const response = await fetch(`${IRONSAIL_API_BASE}/auth/credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${tokenToUse}`,
          "X-Setup-Token": tokenToUse
        },
        body: JSON.stringify({
          name: name || "Fuse Health Tenant Portal"
        })
      });

      const responseData = await response.json() as Record<string, any>;

      // Log the full response to see the structure
      console.log("[IronSail] Full API response:", JSON.stringify(responseData, null, 2));

      if (!response.ok) {
        console.error("[IronSail] Failed to create credentials:", responseData);
        return res.status(response.status).json({
          success: false,
          message: "Failed to create credentials",
          error: responseData?.errors?.messages || responseData?.message || responseData?.error || JSON.stringify(responseData)
        });
      }

      // Handle nested data structure - credentials might be in responseData.data
      const credentials = responseData.data || responseData;
      const clientId = credentials.client_id;
      const clientSecret = credentials.client_secret;
      const credentialName = credentials.name;

      console.log("[IronSail] Credentials created successfully!");
      console.log("[IronSail] ⚠️  IMPORTANT: Save these credentials securely!");
      console.log("[IronSail] Client ID:", clientId);
      console.log("[IronSail] Client Secret:", clientSecret?.substring(0, 10) + "...");

      // Return the credentials (user needs to save these as env vars)
      return res.json({
        success: true,
        message: "Credentials created successfully! Save these in your environment variables.",
        data: {
          client_id: clientId,
          client_secret: clientSecret,
          name: credentialName
        },
        instructions: [
          "1. Copy the client_id and client_secret above",
          "2. Add them to your .env file:",
          "   IRONSAIL_CLIENT_ID=" + clientId,
          "   IRONSAIL_CLIENT_SECRET=" + clientSecret,
          "3. Restart the server",
          "4. The setup token has limited uses (max 20 credential pairs)"
        ]
      });
    } catch (error: any) {
      console.error("[IronSail] Error creating credentials:", error?.message);
      return res.status(500).json({
        success: false,
        message: "Failed to create credentials",
        error: error?.message
      });
    }
  });

  // List existing API credentials
  app.get("/ironsail/credentials", authenticateJWT, async (req, res) => {
    try {
      const token = await getIronSailToken();

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated with IronSail. Configure credentials first."
        });
      }

      const response = await fetch(`${IRONSAIL_API_BASE}/auth/credentials`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          success: false,
          message: "Failed to list credentials",
          error: errorText
        });
      }

      const data = await response.json() as { data?: any[] };
      return res.json({
        success: true,
        data: data.data || data
      });
    } catch (error: any) {
      console.error("[IronSail] Error listing credentials:", error?.message);
      return res.status(500).json({
        success: false,
        message: "Failed to list credentials",
        error: error?.message
      });
    }
  });

  console.log("✅ IronSail Auth endpoints registered");
}
