describe('NotificationDispatcher', () => {
  let dispatchResultDeclared;
  let mocks;

  const loadModule = () => {
    jest.resetModules();

    mocks = {
      gameSessionRepository: {
        model: {
          findById: jest.fn(),
        },
      },
      notificationService: {
        sendToMarketSubscribers: jest.fn().mockResolvedValue({ successCount: 1 }),
      },
      logger: {
        warn: jest.fn(),
      },
    };

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          if (name === 'GameSession') {
            return mocks.gameSessionRepository;
          }
          return null;
        },
      },
    }));

    jest.doMock('@utils/logger', () => mocks.logger);
    jest.doMock('../../../../src/modules/notifications/notification.service', () => mocks.notificationService);

    ({ dispatchResultDeclared } = require('@modules/results/engine/NotificationDispatcher'));
  };

  beforeEach(() => {
    loadModule();
  });

  test('includes close digit in formatted result payload', async () => {
    await dispatchResultDeclared({
      sessionId: 'session-1',
      declarationMode: 'close',
      session: {
        _id: 'session-1',
        sessionDate: new Date('2026-01-01T00:00:00.000Z'),
        phase: 'market_closed',
        result: {
          openPana: '123',
          openDigit: 6,
          closePana: '558',
          closeDigit: 5,
        },
      },
      market: {
        code: 'MK1',
        name: 'Mock Market',
      },
    });

    expect(mocks.notificationService.sendToMarketSubscribers).toHaveBeenCalledWith(
      'MK1',
      expect.objectContaining({
        body: '123-65-558',
        data: expect.objectContaining({
          phase: 'close',
          sessionPhase: 'market_closed',
          result: '123-65-558',
          finalJodi: '65',
          closeDigit: 5,
        }),
      }),
    );
  });

  test('preserves zero digits in notification payload data', async () => {
    await dispatchResultDeclared({
      sessionId: 'session-2',
      declarationMode: 'close',
      session: {
        _id: 'session-2',
        sessionDate: new Date('2026-01-01T00:00:00.000Z'),
        phase: 'market_closed',
        result: {
          openPana: '127',
          openDigit: 0,
          closePana: '235',
          closeDigit: 0,
        },
      },
      market: {
        code: 'MK1',
        name: 'Mock Market',
      },
    });

    expect(mocks.notificationService.sendToMarketSubscribers).toHaveBeenCalledWith(
      'MK1',
      expect.objectContaining({
        body: '127-00-235',
        data: expect.objectContaining({
          phase: 'close',
          openDigit: 0,
          closeDigit: 0,
          finalJodi: '00',
        }),
      }),
    );
  });
});
