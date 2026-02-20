/**
 * Re-export jest-mock-extended utilities for easy access
 * jest-mock-extended provides type-safe mocks with excellent TypeScript support
 */

export { mock, mockDeep, mockReset, mockClear } from 'jest-mock-extended';
export type { DeepMockProxy, MockProxy } from 'jest-mock-extended';

/**
 * Example usage:
 *
 * import { mock, mockDeep } from '@fuse/jest-config';
 * import { UserService } from '../services/user.service';
 *
 * // Create a type-safe mock
 * const mockUserService = mock<UserService>();
 * mockUserService.findById.mockResolvedValue(user);
 *
 * // Create a deep mock (mocks all nested properties)
 * const mockSequelize = mockDeep<Sequelize>();
 * mockSequelize.models.User.findByPk.mockResolvedValue(user);
 */
