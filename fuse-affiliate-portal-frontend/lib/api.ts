// HIPAA-compliant API utilities
// Centralized API handling with proper error handling and security

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}

// Generic API call function with JWT token handling
export async function apiCall<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    // Get JWT token from localStorage
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;

    // Debug: Log token status for auth endpoints
    if (process.env.NODE_ENV === "development" && endpoint.includes("/auth/")) {
      console.log(`🔑 Preparing API call to ${endpoint}:`, {
        hasToken: !!token,
        tokenLength: token?.length,
        tokenPreview: token ? `${token.substring(0, 20)}...` : null,
      });
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    // Handle query params for GET requests
    let url = `${apiUrl}${endpoint}`;
    const fetchOptions = { ...options };
    
    // Extract params from options if they exist (for GET requests)
    if (fetchOptions.method === "GET" || !fetchOptions.method) {
      const params = (fetchOptions as any).params;
      if (params) {
        const urlParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            urlParams.append(key, String(value));
          }
        });
        if (urlParams.toString()) {
          url += `?${urlParams.toString()}`;
        }
        // Remove params from fetchOptions to avoid issues
        delete (fetchOptions as any).params;
      }
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...fetchOptions.headers,
      },
    });

    // Debug: Log request details for auth endpoints
    if (process.env.NODE_ENV === "development" && endpoint.includes("/auth/")) {
      console.log(`📤 Request to ${endpoint}:`, {
        hasToken: !!token,
        tokenLength: token?.length,
        method: fetchOptions.method || "GET",
        url,
        hasAuthHeader: !!(fetchOptions.headers as any)?.["Authorization"],
      });
    }

    const data = await response.json();

    // Debug: Log response for auth endpoints
    if (process.env.NODE_ENV === "development" && endpoint.includes("/auth/")) {
      console.log(`📥 Response from ${endpoint}:`, {
        status: response.status,
        ok: response.ok,
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
      });
    }

    if (!response.ok) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ API call failed with status", response.status, {
          endpoint,
          error: data.message || data.error,
          fullData: data,
        });
      }
      return {
        success: false,
        error: data.message || data.error || `Request failed with status ${response.status}`,
        data: data, // Include full response data for error handling
      };
    }

    // If this is a successful signin, store the token
    if (
      endpoint === "/auth/signin" &&
      response.ok &&
      typeof window !== "undefined"
    ) {
      // Check multiple possible locations for token
      const token = data.token || data.data?.token;
      if (token) {
        localStorage.setItem("auth-token", token);
        if (process.env.NODE_ENV === "development") {
          console.log("✅ Token stored in localStorage from signin response");
        }
      } else if (process.env.NODE_ENV === "development") {
        console.warn("⚠️ No token found in signin response:", {
          hasData: !!data,
          dataKeys: data ? Object.keys(data) : [],
          requiresMfa: data?.requiresMfa,
        });
      }
    }

    // If this is a signout, remove the token
    if (endpoint === "/auth/signout" && typeof window !== "undefined") {
      localStorage.removeItem("auth-token");
      if (process.env.NODE_ENV === "development") {
        console.log("✅ Token removed from localStorage");
      }
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    // Don't log the actual error - could contain PHI
    if (process.env.NODE_ENV === "development") {
      console.error("Network error on API call");
    }
    return {
      success: false,
      error: "Network error occurred. Please try again.",
    };
  }
}

// Specialized authentication API calls
export const authApi = {
  signIn: async (email: string, password: string) => {
    if (process.env.NODE_ENV === "development") {
      console.log("🔐 SignIn attempt");
    }
    const result = await apiCall("/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (process.env.NODE_ENV === "development") {
      console.log("🔐 SignIn result", { success: result.success });
    }
    return result;
  },

  // MFA verification endpoint
  verifyMfa: async (mfaToken: string, code: string) => {
    if (process.env.NODE_ENV === "development") {
      console.log("🔐 MFA verify attempt", {
        hasToken: !!mfaToken,
        tokenLength: mfaToken?.length,
        codeLength: code?.length,
        codeType: typeof code,
      });
    }
    
    // Ensure code is a string and trimmed
    const cleanCode = String(code).trim();
    
    const result = await apiCall("/auth/mfa/verify", {
      method: "POST",
      body: JSON.stringify({ mfaToken, code: cleanCode }),
    });
    
    if (process.env.NODE_ENV === "development") {
      console.log("🔐 MFA verify result", { 
        success: result.success,
        error: result.error,
        status: result.data?.expired ? 'expired' : result.data?.rateLimited ? 'rateLimited' : 'unknown',
      });
    }
    return result;
  },

  // MFA resend code endpoint
  resendMfaCode: async (mfaToken: string) => {
    if (process.env.NODE_ENV === "development") {
      console.log("🔐 MFA resend attempt");
    }
    const result = await apiCall("/auth/mfa/resend", {
      method: "POST",
      body: JSON.stringify({ mfaToken }),
    });
    if (process.env.NODE_ENV === "development") {
      console.log("🔐 MFA resend result", { success: result.success });
    }
    return result;
  },

  signOut: async () => apiCall("/auth/signout", { method: "POST" }),

  getUser: async () => apiCall("/auth/me"),

  refreshSession: async () => apiCall("/auth/refresh", { method: "POST" }),
};

