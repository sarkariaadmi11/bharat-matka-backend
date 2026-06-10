const {
  buildResultState,
  determineFinancialConsistency,
} = require('@domain/results/resultState');

describe('resultState', () => {
  test('marks settlement in progress as financially inconsistent with a structured warning', () => {
    const state = buildResultState({
      _id: 'session-1',
      resultRevision: 2,
      settledResultRevision: 1,
      settlementStatus: 'processing',
      currentResult: {
        openPana: '128',
        openDigit: 1,
      },
      settledResult: {
        openPana: '123',
        openDigit: 6,
      },
    });

    expect(state.isFinanciallyConsistent).toBe(false);
    expect(state.warning).toEqual(expect.objectContaining({
      code: 'RESULT_SETTLEMENT_IN_PROGRESS',
      severity: 'medium',
      actionRequired: false,
    }));
  });

  test('treats matching settled and current revisions as financially consistent', () => {
    expect(determineFinancialConsistency({
      resultRevision: 3,
      settledResultRevision: 3,
      settlementStatus: 'completed',
      currentResult: {
        openPana: '128',
        openDigit: 1,
        closePana: '235',
        closeDigit: 0,
      },
      settledResult: {
        openPana: '128',
        openDigit: 1,
        closePana: '235',
        closeDigit: 0,
      },
    })).toBe(true);
  });
});
