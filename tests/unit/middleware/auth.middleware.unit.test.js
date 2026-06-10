let requireAuth;
let requireAdmin;
let authorize;

const mockJwtVerify = jest.fn();
const mockUserRepository = {
  findById: jest.fn(),
};
const mockUserRoleRepository = {
  getRoleContextByUserId: jest.fn(),
};
const mockRolePermissionRepository = {
  getPermissionCodesByRoleIds: jest.fn(),
};

const loadModule = () => {
  jest.resetModules();

  jest.doMock('jsonwebtoken', () => ({
    verify: mockJwtVerify,
  }));

  jest.doMock('@infra/database', () => ({
    RepositoryFactory: {
      getRepository: (name) => {
        const repoMap = {
          User: mockUserRepository,
          UserRole: mockUserRoleRepository,
          RolePermission: mockRolePermissionRepository,
        };

        return repoMap[name];
      },
    },
  }));

  ({
    requireAuth,
    requireAdmin,
    authorize,
  } = require('@middleware/auth'));
};

const invoke = async (middleware, req) => {
  const next = jest.fn();
  await middleware(req, {}, next);
  return next;
};

describe('auth middleware role resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadModule();

    mockUserRepository.findById.mockResolvedValue({
      _id: 'user-1',
      status: 'active',
      deletedAt: null,
      isVerified: true,
    });
    mockUserRoleRepository.getRoleContextByUserId.mockResolvedValue({
      primaryRole: null,
      roles: [],
      roleCodes: [],
    });
    mockRolePermissionRepository.getPermissionCodesByRoleIds.mockResolvedValue([]);
  });

  test('authorizes admin route with roles claim and normalizes uppercase values', async () => {
    const req = {
      headers: {
        authorization: 'Bearer token-1',
      },
    };
    mockJwtVerify.mockReturnValue({
      sub: 'user-1',
      roles: ['admin'],
    });

    const authNext = await invoke(requireAuth, req);
    const adminNext = await invoke(requireAdmin, req);

    expect(authNext).toHaveBeenCalledWith();
    expect(req.user.role).toBe('ADMIN');
    expect(req.user.roles).toEqual(['ADMIN']);
    expect(adminNext).toHaveBeenCalledWith();
  });

  test('authorizes admin route with single role claim fallback', async () => {
    const req = {
      headers: {
        authorization: 'Bearer token-2',
      },
    };
    mockJwtVerify.mockReturnValue({
      sub: 'user-1',
      role: 'ADMIN',
    });

    await invoke(requireAuth, req);
    const adminNext = await invoke(requireAdmin, req);

    expect(req.user.role).toBe('ADMIN');
    expect(req.user.roles).toEqual(['ADMIN']);
    expect(adminNext).toHaveBeenCalledWith();
  });

  test('allows SUPERADMIN through centralized authorization using normalized role set', async () => {
    const req = {
      headers: {
        authorization: 'Bearer token-3',
      },
    };
    mockJwtVerify.mockReturnValue({
      sub: 'user-1',
      roles: ['superadmin'],
    });

    await invoke(requireAuth, req);
    const permissionNext = await invoke(authorize({ anyPermission: ['RESULT_DECLARE'] }), req);

    expect(req.user.roles).toEqual(['SUPERADMIN']);
    expect(permissionNext).toHaveBeenCalledWith();
  });

  test('rejects non-admin users for admin route', async () => {
    const req = {
      headers: {
        authorization: 'Bearer token-4',
      },
    };
    mockJwtVerify.mockReturnValue({
      sub: 'user-1',
      roles: ['USER'],
    });

    await invoke(requireAuth, req);
    const adminNext = await invoke(requireAdmin, req);

    expect(adminNext).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Admin access required',
      }),
    );
  });
});
