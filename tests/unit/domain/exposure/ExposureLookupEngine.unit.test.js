const { ExposureLookupEngine } = require('@domain/exposure');

describe('ExposureLookupEngine', () => {
  test('computes open mode payout from single and pana exposure in O(1) lookups', () => {
    const state = {
      totalCollection: 10000,
      singleExposure: { '1': 900 },
      panaExposure: { '128': 15000 },
      jodiExposure: {},
      compositeExposure: {},
    };

    const payout = ExposureLookupEngine.computeOutcomePayout({
      state,
      mode: 'open',
      candidate: { outcomePana: '128', outcomeDigit: 1 },
      context: {},
    });

    expect(payout).toBe(15900);
  });

  test('computes close mode payout including jodi and sangam composite keys', () => {
    const state = {
      totalCollection: 50000,
      singleExposure: { '1': 900 },
      panaExposure: { '128': 15000 },
      jodiExposure: { '21': 4500 },
      compositeExposure: {
        'HS_A:235_1': 1000,
        'HS_B:2_128': 1200,
        'FS:235_128': 5000,
      },
    };

    const payout = ExposureLookupEngine.computeOutcomePayout({
      state,
      mode: 'close',
      candidate: { outcomePana: '128', outcomeDigit: 1 },
      context: { openPana: '235', openDigit: 2 },
    });

    expect(payout).toBe(27600);
  });

  test('matches zero-highest pana exposure keys when 0 is present', () => {
    const state = {
      totalCollection: 10000,
      singleExposure: {},
      panaExposure: { '120': 15000 },
      jodiExposure: {},
      compositeExposure: {},
    };

    const payout = ExposureLookupEngine.computeOutcomePayout({
      state,
      mode: 'open',
      candidate: { outcomePana: '120', outcomeDigit: 3 },
      context: {},
    });

    expect(payout).toBe(15000);
  });
});
