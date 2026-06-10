describe('adminMarkets.service', () => {
  let service;
  let mocks;
  const weeklySchedule = (value = true) => ({
    mon: value,
    tue: value,
    wed: value,
    thu: value,
    fri: value,
    sat: value,
    sun: value,
  });

  const loadModule = () => {
    jest.resetModules();

    mocks = {
      marketRepository: {
        findByIdWithGameTypes: jest.fn(),
        findByCode: jest.fn(),
        findAllWithGameTypes: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      gameTypeRepository: {
        findForAdminList: jest.fn(),
      },
      gameSessionRepository: {
        findOneLean: jest.fn(),
        findTodayByMarketIds: jest.fn(),
      },
      timezoneHelper: {
        getSessionDateIST: jest.fn(() => new Date('2026-05-30T00:00:00.000Z')),
        formatISTTime: jest.fn(() => '10:00:00'),
        buildTimeOnSessionDate: jest.fn((_sessionDate, timeStr) => {
          const [h, m] = timeStr.split(':').map(Number);
          const d = new Date('2026-05-30T00:00:00.000Z');
          d.setHours(h, m, 0, 0);
          return d;
        }),
      },
      writeAuditLog: jest.fn().mockResolvedValue(true),
    };

    jest.doMock('@utils/timezoneHelper', () => mocks.timezoneHelper);

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repositories = {
            Market: mocks.marketRepository,
            GameType: mocks.gameTypeRepository,
            GameSession: mocks.gameSessionRepository,
          };
          return repositories[name];
        },
      },
    }));

    jest.doMock('@modules/admin/logs/logs.service', () => ({
      writeAuditLog: mocks.writeAuditLog,
    }));

    service = require('@modules/admin/markets/adminMarkets.service');
  };

  beforeEach(() => {
    loadModule();
  });

  test('updates market configuration and configured game types', async () => {
    const marketBefore = {
      _id: 'market1',
      code: 'KALYAN_DAY',
      name: 'Kalyan Day',
      description: '',
      openTime: '10:00',
      closeTime: '11:00',
      schedule: weeklySchedule(),
      status: 'active',
      gameTypes: [],
    };
    const marketAfter = {
      ...marketBefore,
      name: 'Kalyan Updated',
      description: 'Updated market',
      openTime: '12:00',
      closeTime: '13:00',
      status: 'inactive',
      gameTypes: [{
        gameTypeId: {
          _id: 'gt1',
          code: 'SINGLE',
          name: 'Single',
          betPhaseType: 'both',
          payoutMultiplier: 9.5,
          minBet: 10,
          maxBet: 1000,
        },
        status: 'active',
        payoutMultiplier: 9.5,
        minBet: 10,
        maxBet: 1000,
      }],
    };

    const saveMock = jest.fn().mockResolvedValue(true);
    mocks.gameSessionRepository.findOneLean.mockResolvedValue(null);
    mocks.marketRepository.findByIdWithGameTypes
      .mockResolvedValueOnce({ ...marketBefore, save: saveMock })
      .mockResolvedValueOnce(marketAfter);
    mocks.gameTypeRepository.findForAdminList.mockResolvedValue([{
      _id: 'gt1',
      code: 'SINGLE',
      name: 'Single',
      payoutMultiplier: 9.5,
      minBet: 10,
      maxBet: 1000,
    }]);

    const result = await service.editMarket({
      marketId: 'market1',
      payload: {
        name: 'Kalyan Updated',
        openTime: '12:00',
        closeTime: '13:00',
        status: 'inactive',
        description: 'Updated market',
        gameTypes: [{ gameTypeId: 'SINGLE', payoutMultiplier: 9.5, minBet: 10, maxBet: 1000 }],
      },
      adminUserId: 'admin1',
      req: { originalUrl: '/admin/markets/market1', method: 'PATCH', ip: '127.0.0.1' },
    });

    expect(saveMock).toHaveBeenCalled();
    expect(result.name).toBe('Kalyan Updated');
    expect(result.allowedGameTypes).toEqual(['SINGLE']);
  });

  test('allows market edits while a session is active because updates are planning-only', async () => {
    const saveMock = jest.fn().mockResolvedValue(true);
    mocks.marketRepository.findByIdWithGameTypes
      .mockResolvedValueOnce({
        _id: 'market1',
        code: 'KALYAN_DAY',
        name: 'Kalyan Day',
        description: '',
        openTime: '10:00',
        closeTime: '11:00',
        schedule: weeklySchedule(),
        status: 'active',
        gameTypes: [],
        save: saveMock,
      })
      .mockResolvedValueOnce({
        _id: 'market1',
        code: 'KALYAN_DAY',
        name: 'Blocked',
        description: '',
        openTime: '10:00',
        closeTime: '11:00',
        schedule: weeklySchedule(),
        status: 'active',
        gameTypes: [],
      });

    const result = await service.editMarket({
      marketId: 'market1',
      payload: { name: 'Blocked' },
      adminUserId: 'admin1',
      req: {},
    });

    expect(saveMock).toHaveBeenCalled();
    expect(result.name).toBe('Blocked');
  });

  test('creates a market using planning schedule and configured game types', async () => {
    mocks.marketRepository.findByCode.mockResolvedValue(null);
    mocks.gameTypeRepository.findForAdminList.mockResolvedValue([{
      _id: 'gt1',
      code: 'SINGLE',
      name: 'Single',
      payoutMultiplier: 9.5,
      minBet: 10,
      maxBet: 1000,
    }]);
    mocks.marketRepository.create.mockResolvedValue({ _id: 'market1' });
    mocks.marketRepository.findByIdWithGameTypes.mockResolvedValue({
      _id: 'market1',
      code: 'KALYAN_DAY',
      name: 'Kalyan Day',
      description: 'Day market',
      openTime: '15:30',
      closeTime: '17:30',
      schedule: weeklySchedule(),
      status: 'active',
      gameTypes: [{
        gameTypeId: {
          _id: 'gt1',
          code: 'SINGLE',
          name: 'Single',
          betPhaseType: 'both',
          payoutMultiplier: 9.5,
          minBet: 10,
          maxBet: 1000,
        },
        status: 'active',
        payoutMultiplier: 9.5,
        minBet: 10,
        maxBet: 1000,
      }],
    });

    const result = await service.createMarket({
      payload: {
        code: 'KALYAN_DAY',
        name: 'Kalyan Day',
        status: 'active',
        description: 'Day market',
        openTime: '15:30',
        closeTime: '17:30',
        schedule: weeklySchedule(),
        gameTypes: [{ gameTypeId: 'SINGLE', minBet: 10, maxBet: 1000 }],
      },
      adminUserId: 'admin1',
      req: {},
    });

    expect(mocks.marketRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      code: 'KALYAN_DAY',
      name: 'Kalyan Day',
      openTime: '15:30',
      closeTime: '17:30',
      schedule: weeklySchedule(),
      gameTypes: [{
        gameTypeId: 'gt1',
        payoutMultiplier: 9.5,
        minBet: 10,
        maxBet: 1000,
        status: 'active',
      }],
    }));
    expect(result.marketId).toBe('market1');
  });

  test('lists markets as flat array with session and result data', async () => {
    mocks.marketRepository.findAllWithGameTypes.mockResolvedValue([
      {
        _id: 'market1',
        code: 'ACTIVE_MKT',
        name: 'Active Market',
        description: '',
        openTime: '10:00',
        closeTime: '11:00',
        schedule: weeklySchedule(),
        status: 'active',
        gameTypes: [],
      },
      {
        _id: 'market2',
        code: 'INACTIVE_MKT',
        name: 'Inactive Market',
        description: '',
        openTime: '12:00',
        closeTime: '13:00',
        schedule: weeklySchedule(),
        status: 'inactive',
        gameTypes: [],
      },
    ]);
    mocks.gameSessionRepository.findTodayByMarketIds.mockResolvedValue([
      { _id: 'session1', marketId: 'market1', phase: 'open_running', status: 'active', openTime: new Date('2026-05-30T09:00:00'), closeTime: new Date('2026-05-30T09:30:00'), result: {} },
    ]);

    const result = await service.getAdminMarkets({});

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].marketId).toBe('market1');
    expect(result[0].session).toBeTruthy();
    expect(result[0].session.isOpen).toBe(true);
    expect(result[0].result).toBeTruthy();
    expect(result[0].schedule).toBeTruthy();
    expect(result[1].marketId).toBe('market2');
    expect(result[1].session).toBeNull();
    expect(result[1].result).toBeNull();
  });

  test('returns game types for a specific market', async () => {
    mocks.marketRepository.findByIdWithGameTypes.mockResolvedValue({
      _id: 'market1',
      code: 'KALYAN_DAY',
      name: 'Kalyan Day',
      gameTypes: [{
        gameTypeId: {
          _id: 'gt1',
          code: 'SINGLE',
          name: 'Single',
          betPhaseType: 'both',
          payoutMultiplier: 9.5,
          minBet: 10,
          maxBet: 1000,
        },
        status: 'active',
      }],
    });

    const result = await service.getMarketGameTypes('market1');

    expect(result.marketId).toBe('market1');
    expect(result.marketCode).toBe('KALYAN_DAY');
    expect(result.gameTypes).toHaveLength(1);
    expect(result.gameTypes[0].code).toBe('SINGLE');
  });

  test('soft deletes a market by marking it inactive', async () => {
    mocks.marketRepository.findByIdWithGameTypes
      .mockResolvedValueOnce({
        _id: 'market1',
        code: 'KALYAN_DAY',
        name: 'Kalyan Day',
        description: '',
        openTime: '10:00',
        closeTime: '11:00',
        schedule: weeklySchedule(),
        status: 'active',
        gameTypes: [],
      })
      .mockResolvedValueOnce({
        _id: 'market1',
        code: 'KALYAN_DAY',
        name: 'Kalyan Day',
        description: '',
        openTime: '10:00',
        closeTime: '11:00',
        schedule: weeklySchedule(),
        status: 'inactive',
        gameTypes: [],
      });
    mocks.marketRepository.update.mockResolvedValue({ _id: 'market1' });

    const result = await service.deleteMarket({
      marketId: 'market1',
      adminUserId: 'admin1',
      req: {},
    });

    expect(mocks.marketRepository.update).toHaveBeenCalledWith('market1', { status: 'inactive' });
    expect(result).toEqual({ marketId: 'market1', status: 'inactive' });
  });
});
