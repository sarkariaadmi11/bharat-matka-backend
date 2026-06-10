const { simulateOutcomes } = require('@modules/results/engine/OutcomeSimulator');
const { BettingRuleEngine } = require('@domain/rule-engine');

describe('Result simulation exposure parity and fallback', () => {
  let simulateResults;
  let mocks;

  const loadServiceWithMocks = () => {
    jest.resetModules();

    mocks = {
      gameSessionRepository: {
        findById: jest.fn(),
      },
      betRepository: {
        getPendingExposureSummary: jest.fn(),
        findPendingBySession: jest.fn().mockResolvedValue([]),
      },
      sessionExposureRepository: {
        findBySessionAndMode: jest.fn(),
        applyDelta: jest.fn(),
      },
      marketRepository: {
        findById: jest.fn(),
      },
    };

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            GameSession: mocks.gameSessionRepository,
            Bet: mocks.betRepository,
            SessionExposure: mocks.sessionExposureRepository,
            Market: mocks.marketRepository,
          };
          return repoMap[name];
        },
      },
    }));

    ({ simulateResults } = require('@modules/results/engine/ResultApplicationService'));
  };

  beforeEach(() => {
    loadServiceWithMocks();
  });

  test('rebuilds from pending-bet aggregation when exposure snapshot is missing', async () => {
    const summary = {
      totals: { totalCollection: 3200, totalBets: 3 },
      bySelection: [
        { _id: '2', totalAmount: 2000, totalPotentialPayout: 18000, betCount: 2 },
        { _id: '128', totalAmount: 1200, totalPotentialPayout: 180000, betCount: 1 },
      ],
    };

    mocks.gameSessionRepository.findById.mockResolvedValue({
      _id: 's1',
      phase: 'open_running',
      result: {},
    });
    mocks.sessionExposureRepository.findBySessionAndMode.mockResolvedValue(null);
    mocks.betRepository.getPendingExposureSummary.mockResolvedValue(summary);

    const analytics = await simulateResults('s1');

    const ruleEngine = new BettingRuleEngine();
    const expected = simulateOutcomes(ruleEngine.calculateExposureFromSummary({ summary }));
    const actual128 = analytics.topOutcomes.find((item) => item.outcomePana === '128');
    const expected128 = expected.topOutcomes.find((item) => item.outcomePana === '128');

    expect(actual128.totalPayout).toBe(expected128.totalPayout);
    expect(actual128.netProfit).toBe(expected128.netProfit);
    expect(mocks.betRepository.getPendingExposureSummary).toHaveBeenCalledWith('s1', 'open');
  });

  test('uses session exposure snapshot when available', async () => {
    mocks.gameSessionRepository.findById.mockResolvedValue({
      _id: 's2',
      phase: 'close_running',
      result: { openPana: '235', openDigit: 2 },
    });
    mocks.sessionExposureRepository.findBySessionAndMode.mockResolvedValue({
      sessionId: 's2',
      mode: 'close',
      totalCollection: 50000,
      singleExposure: { '1': 900 },
      jodiExposure: { '21': 4500 },
      panaExposure: { '128': 15000 },
      compositeExposure: {
        'HS_A:235_1': 1000,
        'HS_B:2_128': 1200,
        'FS:235_128': 5000,
      },
    });

    const analytics = await simulateResults('s2');
    const candidate = analytics.topOutcomes.find((item) => item.outcomePana === '128');

    expect(candidate.totalPayout).toBe(27600);
    expect(mocks.betRepository.getPendingExposureSummary).not.toHaveBeenCalled();
  });

  test('includes SP_MOTOR liabilities through pana exposure without extra simulation logic', async () => {
    mocks.gameSessionRepository.findById.mockResolvedValue({
      _id: 's3',
      phase: 'open_running',
      result: {},
    });
    mocks.sessionExposureRepository.findBySessionAndMode.mockResolvedValue({
      sessionId: 's3',
      mode: 'open',
      totalCollection: 10000,
      singleExposure: {},
      jodiExposure: {},
      panaExposure: {
        '123': 3000,
        '124': 3000,
        '134': 3000,
        '234': 3000,
      },
      compositeExposure: {},
    });

    const analytics = await simulateResults('s3');

    const hit = analytics.topOutcomes.find((item) => item.outcomePana === '123');
    expect(hit.totalPayout).toBe(3000);
    expect(hit.netProfit).toBe(7000);
  });
});
