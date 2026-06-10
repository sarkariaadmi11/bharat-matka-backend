const mockAuthRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  updateRefreshToken: jest.fn(),
  findOneWithPassword: jest.fn(),
  updateLastLogin: jest.fn(),
  findByIdWithRefreshToken: jest.fn(),
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

const mockGenerateTokens = jest.fn(() => ({
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
}));

const mockHashToken = jest.fn((value) => `hashed-${value}`);
const mockJwtVerify = jest.fn();

let transactionSession;
let authService;

const loadModule = () => {
  jest.resetModules();

  transactionSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };

  jest.doMock('@infra/database', () => ({
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

  jest.doMock('@utils', () => ({
    generateTokens: mockGenerateTokens,
    hashToken: mockHashToken,
    toPaise: jest.fn((val) => val * 100),
  }));

  jest.doMock('mongoose', () => ({
    startSession: jest.fn().mockResolvedValue(transactionSession),
  }));

  jest.doMock('jsonwebtoken', () => ({
    verify: mockJwtVerify,
  }));

  authService = require('@modules/auth/auth.service');
};

describe('auth.service JWT claims', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadModule();
  });

  test('register builds tokens with both primary role and roles array', async () => {
    mockAuthRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockRoleRepository.findByCode.mockResolvedValue({ _id: 'role-user' });
    mockAuthRepository.create.mockResolvedValue({
      _id: 'user-1',
      username: 'demo',
      phone: '9999999999',
      status: 'active',
    });
    mockUserRoleRepository.assignRole.mockResolvedValue({});
    mockWalletRepository.create.mockResolvedValue({});
    mockGlobalConfigRepository.findOne.mockResolvedValue({ welcomeBonus: 5 });
    mockWalletRepository.creditBalance = jest.fn().mockResolvedValue({});
    mockUserRoleRepository.getRoleContextByUserId.mockResolvedValue({
      primaryRole: { code: 'USER' },
      roleCodes: ['USER'],
    });

    await authService.register({
      username: 'demo',
      phone: '9999999999',
      password: 'secret123',
    });

    expect(mockGenerateTokens).toHaveBeenCalledWith({
      _id: 'user-1',
      role: 'USER',
      roles: ['USER'],
    });
  });

  test('login builds normalized role claims from multi-role context', async () => {
    const user = {
      _id: 'admin-1',
      username: 'admin',
      phone: '9999999999',
      status: 'active',
      comparePassword: jest.fn().mockResolvedValue(true),
    };

    mockAuthRepository.findOneWithPassword.mockResolvedValue(user);
    mockUserRepository.checkSelfExclusion.mockResolvedValue({ excluded: false });
    mockAuthRepository.updateLastLogin.mockResolvedValue({});
    mockAuthRepository.updateRefreshToken.mockResolvedValue({});
    mockUserRoleRepository.getRoleContextByUserId.mockResolvedValue({
      primaryRole: { code: 'admin' },
      roleCodes: ['admin', 'superadmin'],
    });

    await authService.login('9999999999', 'secret123');

    expect(mockGenerateTokens).toHaveBeenCalledWith({
      _id: 'admin-1',
      role: 'ADMIN',
      roles: ['ADMIN', 'SUPERADMIN'],
    });
  });

  test('refresh preserves the same normalized role semantics', async () => {
    mockJwtVerify.mockReturnValue({ sub: 'user-1' });
    mockAuthRepository.findByIdWithRefreshToken.mockResolvedValue({
      _id: 'user-1',
      refreshTokenHash: 'hashed-refresh-token',
    });
    mockAuthRepository.updateRefreshToken.mockResolvedValue({});
    mockUserRoleRepository.getRoleContextByUserId.mockResolvedValue({
      primaryRole: { code: 'USER' },
      roleCodes: ['USER'],
    });

    await authService.refreshTokens('refresh-token');

    expect(mockGenerateTokens).toHaveBeenCalledWith({
      _id: 'user-1',
      role: 'USER',
      roles: ['USER'],
    });
  });
});
