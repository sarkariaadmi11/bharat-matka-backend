const { ExposureDeltaGenerator } = require('@domain/exposure');

describe('ExposureDeltaGenerator', () => {
  test('maps all existing game types into open/close exposure buckets', () => {
    const bets = [
      { gameTypeCodeSnapshot: 'SINGLE', betMode: 'open', selection: '4', amount: 100, oddsSnapshot: 9.5 },
      { gameTypeCodeSnapshot: 'JODI', betMode: 'open', selection: '47', amount: 50, oddsSnapshot: 90 },
      { gameTypeCodeSnapshot: 'SP', betMode: 'open', selection: '128', amount: 20, oddsSnapshot: 150 },
      { gameTypeCodeSnapshot: 'DP', betMode: 'close', selection: '550', amount: 30, oddsSnapshot: 300 },
      { gameTypeCodeSnapshot: 'TP', betMode: 'close', selection: '777', amount: 10, oddsSnapshot: 600 },
      { gameTypeCodeSnapshot: 'HS_A', betMode: 'open', selection: '128_4', amount: 5, oddsSnapshot: 1000 },
      { gameTypeCodeSnapshot: 'HS_B', betMode: 'open', selection: '4_235', amount: 5, oddsSnapshot: 1000 },
      { gameTypeCodeSnapshot: 'FS', betMode: 'open', selection: '128_235', amount: 2, oddsSnapshot: 10000 },
    ];

    const grouped = ExposureDeltaGenerator.generateGroupedDeltas(bets);

    expect(grouped.open.totalCollection).toBe(120);
    expect(grouped.open.singleExposure['4']).toBe(950);
    expect(grouped.open.panaExposure['128']).toBe(3000);

    expect(grouped.close.totalCollection).toBe(102);
    expect(grouped.close.jodiExposure['47']).toBe(4500);
    expect(grouped.close.panaExposure['550']).toBe(9000);
    expect(grouped.close.panaExposure['777']).toBe(6000);
    expect(grouped.close.compositeExposure['HS_A:128_4']).toBe(5000);
    expect(grouped.close.compositeExposure['HS_B:4_235']).toBe(5000);
    expect(grouped.close.compositeExposure['FS:128_235']).toBe(20000);
  });

  test('expands SP_MOTOR bets into pana exposure using stakePerCombination snapshot', () => {
    const bets = [
      {
        gameTypeCodeSnapshot: 'SP_MOTOR',
        gameTypeTemplateKey: 'SP_MOTOR',
        betMode: 'open',
        amount: 100,
        oddsSnapshot: 120,
        generatedPanas: ['123', '124', '134', '234'],
        stakePerCombination: 25,
      },
    ];

    const grouped = ExposureDeltaGenerator.generateGroupedDeltas(bets);

    expect(grouped.open.totalCollection).toBe(100);
    expect(grouped.open.panaExposure['123']).toBe(3000);
    expect(grouped.open.panaExposure['124']).toBe(3000);
    expect(grouped.open.panaExposure['134']).toBe(3000);
    expect(grouped.open.panaExposure['234']).toBe(3000);
  });

  test('expands DP_MOTOR bets into pana exposure using stakePerCombination snapshot', () => {
    const bets = [
      {
        gameTypeCodeSnapshot: 'DP_MOTOR',
        gameTypeTemplateKey: 'DP_MOTOR',
        betMode: 'open',
        amount: 100,
        oddsSnapshot: 250,
        generatedPanas: ['112', '113', '122', '133', '223', '233'],
        stakePerCombination: 1666,
      },
    ];

    const grouped = ExposureDeltaGenerator.generateGroupedDeltas(bets);

    expect(grouped.open.totalCollection).toBe(100);
    expect(grouped.open.panaExposure['112']).toBe(416500);
    expect(grouped.open.panaExposure['233']).toBe(416500);
  });
});
