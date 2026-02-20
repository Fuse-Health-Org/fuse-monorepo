/**
 * External client mocking utilities
 * Mocks for Stripe, AWS S3, SendGrid, and other external services
 */

/**
 * Mock Stripe client
 */
export const createMockStripeClient = () => ({
  customers: {
    create: jest.fn().mockResolvedValue({ id: 'cus_mock123' }),
    retrieve: jest.fn().mockResolvedValue({ id: 'cus_mock123' }),
    update: jest.fn().mockResolvedValue({ id: 'cus_mock123' }),
    del: jest.fn().mockResolvedValue({ id: 'cus_mock123', deleted: true }),
    list: jest.fn().mockResolvedValue({ data: [] }),
  },
  paymentIntents: {
    create: jest.fn().mockResolvedValue({ id: 'pi_mock123', status: 'succeeded' }),
    retrieve: jest.fn().mockResolvedValue({ id: 'pi_mock123', status: 'succeeded' }),
    update: jest.fn().mockResolvedValue({ id: 'pi_mock123' }),
    confirm: jest.fn().mockResolvedValue({ id: 'pi_mock123', status: 'succeeded' }),
    cancel: jest.fn().mockResolvedValue({ id: 'pi_mock123', status: 'canceled' }),
  },
  subscriptions: {
    create: jest.fn().mockResolvedValue({ id: 'sub_mock123', status: 'active' }),
    retrieve: jest.fn().mockResolvedValue({ id: 'sub_mock123', status: 'active' }),
    update: jest.fn().mockResolvedValue({ id: 'sub_mock123' }),
    cancel: jest.fn().mockResolvedValue({ id: 'sub_mock123', status: 'canceled' }),
    list: jest.fn().mockResolvedValue({ data: [] }),
  },
  prices: {
    create: jest.fn().mockResolvedValue({ id: 'price_mock123' }),
    retrieve: jest.fn().mockResolvedValue({ id: 'price_mock123' }),
    update: jest.fn().mockResolvedValue({ id: 'price_mock123' }),
    list: jest.fn().mockResolvedValue({ data: [] }),
  },
  products: {
    create: jest.fn().mockResolvedValue({ id: 'prod_mock123' }),
    retrieve: jest.fn().mockResolvedValue({ id: 'prod_mock123' }),
    update: jest.fn().mockResolvedValue({ id: 'prod_mock123' }),
    list: jest.fn().mockResolvedValue({ data: [] }),
  },
  refunds: {
    create: jest.fn().mockResolvedValue({ id: 'ref_mock123', status: 'succeeded' }),
    retrieve: jest.fn().mockResolvedValue({ id: 'ref_mock123', status: 'succeeded' }),
  },
});

/**
 * Mock AWS S3 client
 */
export const createMockS3Client = () => ({
  send: jest.fn().mockResolvedValue({ $metadata: { httpStatusCode: 200 } }),
  putObject: jest.fn().mockResolvedValue({ ETag: 'mock-etag' }),
  getObject: jest.fn().mockResolvedValue({ Body: Buffer.from('mock data') }),
  deleteObject: jest.fn().mockResolvedValue({}),
  listObjects: jest.fn().mockResolvedValue({ Contents: [] }),
  headObject: jest.fn().mockResolvedValue({ ContentLength: 1024 }),
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-signed-url.com'),
});

/**
 * Mock SendGrid client
 */
export const createMockSendGridClient = () => ({
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }, {}]),
  sendMultiple: jest.fn().mockResolvedValue([{ statusCode: 202 }, {}]),
  setApiKey: jest.fn(),
});

/**
 * Mock Google OAuth client
 */
export const createMockGoogleOAuthClient = () => ({
  verifyIdToken: jest.fn().mockResolvedValue({
    getPayload: jest.fn().mockReturnValue({
      sub: 'mock-google-user-id',
      email: 'test@example.com',
      email_verified: true,
      name: 'Test User',
      picture: 'https://mock-picture-url.com',
    }),
  }),
  setCredentials: jest.fn(),
  getToken: jest.fn().mockResolvedValue({ tokens: { access_token: 'mock-token' } }),
});

/**
 * Mock Axios instance
 */
export const createMockAxios = () => ({
  get: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
  post: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
  put: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
  patch: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
  delete: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
  request: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
  defaults: {
    headers: {
      common: {},
    },
  },
  interceptors: {
    request: {
      use: jest.fn(),
      eject: jest.fn(),
    },
    response: {
      use: jest.fn(),
      eject: jest.fn(),
    },
  },
});

/**
 * Mock PDFKit document
 */
export const createMockPDFDocument = () => ({
  text: jest.fn().mockReturnThis(),
  fontSize: jest.fn().mockReturnThis(),
  font: jest.fn().mockReturnThis(),
  image: jest.fn().mockReturnThis(),
  moveDown: jest.fn().mockReturnThis(),
  pipe: jest.fn().mockReturnThis(),
  end: jest.fn(),
  on: jest.fn((event, callback) => {
    if (event === 'end') {
      setTimeout(callback, 0);
    }
    return this;
  }),
});
