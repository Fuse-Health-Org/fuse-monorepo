/**
 * General test utilities and helpers
 * Provides common functions for testing
 */

/**
 * Wait for a specified amount of time
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Retry a function until it succeeds or max attempts reached
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<T> => {
  const { maxAttempts = 3, delay = 1000, onRetry } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      if (onRetry) {
        onRetry(attempt, error);
      }

      await wait(delay);
    }
  }

  throw new Error('Retry failed');
};

/**
 * Generate a random email for testing
 */
export const randomEmail = (prefix: string = 'test'): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${prefix}.${timestamp}.${random}@example.com`;
};

/**
 * Generate a random phone number for testing
 */
export const randomPhoneNumber = (): string => {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const prefix = Math.floor(Math.random() * 900) + 100;
  const lineNumber = Math.floor(Math.random() * 9000) + 1000;
  return `${areaCode}-${prefix}-${lineNumber}`;
};

/**
 * Deep clone an object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Check if two objects are deeply equal
 */
export const deepEqual = (obj1: any, obj2: any): boolean => {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
};

/**
 * Extract error message from various error types
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error';
};

/**
 * Wait for a condition to be true
 */
export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
  } = {}
): Promise<void> => {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await wait(interval);
  }

  throw new Error('Condition not met within timeout');
};

/**
 * Suppress console output during a function execution
 */
export const suppressConsole = async <T>(fn: () => Promise<T>): Promise<T> => {
  const originalConsole = { ...console };

  global.console.log = jest.fn();
  global.console.info = jest.fn();
  global.console.warn = jest.fn();
  global.console.error = jest.fn();

  try {
    return await fn();
  } finally {
    global.console = originalConsole as any;
  }
};

/**
 * Create a mock file object for testing file uploads
 */
export const createMockFile = (
  filename: string,
  content: string = 'test content',
  mimeType: string = 'text/plain'
) => {
  return {
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype: mimeType,
    buffer: Buffer.from(content),
    size: content.length,
  };
};
