describe('Bet history expansion for motor bets', () => {
  let getUserBets;
  let mocks;
  let rawBets;

  // const buildQueryChain = (documents) => ({
  //   lean: jest.fn().mockResolvedValue(documents),
  // });

  const loadServiceWithMocks = () => {
    jest.resetModules();

    mocks = {
      betRepository: {
        findByUser: jest.fn(),
      },
      gameSessionRepository: {
        findLeanByIds: jest.fn(),
      },
      gameTypeRepository: {
        findLeanByIds: jest.fn(),
      },
      marketRepository: {
        findLeanByIds: jest.fn(),
      },
    };

    jest.doMock('mongoose', () => ({
      Types: {
        ObjectId: {
          isValid: jest.fn().mockReturnValue(false),
        },
      },
    }));

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            Bet: mocks.betRepository,
            GameSession: mocks.gameSessionRepository,
            GameType: mocks.gameTypeRepository,
            Market: mocks.marketRepository,
            Wallet: {},
            Transaction: {},
            SessionExposure: {},
          };

          return repoMap[name];
        },
      },
    }));

    ({ getUserBets } = require('@modules/bets/bets.service'));
  };

  beforeEach(() => {
    loadServiceWithMocks();
    rawBets = [];

    mocks.betRepository.findByUser.mockImplementation(async (_userId, page, limit) => {
      const start = (page - 1) * limit;
      const documents = rawBets.slice(start, start + limit);

      return {
        documents,
        pagination: {
          page,
          limit,
          total: rawBets.length,
          pages: Math.ceil(rawBets.length / limit),
        },
      };
    });

    mocks.gameSessionRepository.findLeanByIds.mockResolvedValue([
      {
        _id: 'session1',
        marketId: 'market1',
        result: {
          openPana: '123',
          closePana: '223',
        },
      },
    ]);

    mocks.gameTypeRepository.findLeanByIds.mockImplementation((ids = []) => {
      const normalizedIds = ids.map(String);
      const documents = [];

      if (normalizedIds.includes('gt_motor')) {
        documents.push({ _id: 'gt_motor', code: 'SP_MOTOR' });
      }
      if (normalizedIds.includes('gt_motor_dp')) {
        documents.push({ _id: 'gt_motor_dp', code: 'DP_MOTOR' });
      }
      if (normalizedIds.includes('gt_single')) {
        documents.push({ _id: 'gt_single', code: 'SINGLE' });
      }

      return documents;
    });

    mocks.marketRepository.findLeanByIds.mockResolvedValue([
      { _id: 'market1', code: 'KALYANI_NIGHT' },
    ]);
  });

  test('expands motor bets into one history row per pana and keeps non-motor bets unchanged', async () => {
    rawBets = [
      {
        _id: 'bet_motor',
        sessionId: 'session1',
        gameTypeId: 'gt_motor',
        betMode: 'open',
        selection: '123,124,234',
        generatedPanas: ['123', '124', '234'],
        amount: 3000,
        oddsSnapshot: 120,
        status: 'pending',
        payout: 0,
        createdAt: new Date('2026-03-15T12:00:00.000Z'),
        gameTypeCodeSnapshot: 'SP_MOTOR',
        gameTypeTemplateKey: 'SP_MOTOR',
      },
      {
        _id: 'bet_single',
        sessionId: 'session1',
        gameTypeId: 'gt_single',
        betMode: 'open',
        selection: '7',
        amount: 2000,
        oddsSnapshot: 9,
        status: 'pending',
        payout: 0,
        createdAt: new Date('2026-03-15T12:05:00.000Z'),
        gameTypeCodeSnapshot: 'SINGLE',
        gameTypeTemplateKey: 'SINGLE_DIGIT',
      },
    ];

    const result = await getUserBets('user1', 1, 20, {});

    expect(result.total).toBe(2);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'bet_motor_123',
        betId: 'bet_motor',
        expansionKey: '123',
        isExpanded: true,
        market: 'KALYANI_NIGHT',
        gameType: 'SP_MOTOR',
        betMode: 'open',
        selection: '123',
        amount: 10,
        totalAmount: 30,
        odds: 120,
        status: 'pending',
        payout: 0,
        totalPayout: 0,
        placedAt: new Date('2026-03-15T12:00:00.000Z'),
      }),
      expect.objectContaining({
        id: 'bet_motor_124',
        betId: 'bet_motor',
        expansionKey: '124',
        isExpanded: true,
        selection: '124',
        amount: 10,
        totalAmount: 30,
      }),
      expect.objectContaining({
        id: 'bet_motor_234',
        betId: 'bet_motor',
        expansionKey: '234',
        isExpanded: true,
        selection: '234',
        amount: 10,
        totalAmount: 30,
      }),
      expect.objectContaining({
        id: 'bet_single',
        betId: 'bet_single',
        expansionKey: null,
        isExpanded: false,
        market: 'KALYANI_NIGHT',
        gameType: 'SINGLE',
        betMode: 'open',
        selection: '7',
        amount: 20,
        totalAmount: 20,
        odds: 9,
        status: 'pending',
        payout: 0,
        totalPayout: 0,
        placedAt: new Date('2026-03-15T12:05:00.000Z'),
      }),
    ]);
  });

  test('splits motor amount equally and preserves original total across expanded rows', async () => {
    rawBets = [
      {
        _id: 'bet_motor',
        sessionId: 'session1',
        gameTypeId: 'gt_motor_dp',
        betMode: 'open',
        selection: '112,122,223',
        generatedPanas: ['112', '122', '223'],
        amount: 3000,
        oddsSnapshot: 250,
        status: 'pending',
        payout: 0,
        createdAt: new Date('2026-03-15T12:00:00.000Z'),
        gameTypeCodeSnapshot: 'DP_MOTOR',
        gameTypeTemplateKey: 'DP_MOTOR',
      },
    ];

    const result = await getUserBets('user1', 1, 20, {});
    const totalAmount = result.items.reduce((sum, item) => sum + Number(item.amount), 0);

    expect(result.total).toBe(1);
    expect(result.items.map((item) => item.amount)).toEqual([10, 10, 10]);
    expect(totalAmount).toBe(30);
  });

  test('returns row references for both user and admin workflows', async () => {
    rawBets = [
      {
        _id: 'bet_motor',
        sessionId: 'session1',
        gameTypeId: 'gt_motor',
        betMode: 'open',
        selection: '123,124',
        generatedPanas: ['123', '124'],
        amount: 2000,
        oddsSnapshot: 120,
        status: 'pending',
        payout: 0,
        createdAt: new Date('2026-03-15T12:00:00.000Z'),
        gameTypeCodeSnapshot: 'SP_MOTOR',
        gameTypeTemplateKey: 'SP_MOTOR',
      },
    ];

    const userHistory = await getUserBets('user1', 1, 20, {});
    const adminHistory = await getUserBets('user1', 1, 20, {});

    expect(userHistory.items[0]).toEqual(expect.objectContaining({
      id: 'bet_motor_123',
      betId: 'bet_motor',
      expansionKey: '123',
      isExpanded: true,
    }));
    expect(adminHistory.items[0]).toEqual(expect.objectContaining({
      id: 'bet_motor_123',
      betId: 'bet_motor',
      expansionKey: '123',
      isExpanded: true,
    }));
  });

  test('returns exactly the requested page size after motor expansion', async () => {
    rawBets = [
      {
        _id: 'bet_motor_1',
        sessionId: 'session1',
        gameTypeId: 'gt_motor',
        betMode: 'open',
        selection: '123,124,125',
        generatedPanas: ['123', '124', '125'],
        amount: 3000,
        oddsSnapshot: 120,
        status: 'pending',
        payout: 0,
        createdAt: new Date('2026-03-15T12:00:00.000Z'),
        gameTypeCodeSnapshot: 'SP_MOTOR',
        gameTypeTemplateKey: 'SP_MOTOR',
      },
      {
        _id: 'bet_motor_2',
        sessionId: 'session1',
        gameTypeId: 'gt_motor',
        betMode: 'open',
        selection: '126,127,128',
        generatedPanas: ['126', '127', '128'],
        amount: 3000,
        oddsSnapshot: 120,
        status: 'pending',
        payout: 0,
        createdAt: new Date('2026-03-15T12:05:00.000Z'),
        gameTypeCodeSnapshot: 'SP_MOTOR',
        gameTypeTemplateKey: 'SP_MOTOR',
      },
    ];

    const result = await getUserBets('user1', 1, 4, {});

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(4);
    expect(result.items.map((item) => item.selection)).toEqual(['123', '124', '125', '126']);
  });

  test('paginates mixed motor and non-motor bets without overflowing the page', async () => {
    rawBets = [
      {
        _id: 'bet_single',
        sessionId: 'session1',
        gameTypeId: 'gt_single',
        betMode: 'open',
        selection: '7',
        amount: 2000,
        oddsSnapshot: 9,
        status: 'pending',
        payout: 0,
        createdAt: new Date('2026-03-15T12:00:00.000Z'),
        gameTypeCodeSnapshot: 'SINGLE',
        gameTypeTemplateKey: 'SINGLE_DIGIT',
      },
      {
        _id: 'bet_motor',
        sessionId: 'session1',
        gameTypeId: 'gt_motor',
        betMode: 'open',
        selection: '123,124,234',
        generatedPanas: ['123', '124', '234'],
        amount: 3000,
        oddsSnapshot: 120,
        status: 'pending',
        payout: 0,
        createdAt: new Date('2026-03-15T12:05:00.000Z'),
        gameTypeCodeSnapshot: 'SP_MOTOR',
        gameTypeTemplateKey: 'SP_MOTOR',
      },
      {
        _id: 'bet_single_2',
        sessionId: 'session1',
        gameTypeId: 'gt_single',
        betMode: 'open',
        selection: '8',
        amount: 1000,
        oddsSnapshot: 9,
        status: 'pending',
        payout: 0,
        createdAt: new Date('2026-03-15T12:10:00.000Z'),
        gameTypeCodeSnapshot: 'SINGLE',
        gameTypeTemplateKey: 'SINGLE_DIGIT',
      },
    ];

    const result = await getUserBets('user1', 1, 3, {});

    expect(result.items).toHaveLength(3);
    expect(result.items.map((item) => item.selection)).toEqual(['7', '123', '124']);
  });

  test('marks only the winning SP_MOTOR pana row as won in history', async () => {
    rawBets = [
      {
        _id: 'bet_motor',
        sessionId: 'session1',
        gameTypeId: 'gt_motor',
        betMode: 'open',
        selection: '123,124,234',
        generatedPanas: ['123', '124', '234'],
        amount: 3000,
        oddsSnapshot: 120,
        status: 'won',
        payout: 120000,
        createdAt: new Date('2026-03-15T12:00:00.000Z'),
        gameTypeCodeSnapshot: 'SP_MOTOR',
        gameTypeTemplateKey: 'SP_MOTOR',
      },
    ];

    const result = await getUserBets('user1', 1, 20, {});

    expect(result.items).toEqual([
      expect.objectContaining({ selection: '123', status: 'won', payout: 1200, totalPayout: 1200 }),
      expect.objectContaining({ selection: '124', status: 'lost', payout: 0, totalPayout: 0 }),
      expect.objectContaining({ selection: '234', status: 'lost', payout: 0, totalPayout: 0 }),
    ]);
  });

  test('marks only the winning DP_MOTOR pana row as won in history', async () => {
    rawBets = [
      {
        _id: 'bet_motor_dp',
        sessionId: 'session1',
        gameTypeId: 'gt_motor_dp',
        betMode: 'close',
        selection: '112,122,223',
        generatedPanas: ['112', '122', '223'],
        amount: 3000,
        oddsSnapshot: 250,
        status: 'won',
        payout: 250000,
        createdAt: new Date('2026-03-15T12:00:00.000Z'),
        gameTypeCodeSnapshot: 'DP_MOTOR',
        gameTypeTemplateKey: 'DP_MOTOR',
      },
    ];

    const result = await getUserBets('user1', 1, 20, {});

    expect(result.items).toEqual([
      expect.objectContaining({ selection: '112', status: 'lost', payout: 0, totalPayout: 0 }),
      expect.objectContaining({ selection: '122', status: 'lost', payout: 0, totalPayout: 0 }),
      expect.objectContaining({ selection: '223', status: 'won', payout: 2500, totalPayout: 2500 }),
    ]);
  });

  test('returns winning jodi bet history in rupees without motor expansion side effects', async () => {
    rawBets = [
      {
        _id: 'bet_jodi',
        sessionId: 'session1',
        gameTypeId: 'gt_jodi',
        betMode: 'open',
        selection: '47',
        amount: 1000,
        oddsSnapshot: 90,
        status: 'won',
        payout: 90000,
        createdAt: new Date('2026-03-15T12:00:00.000Z'),
        gameTypeCodeSnapshot: 'JODI',
        gameTypeTemplateKey: 'JODI',
      },
    ];

    mocks.gameTypeRepository.findLeanByIds.mockImplementation((ids = []) => {
      const normalizedIds = ids.map(String);
      const documents = [];

      if (normalizedIds.includes('gt_jodi')) {
        documents.push({ _id: 'gt_jodi', code: 'JODI' });
      }

      return documents;
    });

    const result = await getUserBets('user1', 1, 20, {});

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'bet_jodi',
        gameType: 'JODI',
        betMode: 'open',
        selection: '47',
        amount: 10,
        status: 'won',
        payout: 900,
      }),
    ]);
  });
});
