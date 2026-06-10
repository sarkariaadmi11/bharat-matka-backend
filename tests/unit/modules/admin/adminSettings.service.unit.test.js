describe('adminSettings.service', () => {
  let service;
  let mocks;

  const loadModule = () => {
    jest.resetModules();

    mocks = {
      globalConfigRepository: {
        findOne: jest.fn(),
        create: jest.fn(),
        invalidateCache: jest.fn().mockResolvedValue(),
      },
    };

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          if (name === 'GlobalConfig') {
            return mocks.globalConfigRepository;
          }
          return null;
        },
      },
    }));

    service = require('@modules/admin/settings/adminSettings.service');
  };

  beforeEach(() => {
    loadModule();
  });

  test('returns empty support email when config does not exist', async () => {
    mocks.globalConfigRepository.findOne.mockResolvedValue(null);

    await expect(service.getSupportContact()).resolves.toEqual({
      whatsappNumber: null,
      telegramLink: null,
      supportEmail: null,
    });
  });

  test('updates support email on existing config', async () => {
    const config = {
      supportContact: {
        whatsappNumber: '9876543210',
        telegramLink: '@support_handle',
      },
      updatedAt: new Date('2026-05-10T00:00:00.000Z'),
      save: jest.fn().mockResolvedValue(true),
    };
    mocks.globalConfigRepository.findOne.mockResolvedValue(config);

    const result = await service.updateSupportContact({
      supportEmail: 'support@example.com',
    });

    expect(config.supportContact.supportEmail).toBe('support@example.com');
    expect(config.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      whatsappNumber: '9876543210',
      telegramLink: '@support_handle',
      supportEmail: 'support@example.com',
      updatedAt: config.updatedAt,
    });
  });

  test('creates support contact config with support email', async () => {
    const createdConfig = {
      supportContact: {
        whatsappNumber: null,
        telegramLink: null,
        supportEmail: 'support@example.com',
      },
      updatedAt: new Date('2026-05-10T00:00:00.000Z'),
    };
    mocks.globalConfigRepository.findOne.mockResolvedValue(null);
    mocks.globalConfigRepository.create.mockResolvedValue(createdConfig);

    const result = await service.updateSupportContact({
      supportEmail: 'support@example.com',
    });

    expect(mocks.globalConfigRepository.create).toHaveBeenCalledWith({
      supportContact: {
        whatsappNumber: null,
        telegramLink: null,
        supportEmail: 'support@example.com',
      },
    });
    expect(result.supportEmail).toBe('support@example.com');
  });

  describe('getSettings', () => {
    test('returns defaults when config does not exist', async () => {
      mocks.globalConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.getSettings();

      expect(result).toEqual({
        minimumDeposit: 100,
        maximumDeposit: 100000,
        minimumWithdrawal: 100,
        maximumWithdrawal: 100000,
        minimumBidAmount: 10,
        maximumBidAmount: 10000,
        welcomeBonus: 5,
        withdrawOpenTime: '09:00',
        withdrawCloseTime: '13:00',
        globalBetting: false,
        resultDeclarationGraceHours: 5,
      });
    });

    test('returns stored settings when config exists', async () => {
      const config = {
        minimumDeposit: 200,
        maximumDeposit: 50000,
        minimumWithdrawal: 500,
        maximumWithdrawal: 50000,
        minimumBidAmount: 50,
        maximumBidAmount: 5000,
        welcomeBonus: 10,
        withdrawOpenTime: '10:00',
        withdrawCloseTime: '15:00',
        globalBetting: true,
        resultDeclarationGraceHours: 3,
      };
      mocks.globalConfigRepository.findOne.mockResolvedValue(config);

      const result = await service.getSettings();

      expect(result).toEqual(config);
    });

    test('fills missing fields with defaults', async () => {
      const config = {
        minimumDeposit: 200,
        maximumDeposit: 50000,
      };
      mocks.globalConfigRepository.findOne.mockResolvedValue(config);

      const result = await service.getSettings();

      expect(result.minimumDeposit).toBe(200);
      expect(result.maximumDeposit).toBe(50000);
      expect(result.minimumWithdrawal).toBe(100);
      expect(result.globalBetting).toBe(false);
    });
  });

  describe('updateSettings', () => {
    test('updates settings on existing config', async () => {
      const config = {
        minimumDeposit: 100,
        maximumDeposit: 100000,
        minimumWithdrawal: 100,
        maximumWithdrawal: 100000,
        minimumBidAmount: 10,
        maximumBidAmount: 10000,
        welcomeBonus: 5,
        withdrawOpenTime: '09:00',
        withdrawCloseTime: '13:00',
        globalBetting: false,
        resultDeclarationGraceHours: 5,
        save: jest.fn().mockResolvedValue(true),
      };
      mocks.globalConfigRepository.findOne.mockResolvedValue(config);

      const result = await service.updateSettings({
        minimumDeposit: 201,
        maximumDeposit: 100000,
      });

      expect(config.minimumDeposit).toBe(201);
      expect(config.save).toHaveBeenCalledTimes(1);
      expect(result.minimumDeposit).toBe(201);
      expect(result.maximumDeposit).toBe(100000);
    });

    test('creates config with defaults and applies payload', async () => {
      const createdConfig = {
        minimumDeposit: 201,
        maximumDeposit: 100000,
        minimumWithdrawal: 100,
        maximumWithdrawal: 100000,
        minimumBidAmount: 10,
        maximumBidAmount: 10000,
        welcomeBonus: 5,
        withdrawOpenTime: '09:00',
        withdrawCloseTime: '13:00',
        globalBetting: false,
        resultDeclarationGraceHours: 5,
      };
      mocks.globalConfigRepository.findOne.mockResolvedValue(null);
      mocks.globalConfigRepository.create.mockResolvedValue(createdConfig);

      const result = await service.updateSettings({
        minimumDeposit: 201,
        maximumDeposit: 100000,
      });

      expect(mocks.globalConfigRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          minimumDeposit: 201,
          maximumDeposit: 100000,
        }),
      );
      expect(result.minimumDeposit).toBe(201);
      expect(result.maximumDeposit).toBe(100000);
    });
  });
});
