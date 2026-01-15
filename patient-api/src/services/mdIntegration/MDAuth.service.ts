import axios from 'axios';
import { mdIntegrationsConfig, resolveMdIntegrationsBaseUrl } from './config';

interface TokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
}

interface TokenRequest {
  grant_type: string;
  client_id: string;
  client_secret: string;
  scope: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

class MDAuthService {
  private cachedToken: CachedToken | null = null;

  /**
   * Generate or return cached MD Integrations access token
   * Token is cached until it expires (with 60 second buffer for safety)
   */
  async generateToken(): Promise<TokenResponse> {
    // Check if we have a valid cached token
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60000) {
      // Return cached token (with 60 second buffer before expiry)
      return {
        token_type: 'Bearer',
        expires_in: Math.floor((this.cachedToken.expiresAt - Date.now()) / 1000),
        access_token: this.cachedToken.token,
      };
    }

    // Generate new token
    const requestBody: TokenRequest = {
      grant_type: 'client_credentials',
      client_id: mdIntegrationsConfig.clientId,
      client_secret: mdIntegrationsConfig.clientSecret,
      scope: mdIntegrationsConfig.scope
    };

    const response = await axios.post<TokenResponse>(
      resolveMdIntegrationsBaseUrl('/partner/auth/token'),
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Cache the token
    const expiresIn = response.data.expires_in || 3600; // Default to 1 hour if not provided
    this.cachedToken = {
      token: response.data.access_token,
      expiresAt: Date.now() + (expiresIn * 1000), // Convert seconds to milliseconds
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('[MD-AUTH] Token generated and cached, expires in', expiresIn, 'seconds');
    }

    return response.data;
  }

  /**
   * Clear cached token (useful for testing or when credentials change)
   */
  clearCache(): void {
    this.cachedToken = null;
  }
}

export default new MDAuthService();