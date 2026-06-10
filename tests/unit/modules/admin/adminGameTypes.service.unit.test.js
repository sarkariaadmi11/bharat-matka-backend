describe('adminGameTypes.service', () => {
  let service;
  let mocks;

  const loadModule = () => {
    jest.resetModules();

    mocks = {
      gameTypeRepository: {
        findForAdminList: jest.fn(),
        findById: jest.fn(),
        findLeanById: jest.fn(),
        findByCode: jest.fn(),
        create: jest.fn(),
        updateById: jest.fn(),
      },
      writeAuditLog: jest.fn().mockResolvedValue(true),
    };

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repositories = {
            GameType: mocks.gameTypeRepository,
          };
          return repositories[name];
        },
      },
    }));

    jest.doMock('@modules/admin/logs/logs.service', () => ({
      writeAuditLog: mocks.writeAuditLog,
    }));

    service = require('@modules/admin/gameTypes/adminGameTypes.service');
  };

  beforeEach(() => {
    loadModule();
  });

  test('lists game types', async () => {
    mocks.gameTypeRepository.findForAdminList.mockResolvedValue([
      {
        _id: 'gt1',
        code: 'SINGLE',
        name: 'Single Digit',
        templateKey: 'SINGLE_DIGIT',
        rulesVersion: 1,
        payoutMultiplier: 9.5,
        minBet: 1,
        maxBet: 1000,
        betPhaseType: 'both',
        rules: { parts: [] },
        status: 'active',
      },
    ]);

    const result = await service.listGameTypes({});

    expect(result.gameTypes).toHaveLength(1);
    expect(result.gameTypes[0].code).toBe('SINGLE');
  });

  test('creates a game type', async () => {
    mocks.gameTypeRepository.findByCode.mockResolvedValue(null);
    mocks.gameTypeRepository.create.mockResolvedValue({
      _id: 'gt-new',
      code: 'SINGLE_ALIAS',
      name: 'Single Alias',
      templateKey: 'SINGLE_DIGIT',
      rulesVersion: 1,
      payoutMultiplier: 10,
      minBet: 5,
      maxBet: 5000,
      betPhaseType: 'both',
      rules: { parts: [] },
      status: 'active',
    });

    const result = await service.createGameType({
      payload: {
        code: 'SINGLE_ALIAS',
        name: 'Single Alias',
        templateKey: 'SINGLE_DIGIT',
        payoutMultiplier: 10,
        minBet: 5,
        maxBet: 5000,
        status: 'active',
      },
      adminUserId: 'admin1',
      req: {},
    });

    expect(mocks.gameTypeRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      code: 'SINGLE_ALIAS',
      name: 'Single Alias',
      templateKey: 'SINGLE_DIGIT',
    }));
    expect(result.code).toBe('SINGLE_ALIAS');
  });

  test('updates a game type', async () => {
    mocks.gameTypeRepository.findById.mockResolvedValueOnce({
      _id: 'gt1',
      code: 'SINGLE',
      name: 'Single Digit',
      minBet: 1,
      maxBet: 1000,
      status: 'active',
    });
    mocks.gameTypeRepository.updateById.mockResolvedValue({
      _id: 'gt1',
      code: 'SINGLE',
      name: 'Single Digit Updated',
      templateKey: 'SINGLE_DIGIT',
      rulesVersion: 2,
      payoutMultiplier: 10,
      minBet: 10,
      maxBet: 2000,
      betPhaseType: 'both',
      rules: { parts: [] },
      status: 'active',
    });

    const result = await service.updateGameType({
      id: 'gt1',
      payload: {
        name: 'Single Digit Updated',
        minBet: 10,
        maxBet: 2000,
        payoutMultiplier: 10,
      },
      adminUserId: 'admin1',
      req: {},
    });

    expect(mocks.gameTypeRepository.updateById).toHaveBeenCalledWith('gt1', expect.objectContaining({
      name: 'Single Digit Updated',
      minBet: 10,
      maxBet: 2000,
    }));
    expect(result.name).toBe('Single Digit Updated');
  });

  test('soft deletes a game type by marking it inactive', async () => {
    mocks.gameTypeRepository.findById
      .mockResolvedValueOnce({
        _id: 'gt1',
        code: 'SINGLE',
        status: 'active',
      })
      .mockResolvedValueOnce({
        _id: 'gt1',
        code: 'SINGLE',
        status: 'inactive',
      });
    mocks.gameTypeRepository.updateById.mockResolvedValue({
      _id: 'gt1',
      code: 'SINGLE',
      status: 'inactive',
    });

    const result = await service.deleteGameType({
      id: 'gt1',
      adminUserId: 'admin1',
      req: {},
    });

    expect(mocks.gameTypeRepository.updateById).toHaveBeenCalledWith('gt1', { status: 'inactive' });
    expect(result).toEqual({ gameTypeId: 'gt1', status: 'inactive' });
  });
});
