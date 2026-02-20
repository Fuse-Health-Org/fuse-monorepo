/**
 * Authentication utilities for integration tests
 * Provides helpers for signing in and obtaining authentication tokens
 */

import axios from 'axios';

/**
 * Sign in with test credentials from environment variables
 * Returns the authentication token and user data
 */
export const signInWithTestCredentials = async (baseURL?: string): Promise<{
  token: string;
  user: any;
  sessionCookie?: string;
}> => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in environment variables'
    );
  }

  const apiUrl = baseURL || process.env.TEST_API_URL || 'http://localhost:3000';

  try {
    const response = await axios.post(
      `${apiUrl}/auth/login`,
      {
        email,
        password,
      },
      {
        withCredentials: true,
      }
    );

    const sessionCookie = response.headers['set-cookie']?.[0];

    return {
      token: response.data.token,
      user: response.data.user,
      sessionCookie,
    };
  } catch (error: any) {
    throw new Error(
      `Failed to sign in with test credentials: ${error.message}`
    );
  }
};

/**
 * Sign in with custom credentials
 * Useful for testing different user roles or scenarios
 */
export const signIn = async (
  email: string,
  password: string,
  baseURL?: string
): Promise<{
  token: string;
  user: any;
  sessionCookie?: string;
}> => {
  const apiUrl = baseURL || process.env.TEST_API_URL || 'http://localhost:3000';

  try {
    const response = await axios.post(
      `${apiUrl}/auth/login`,
      {
        email,
        password,
      },
      {
        withCredentials: true,
      }
    );

    const sessionCookie = response.headers['set-cookie']?.[0];

    return {
      token: response.data.token,
      user: response.data.user,
      sessionCookie,
    };
  } catch (error: any) {
    throw new Error(`Failed to sign in: ${error.message}`);
  }
};

/**
 * Create an authenticated axios instance with token
 */
export const createAuthenticatedClient = (token: string, baseURL?: string) => {
  const apiUrl = baseURL || process.env.TEST_API_URL || 'http://localhost:3000';

  return axios.create({
    baseURL: apiUrl,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    withCredentials: true,
  });
};

/**
 * Create an authenticated axios instance with session cookie
 */
export const createAuthenticatedClientWithCookie = (
  sessionCookie: string,
  baseURL?: string
) => {
  const apiUrl = baseURL || process.env.TEST_API_URL || 'http://localhost:3000';

  return axios.create({
    baseURL: apiUrl,
    headers: {
      Cookie: sessionCookie,
    },
    withCredentials: true,
  });
};

/**
 * Get authentication headers for supertest requests
 */
export const getAuthHeaders = (token: string) => {
  return {
    Authorization: `Bearer ${token}`,
  };
};

/**
 * Get session cookie header for supertest requests
 */
export const getSessionCookieHeader = (sessionCookie: string) => {
  return {
    Cookie: sessionCookie,
  };
};
