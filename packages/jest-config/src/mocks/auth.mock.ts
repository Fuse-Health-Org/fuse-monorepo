/**
 * Authentication mocking utilities
 * Provides helpers for mocking JWT tokens, sessions, and authenticated requests
 */

import type { Request, Response, NextFunction } from 'express';

export const createMockJWTToken = (userId: string, role: string = 'patient'): string => {
  // Return a mock JWT token (not a real token, just for testing)
  return `mock.jwt.token.${userId}.${role}`;
};

export const createMockAuthenticatedRequest = (user: any): any => ({
  user,
  session: {
    userId: user.id,
    cookie: {
      maxAge: 86400000,
      originalMaxAge: 86400000,
    },
    regenerate: jest.fn((cb) => cb(null)),
    destroy: jest.fn((cb) => cb(null)),
    reload: jest.fn((cb) => cb(null)),
    save: jest.fn((cb) => cb(null)),
    touch: jest.fn(),
    resetMaxAge: jest.fn(),
    id: 'mock-session-id',
  },
  isAuthenticated: jest.fn().mockReturnValue(true),
  headers: {},
  get: jest.fn((header: string) => undefined),
  header: jest.fn((header: string) => undefined),
});

export const createMockRequest = (overrides: any = {}): any => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  get: jest.fn((header: string) => undefined),
  header: jest.fn((header: string) => undefined),
  ...overrides,
});

export const createMockResponse = (): Partial<Response> => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    sendStatus: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    locals: {},
  };
  return res;
};

export const createMockNext = (): NextFunction => {
  return jest.fn();
};

/**
 * Mock authentication middleware that sets req.user
 */
export const createMockAuthMiddleware = (user: any) => {
  return (req: any, res: any, next: any) => {
    req.user = user;
    req.session = {
      userId: user.id,
    };
    next();
  };
};

/**
 * Mock session object
 */
export const createMockSession = (userId?: string) => ({
  id: 'mock-session-id',
  userId,
  cookie: {
    maxAge: 86400000,
    originalMaxAge: 86400000,
    secure: false,
    httpOnly: true,
  },
  regenerate: jest.fn((cb) => cb(null)),
  destroy: jest.fn((cb) => cb(null)),
  reload: jest.fn((cb) => cb(null)),
  save: jest.fn((cb) => cb(null)),
  touch: jest.fn(),
  resetMaxAge: jest.fn(),
});
