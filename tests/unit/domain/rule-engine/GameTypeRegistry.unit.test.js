const { GameTypeRegistry, TEMPLATE } = require('@domain/rule-engine/GameTypeRegistry');

describe('GameTypeRegistry configuration safety', () => {
  test('maps half-sangam game code to open-only betting template', () => {
    // Arrange / Act
    const template = GameTypeRegistry.fromGameType({ code: 'HS_A' });

    // Assert
    expect(template.templateKey).toBe(TEMPLATE.HALF_SANGAM_A);
    expect(template.allowedBetModes).toEqual(['open']);
    expect(template.betPhaseType).toBe('open_only');
    expect(template.parts).toEqual([
      { name: 'openPana', length: 3, type: 'pana', panaKind: 'any' },
      { name: 'closeDigit', length: 1, type: 'digit' },
    ]);
  });

  test('returns deep-cloned template so runtime mutation cannot corrupt future validations', () => {
    // Arrange
    const firstRead = GameTypeRegistry.fromGameType({ templateKey: TEMPLATE.SINGLE_DIGIT });

    // Act
    firstRead.parts[0].length = 9;
    const secondRead = GameTypeRegistry.fromGameType({ templateKey: TEMPLATE.SINGLE_DIGIT });

    // Assert
    expect(secondRead.parts[0].length).toBe(1);
  });

  test('buildRulesFromTemplate exposes bet-value validation contract for jodi', () => {
    // Arrange / Act
    const rules = GameTypeRegistry.buildRulesFromTemplate(TEMPLATE.JODI);

    // Assert
    expect(rules).toEqual({
      format: 'jodi',
      parts: [{ name: 'jodi', length: 2, type: 'digit' }],
      separator: '_',
      allowRepeat: true,
      allowedBetModes: ['open'],
    });
  });

  test('maps jodi to open-only betting centrally', () => {
    const template = GameTypeRegistry.fromGameType({ code: 'JODI' });

    expect(template.templateKey).toBe(TEMPLATE.JODI);
    expect(template.allowedBetModes).toEqual(['open']);
    expect(template.betPhaseType).toBe('open_only');
  });

  test('returns null for unknown game types to prevent accidental fallback behavior', () => {
    // Arrange / Act / Assert
    expect(GameTypeRegistry.inferTemplateKey({ code: 'UNKNOWN' })).toBeNull();
    expect(GameTypeRegistry.fromGameType({ code: 'UNKNOWN' })).toBeNull();
    expect(GameTypeRegistry.buildRulesFromTemplate('UNKNOWN_TEMPLATE')).toBeNull();
  });

  test('registers SP_MOTOR template with pana_set rules', () => {
    const template = GameTypeRegistry.getTemplate(TEMPLATE.SP_MOTOR);

    expect(template).toBeTruthy();
    expect(template.parts).toEqual([
      {
        name: 'panas',
        type: 'pana_set',
        minItems: 1,
        panaKind: 'single',
      },
    ]);
    expect(template.allowedBetModes).toEqual(['open', 'close']);
  });

  test('registers DP_MOTOR template with pana_set rules', () => {
    const template = GameTypeRegistry.getTemplate(TEMPLATE.DP_MOTOR);

    expect(template).toBeTruthy();
    expect(template.parts).toEqual([
      {
        name: 'panas',
        type: 'pana_set',
        minItems: 1,
        panaKind: 'double',
      },
    ]);
    expect(template.allowedBetModes).toEqual(['open', 'close']);
  });
});
