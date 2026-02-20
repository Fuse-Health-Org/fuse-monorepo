/**
 * Model instance factory for creating mock model instances
 * Provides helpers for creating test data that mimics Sequelize model instances
 */

interface ModelInstance<T> {
  get: (key?: keyof T) => any;
  set: (key: keyof T, value: any) => void;
  save: jest.Mock;
  update: jest.Mock;
  destroy: jest.Mock;
  reload: jest.Mock;
  toJSON: () => T;
  [key: string]: any;
}

/**
 * Create a mock model instance that behaves like a Sequelize model
 */
export const createModelInstance = <T extends Record<string, any>>(
  data: T,
  methods: Record<string, jest.Mock> = {}
): ModelInstance<T> => {
  const instance: any = {
    ...data,
    get: jest.fn((key?: keyof T) => {
      if (key) return data[key];
      return data;
    }),
    set: jest.fn((key: keyof T, value: any) => {
      data[key] = value;
    }),
    save: jest.fn().mockResolvedValue(data),
    update: jest.fn().mockResolvedValue(data),
    destroy: jest.fn().mockResolvedValue(undefined),
    reload: jest.fn().mockResolvedValue(data),
    toJSON: jest.fn().mockReturnValue(data),
    ...methods,
  };

  return instance;
};

/**
 * Create a collection of mock model instances
 */
export const createModelCollection = <T extends Record<string, any>>(
  dataArray: T[],
  methods: Record<string, jest.Mock> = {}
): ModelInstance<T>[] => {
  return dataArray.map((data: T) => createModelInstance(data, methods));
};

/**
 * Mock Sequelize query result helpers
 */
export const mockFindResult = <T>(data: T | null) => {
  if (!data) return null;
  return createModelInstance(data);
};

export const mockFindAllResult = <T extends Record<string, any>>(dataArray: T[]) => {
  return createModelCollection(dataArray);
};

export const mockCreateResult = <T extends Record<string, any>>(data: T) => {
  return createModelInstance(data);
};

export const mockUpdateResult = (affectedRows: number = 1) => {
  return [affectedRows];
};

export const mockDestroyResult = (deletedRows: number = 1) => {
  return deletedRows;
};

export const mockCountResult = (count: number) => {
  return count;
};

/**
 * Mock Sequelize transaction helpers
 */
export const mockSuccessfulTransaction = () => ({
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
  LOCK: {
    UPDATE: 'UPDATE',
    SHARE: 'SHARE',
  },
});

export const mockFailedTransaction = () => ({
  commit: jest.fn().mockRejectedValue(new Error('Transaction failed')),
  rollback: jest.fn().mockResolvedValue(undefined),
  LOCK: {
    UPDATE: 'UPDATE',
    SHARE: 'SHARE',
  },
});
