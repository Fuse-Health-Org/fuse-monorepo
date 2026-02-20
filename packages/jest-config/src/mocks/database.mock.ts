/**
 * Database mocking utilities for unit tests
 * These mocks are used to simulate database operations without actual DB connections
 */

export const createMockSequelize = () => ({
  authenticate: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  sync: jest.fn().mockResolvedValue(undefined),
  transaction: jest.fn().mockImplementation(async (callback) => {
    const mockTransaction = {
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    return callback(mockTransaction);
  }),
  define: jest.fn(),
  model: jest.fn(),
  models: {},
});

export const createMockModel = <T = any>(modelName: string) => ({
  name: modelName,
  findAll: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  findByPk: jest.fn().mockResolvedValue(null),
  findOrCreate: jest.fn().mockResolvedValue([null, false]),
  create: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue([0]),
  destroy: jest.fn().mockResolvedValue(0),
  count: jest.fn().mockResolvedValue(0),
  bulkCreate: jest.fn().mockResolvedValue([]),
  build: jest.fn().mockImplementation((data: T) => ({
    ...data,
    save: jest.fn().mockResolvedValue(data),
    update: jest.fn().mockResolvedValue(data),
    destroy: jest.fn().mockResolvedValue(undefined),
    reload: jest.fn().mockResolvedValue(data),
    get: jest.fn().mockReturnValue(data),
    toJSON: jest.fn().mockReturnValue(data),
  })),
});

export const createMockTransaction = () => ({
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
  LOCK: {
    UPDATE: 'UPDATE',
    SHARE: 'SHARE',
  },
});

export const createMockQueryInterface = () => ({
  createTable: jest.fn().mockResolvedValue(undefined),
  dropTable: jest.fn().mockResolvedValue(undefined),
  addColumn: jest.fn().mockResolvedValue(undefined),
  removeColumn: jest.fn().mockResolvedValue(undefined),
  changeColumn: jest.fn().mockResolvedValue(undefined),
  renameColumn: jest.fn().mockResolvedValue(undefined),
  addIndex: jest.fn().mockResolvedValue(undefined),
  removeIndex: jest.fn().mockResolvedValue(undefined),
  bulkInsert: jest.fn().mockResolvedValue(undefined),
  bulkDelete: jest.fn().mockResolvedValue(undefined),
});
