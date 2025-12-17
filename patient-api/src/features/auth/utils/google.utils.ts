/**
 * Decode Google JWT credential to get user info
 */
export function decodeGoogleCredential(credential: string): any {
  const base64Url = credential.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    Buffer.from(base64, "base64")
      .toString()
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );
  return JSON.parse(jsonPayload);
}

/**
 * Build Google Auth URL
 */
export function buildGoogleAuthUrl(returnUrl: string, clinicId: string): string {
  const state = Buffer.from(JSON.stringify({ returnUrl, clinicId })).toString("base64");
  
  const googleAuthUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/auth/google/callback")}` +
    `&response_type=code` +
    `&scope=email%20profile` +
    `&state=${state}`;
  
  return googleAuthUrl;
}

/**
 * Exchange Google authorization code for access token
 */
export async function exchangeGoogleCode(code: string): Promise<string> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:
        process.env.GOOGLE_REDIRECT_URI ||
        "http://localhost:3001/auth/google/callback",
      grant_type: "authorization_code",
    }),
  });

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!tokenData.access_token) {
    throw new Error("Failed to get access token");
  }

  return tokenData.access_token;
}

/**
 * Get user info from Google using access token
 */
export async function getGoogleUserInfo(accessToken: string): Promise<{
  email?: string;
  given_name?: string;
  family_name?: string;
}> {
  const userInfoResponse = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return (await userInfoResponse.json()) as {
    email?: string;
    given_name?: string;
    family_name?: string;
  };
}

