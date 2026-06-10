const mockAuthRepository = {
  findOne: jest.fn(),
  findOneWithPassword: jest.fn(),
  updatePassword: jest.fn(),
  clearRefreshToken: jest.fn(),
  findById: jest.fn(),
};

const mockUserRepository = {
  checkSelfExclusion: jest.fn(),
};

const mockWalletRepository = {
  create: jest.fn(),
};

const mockRoleRepository = {
  findByCode: jest.fn(),
};

const mockUserRoleRepository = {
  assignRole: jest.fn(),
  getRoleContextByUserId: jest.fn(),
};

const mockGlobalConfigRepository = {
  findOne: jest.fn(),
};

const mockTransactionRepository = {
  recordDeposit: jest.fn(),
};

jest.mock('@infra/database', () => ({
  RepositoryFactory: {
    getRepository: jest.fn((name) => {
      switch (name) {
        case 'Auth':
          return mockAuthRepository;
        case 'User':
          return mockUserRepository;
        case 'Wallet':
          return mockWalletRepository;
        case 'Role':
          return mockRoleRepository;
        case 'UserRole':
          return mockUserRoleRepository;
        case 'GlobalConfig':
          return mockGlobalConfigRepository;
        case 'Transaction':
          return mockTransactionRepository;
        default:
          throw new Error(`Unexpected repository: ${name}`);
      }
    }),
  },
}));

jest.mock('@utils', () => ({
  generateTokens: jest.fn(() => ({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  })),
  hashToken: jest.fn((value) => `hashed-${value}`),
}));

jest.mock('mongoose', () => ({
  startSession: jest.fn(),
}));

const authService = require('@modules/auth/auth.service');

describe('auth.service.changePassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('changes password and invalidates refresh tokens', async () => {
    const user = {
      _id: 'user-1',
      password: 'hashed-password',
      comparePassword: jest.fn().mockResolvedValue(true),
    };
    mockAuthRepository.findOneWithPassword.mockResolvedValue(user);
    mockAuthRepository.updatePassword.mockResolvedValue({});
    mockAuthRepository.clearRefreshToken.mockResolvedValue({});

    await expect(
      authService.changePassword('user-1', 'old-secret', 'new-secret'),
    ).resolves.toEqual({
      message: 'Password changed successfully. Please login again.',
    });

    expect(mockAuthRepository.findOneWithPassword).toHaveBeenCalledWith({ _id: 'user-1' });
    expect(user.comparePassword).toHaveBeenCalledWith('old-secret');
    expect(mockAuthRepository.updatePassword).toHaveBeenCalledWith('user-1', 'new-secret');
    expect(mockAuthRepository.clearRefreshToken).toHaveBeenCalledWith('user-1');
  });

  test('returns a structured 401 error when current password is wrong', async () => {
    const user = {
      _id: 'user-1',
      comparePassword: jest.fn().mockResolvedValue(false),
    };
    mockAuthRepository.findOneWithPassword.mockResolvedValue(user);

    await expect(
      authService.changePassword('user-1', 'bad-secret', 'new-secret'),
    ).rejects.toMatchObject({
      message: 'Current password is incorrect',
      statusCode: 401,
    });
  });

  test('returns a structured 404 error when the user does not exist', async () => {
    mockAuthRepository.findOneWithPassword.mockResolvedValue(null);

    await expect(
      authService.changePassword('missing-user', 'old-secret', 'new-secret'),
    ).rejects.toMatchObject({
      message: 'User not found',
      statusCode: 404,
    });
  });
});
