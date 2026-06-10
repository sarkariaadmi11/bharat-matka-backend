const { ExposureLookupEngine } = require('@domain/exposure');

const runBenchmark = (state, iterations = 200) => {
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i += 1) {
    ExposureLookupEngine.simulate({
      state,
      mode: 'close',
      context: { openPana: '235', openDigit: 2 },
    });
  }
  return Number(process.hrtime.bigint() - start) / 1e6;
};

describe('Simulation load behavior', () => {
  test('lookup latency remains stable as historical bet volume metadata grows', () => {
    const baseState = {
      totalCollection: 100000,
      singleExposure: { '1': 5000 },
      jodiExposure: { '21': 12000 },
      panaExposure: { '128': 40000 },
      compositeExposure: {
        'HS_A:235_1': 10000,
        'HS_B:2_128': 9000,
        'FS:235_128': 50000,
      },
    };

    const heavyState = {
      ...baseState,
      totalCollection: 100000000,
    };

    const fastMs = runBenchmark(baseState);
    const heavyMs = runBenchmark(heavyState);

    expect(heavyMs).toBeLessThan(fastMs * 3 + 15);
  });
});
