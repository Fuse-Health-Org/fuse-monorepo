import { apiCall } from "../../lib/api";

export interface SignInResult {
  success: boolean;
  userData?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  error?: string;
}

/**
 * Sign in user with email and password
 */
export const signInUser = async (
  email: string,
  password: string
): Promise<SignInResult> => {
  try {
    console.log('🔐 Signing in with email:', email);

    const result = await apiCall('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password
      })
    });

    if (result.success && result.data) {
      console.log('✅ Sign-in successful:', result.data);

      // Extract user data from response
      const userData = result.data.user || result.data;

      return {
        success: true,
        userData: {
          id: userData.id,
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || email,
          phoneNumber: userData.phoneNumber || ''
        }
      };
    } else {
      // Handle specific error messages from the API
      const errorData = result.data || result;

      if (errorData?.needsActivation) {
        return {
          success: false,
          error: 'Please check your email and activate your account before signing in.'
        };
      }

      if (errorData?.message) {
        return {
          success: false,
          error: errorData.message
        };
      }

      return {
        success: false,
        error: 'Invalid email or password. Please try again.'
      };
    }
  } catch (error: any) {
    console.error('❌ Sign-in error:', error);

    // Handle network or API errors
    if (error?.message?.includes('401')) {
      return {
        success: false,
        error: 'Invalid email or password. Please check your credentials.'
      };
    }

    if (error?.message?.includes('404')) {
      return {
        success: false,
        error: 'Sign-in service not available. Please try again later.'
      };
    }

    return {
      success: false,
      error: 'Failed to sign in. Please check your internet connection and try again.'
    };
  }
};

/**
 * Create a new user account
 */
export const createUserAccount = async (
  firstName: string,
  lastName: string,
  email: string,
  phoneNumber: string,
  clinicId?: string,
  dob?: string,
  gender?: string
): Promise<{ success: boolean; userId?: string; error?: string }> => {
  try {
    console.log('🔐 Creating user account with data:', {
      firstName,
      lastName,
      email,
      phoneNumber,
      dob,
      gender
    });

    const signupPayload: any = {
      firstName,
      lastName,
      email,
      phoneNumber,
      password: Math.random().toString(36).slice(-12) + 'Aa1!', // Generate stronger password
      role: 'patient', // Backend automatically creates UserRoles entry with patient: true
      clinicId: clinicId || null
    };

    // Add dob and gender if provided
    if (dob) {
      signupPayload.dob = dob;
    }
    if (gender) {
      signupPayload.gender = gender;
    }

    const result = await apiCall('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(signupPayload)
    });

    if (result.success && result.data) {
      const userId = result.data.userId || result.data.id;
      console.log('✅ User account created:', userId);
      return { success: true, userId };
    } else {
      // If account creation failed (likely duplicate email), that's okay
      console.log('ℹ️ Account creation failed (likely duplicate), will use existing account at payment');
      return { success: true }; // Return success anyway, will be handled at payment
    }
  } catch (error) {
    console.error('❌ Failed to create user account:', error);
    return { success: false, error: 'Failed to create account' };
  }
};

/**
 * Send verification code to email
 */
export const sendVerificationCode = async (
  email: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('📧 Sending verification code to:', email);

    const result = await apiCall('/auth/send-verification-code', {
      method: 'POST',
      body: JSON.stringify({ email })
    });

    if (result.success) {
      console.log('✅ Verification code sent successfully');
      return { success: true };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to send verification code'
      };
    }
  } catch (error: any) {
    console.error('❌ Send verification code error:', error);
    return {
      success: false,
      error: 'Failed to send verification code. Please try again.'
    };
  }
};

/**
 * Verify email code
 */
export const verifyCode = async (
  email: string,
  code: string
): Promise<{
  success: boolean;
  isExistingUser?: boolean;
  userData?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  email?: string;
  error?: string;
}> => {
  try {
    console.log('🔐 Verifying code for:', email);

    const result = await apiCall('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code })
    });

    if (result.success && result.data) {
      console.log('✅ Code verified successfully:', result.data);

      if (result.data.isExistingUser && result.data.user) {
        // Existing user - return their data
        const userData = result.data.user;
        return {
          success: true,
          isExistingUser: true,
          userData: {
            id: userData.id,
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            email: userData.email || email,
            phoneNumber: userData.phoneNumber || ''
          }
        };
      } else {
        // New user - just verified email
        return {
          success: true,
          isExistingUser: false,
          email: result.data.email || email
        };
      }
    } else {
      return {
        success: false,
        error: result.error || 'Invalid verification code'
      };
    }
  } catch (error: any) {
    console.error('❌ Verify code error:', error);

    if (error?.message?.includes('401')) {
      return {
        success: false,
        error: 'Invalid or expired verification code'
      };
    }

    return {
      success: false,
      error: 'Verification failed. Please try again.'
    };
  }
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (
  credential: string,
  clinicId?: string
): Promise<SignInResult> => {
  try {
    console.log('🔐 Signing in with Google');

    const result = await apiCall('/auth/google', {
      method: 'POST',
      body: JSON.stringify({
        credential,
        clinicId: clinicId || null
      })
    });

    if (result.success && result.data) {
      console.log('✅ Google sign-in successful:', result.data);

      // Extract user data from response
      const userData = result.data.user || result.data;

      return {
        success: true,
        userData: {
          id: userData.id,
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || '',
          phoneNumber: userData.phoneNumber || ''
        }
      };
    } else {
      return {
        success: false,
        error: result.error || 'Google sign-in failed'
      };
    }
  } catch (error: any) {
    console.error('❌ Google sign-in error:', error);
    return {
      success: false,
      error: 'Failed to sign in with Google. Please try again.'
    };
  }
};

