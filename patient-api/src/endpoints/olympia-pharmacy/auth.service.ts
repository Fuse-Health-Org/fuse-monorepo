import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Olympia Pharmacy API Authentication Service
 * 
 * Handles authentication with Olympia Pharmacy API using username, password, and secret.
 * Tokens are valid for 24 hours and are automatically cached and refreshed.
 * Tokens are persisted to a JSON file for durability across server restarts.
 */

interface OlympiaAuthResponse {
  token: string;
  expires: string; // Format: "2024-08-21 23:53:10"
}

interface CachedToken {
  token: string;
  expiresAt: string; // ISO date string
  storedAt: string;  // ISO date string - when the token was stored
  expiresAtFormatted: string; // dd-mm-yyyyThh:mm:ss format
  storedAtFormatted: string;  // dd-mm-yyyyThh:mm:ss format
}

class OlympiaPharmacyAuthService {
  private cachedToken: CachedToken | null = null;
  private readonly BASE_URL: string;
  private readonly USERNAME: string;
  private readonly PASSWORD: string;
  private readonly SECRET: string;
  private readonly TOKEN_CACHE_FILE: string;

  constructor() {
    // Load credentials from environment variables
    this.BASE_URL = process.env.OLYMPIA_PHARMACY_API_URL || '';
    this.USERNAME = process.env.OLYMPIA_PHARMACY_USERNAME || '';
    this.PASSWORD = process.env.OLYMPIA_PHARMACY_PASSWORD || '';
    this.SECRET = process.env.OLYMPIA_PHARMACY_SECRET || '';

    // Set cache file path - store in temp directory
    const tempDir = path.join(process.cwd(), 'temp');
    this.TOKEN_CACHE_FILE = path.join(tempDir, 'olympia-pharmacy-token.json');

    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    if (!this.BASE_URL || !this.USERNAME || !this.PASSWORD || !this.SECRET) {
      console.warn('⚠️ Olympia Pharmacy API credentials not fully configured');
    }

    // Load cached token from file on initialization
    this.loadTokenFromFile();
  }

  /**
   * Format date to dd-mm-yyyyThh:mm:ss
   */
  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${day}-${month}-${year}T${hours}:${minutes}:${seconds}`;
  }

  /**
   * Load cached token from JSON file
   */
  private loadTokenFromFile(): void {
    try {
      if (fs.existsSync(this.TOKEN_CACHE_FILE)) {
        const fileContent = fs.readFileSync(this.TOKEN_CACHE_FILE, 'utf-8');
        this.cachedToken = JSON.parse(fileContent);
        console.log('📂 Loaded Olympia Pharmacy token from cache file (stored at:', this.cachedToken?.storedAtFormatted || this.cachedToken?.storedAt, ')');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load cached token from file:', error);
      this.cachedToken = null;
    }
  }

  /**
   * Save token to JSON file
   */
  private saveTokenToFile(token: CachedToken): void {
    try {
      fs.writeFileSync(
        this.TOKEN_CACHE_FILE,
        JSON.stringify(token, null, 2),
        'utf-8'
      );
      console.log('💾 Saved Olympia Pharmacy token to cache file');
    } catch (error) {
      console.error('❌ Failed to save token to file:', error);
    }
  }

  /**
   * Check if the current cached token is still valid
   */
  private isTokenValid(): boolean {
    if (!this.cachedToken) {
      return false;
    }

    // Add a 5-minute buffer before expiration to avoid edge cases
    const bufferMs = 5 * 60 * 1000;
    const now = new Date();
    const expiresAt = new Date(this.cachedToken.expiresAt);
    return expiresAt.getTime() - now.getTime() > bufferMs;
  }

  /**
   * Request a new access token from Olympia Pharmacy API
   */
  private async requestNewToken(): Promise<string> {
    try {
      console.log('🔐 Requesting new Olympia Pharmacy access token...');

      // Prepare form data for x-www-form-urlencoded request
      const params = new URLSearchParams();
      params.append('username', this.USERNAME);
      params.append('password', this.PASSWORD);
      params.append('secret', this.SECRET);

      const response = await axios.post<OlympiaAuthResponse>(
        `${this.BASE_URL}/api/v2/accessToken`,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { token, expires } = response.data;

      // Parse expiration date (format: "2024-08-21 23:53:10")
      const expiresAt = new Date(expires);
      const storedAt = new Date();

      // Cache the token
      this.cachedToken = {
        token,
        expiresAt: expiresAt.toISOString(),
        storedAt: storedAt.toISOString(),
        expiresAtFormatted: this.formatDate(expiresAt),
        storedAtFormatted: this.formatDate(storedAt),
      };

      // Save to file
      this.saveTokenToFile(this.cachedToken);

      console.log('✅ Olympia Pharmacy access token obtained, expires at:', expires, 'stored at:', this.cachedToken.storedAtFormatted);

      return token;
    } catch (error) {
      console.error('❌ Failed to obtain Olympia Pharmacy access token:', error);
      throw new Error('Failed to authenticate with Olympia Pharmacy API');
    }
  }

  /**
   * Get a valid access token (cached or new)
   * This is the main method to use when making API requests
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.isTokenValid() && this.cachedToken) {
      return this.cachedToken.token;
    }

    // Request a new token
    return await this.requestNewToken();
  }

  /**
   * Force refresh the access token
   * Useful when you get a 401 response and need to refresh immediately
   */
  async refreshToken(): Promise<string> {
    this.cachedToken = null; // Clear cached token
    return await this.requestNewToken();
  }

  /**
   * Clear the cached token (useful for testing or logout scenarios)
   */
  clearToken(): void {
    this.cachedToken = null;
    
    // Delete the cache file
    try {
      if (fs.existsSync(this.TOKEN_CACHE_FILE)) {
        fs.unlinkSync(this.TOKEN_CACHE_FILE);
        console.log('🗑️ Olympia Pharmacy access token cleared from cache file');
      }
    } catch (error) {
      console.warn('⚠️ Failed to delete token cache file:', error);
    }
    
    console.log('🗑️ Olympia Pharmacy access token cleared');
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return !!(this.BASE_URL && this.USERNAME && this.PASSWORD && this.SECRET);
  }

  /**
   * Get an authenticated axios instance with Bearer token
   * This is a convenience method for making API requests
   */
  async getAuthenticatedClient() {
    const token = await this.getAccessToken();

    return axios.create({
      baseURL: this.BASE_URL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }
}

// Export singleton instance
export const olympiaPharmacyAuthService = new OlympiaPharmacyAuthService();
