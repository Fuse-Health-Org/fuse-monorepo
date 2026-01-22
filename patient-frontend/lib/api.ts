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

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api";

    const response = await fetch(`${apiUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ API call failed with status", response.status);
      }
      return {
        success: false,
        error: data.message || `Request failed with status ${response.status}`,
      };
    }

    // If this is a successful signin, store the token
    if (
      endpoint === "/auth/signin" &&
      data.token &&
      typeof window !== "undefined"
    ) {
      localStorage.setItem("auth-token", data.token);
      if (process.env.NODE_ENV === "development") {
        console.log("✅ Token stored in localStorage");
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
      console.log("🔐 MFA verify attempt");
    }
    const result = await apiCall("/auth/mfa/verify", {
      method: "POST",
      body: JSON.stringify({ mfaToken, code }),
    });
    if (process.env.NODE_ENV === "development") {
      console.log("🔐 MFA verify result", { success: result.success });
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

  signUp: async (userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: "patient" | "provider";
    dateOfBirth?: string;
    phoneNumber?: string;
    clinicName?: string;
  }) =>
    apiCall("/auth/signup", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  signOut: async () => apiCall("/auth/signout", { method: "POST" }),

  getUser: async () => apiCall("/auth/me"),

  refreshSession: async () => apiCall("/auth/refresh", { method: "POST" }),

  updateProfile: async (profileData: {
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    dob?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  }) =>
    apiCall("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    }),

  changePassword: async (currentPassword: string, newPassword: string) =>
    apiCall("/users/profile", {
      method: "PUT",
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    }),
};

// Generic data fetching with automatic error handling
export async function fetchWithAuth<T>(endpoint: string): Promise<T | null> {
  const result = await apiCall<T>(endpoint);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.data || null;
}

// Upload file function (for chat attachments)
export async function uploadFile(file: File): Promise<
  ApiResponse<{
    url: string;
    fileName: string;
    contentType: string;
    size: number;
  }>
> {
  try {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api";

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${apiUrl}/patient/chat/upload-file`, {
      method: "POST",
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        // No Content-Type header - browser sets it automatically with boundary for FormData
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ File upload failed with status", response.status);
      } else {
        console.error("❌ File upload failed");
      }
      return {
        success: false,
        error: data.message || `Upload failed with status ${response.status}`,
      };
    }

    return {
      success: true,
      data: data.data,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Network error on file upload");
    }
    return {
      success: false,
      error: "Network error occurred during upload. Please try again.",
    };
  }
}
