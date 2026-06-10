const mongoose = require('mongoose');
const { BET_MODE, GAME_TYPE_PHASE, MARKET_STATUS } = require('@config/constants/domain');
const { GameTypeRegistry } = require('@domain/rule-engine/GameTypeRegistry');

const rulePartSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    length: { type: Number },
    type: { type: String, enum: ['digit', 'pana', 'pana_set', 'digit_set'], required: true },
    panaKind: { type: String, enum: ['single', 'double', 'triple', 'any'], default: 'any' },
    minItems: { type: Number },
    maxItems: { type: Number },
  },
  { _id: false },
);

const gameTypeRulesSchema = new mongoose.Schema(
  {
    format: { type: String, required: true },
    parts: { type: [rulePartSchema], default: [] },
    separator: { type: String, default: '_' },
    allowRepeat: { type: Boolean, default: true },
    allowedBetModes: { type: [String], default: [BET_MODE.OPEN, BET_MODE.CLOSE] },
    regex: { type: String },
    examples: { type: [String], default: [] },
  },
  { _id: false },
);

const gameTypeSchema = new mongoose.Schema(
  {
    // Single Digit, Jodi, Pana, Half Sangam, Full Sangam etc
    code: { type: String, required: true, unique: true, uppercase: true, index: true },
    name: { type: String, required: true },
    templateKey: {
      type: String,
      enum: GameTypeRegistry.templateKeys(),
      required: true,
    },
    rulesVersion: { type: Number, default: 1, min: 1 },
    payoutMultiplier: { type: Number, required: true, default: 9.5 },
    minBet: { type: Number, default: 1, min: 1 },
    maxBet: { type: Number, default: 100000, min: 1 },
    rules: { type: gameTypeRulesSchema, required: true },
    betPhaseType: {
      type: String,
      enum: Object.values(GAME_TYPE_PHASE),
      default: GAME_TYPE_PHASE.BOTH,
    },
    status: { type: String, default: MARKET_STATUS.ACTIVE, index: true },
  },
  { timestamps: true },
);

gameTypeSchema.index({ status: 1, code: 1 });

const applyTemplateIntegrity = (doc) => {
  const templateKey = GameTypeRegistry.inferTemplateKey({
    templateKey: doc.templateKey,
    code: doc.code,
  });

  if (!templateKey) {
    throw new Error('Unsupported GameType template. Use a registered template only.');
  }

  const template = GameTypeRegistry.getTemplate(templateKey);
  const generatedRules = GameTypeRegistry.buildRulesFromTemplate(templateKey);

  doc.templateKey = templateKey;
  doc.rules = generatedRules;
  doc.betPhaseType = template.betPhaseType;
};

gameTypeSchema.pre('validate', function gameTypePreValidate(next) {
  const done = typeof next === 'function' ? next : (error) => {
    if (error) {
      throw error;
    }
  };

  try {
    applyTemplateIntegrity(this);

    if (!Number.isInteger(this.rulesVersion) || this.rulesVersion < 1) {
      this.rulesVersion = 1;
    }

    if (!this.isNew && this.isModified('templateKey')) {
      this.rulesVersion += 1;
    }

    done();
  } catch (error) {
    done(error);
  }
});

gameTypeSchema.pre('findOneAndUpdate', function gameTypePreFindOneAndUpdate(next) {
  const done = typeof next === 'function' ? next : (error) => {
    if (error) {
      throw error;
    }
  };

  try {
    const update = this.getUpdate() || {};
    const set = update.$set || update;

    if (Object.prototype.hasOwnProperty.call(set, 'rules') || Object.prototype.hasOwnProperty.call(set, 'betPhaseType')) {
      return done(new Error('Direct rule mutation is not allowed. Update templateKey only.'));
    }

    const nextTemplateKey = set.templateKey || GameTypeRegistry.inferTemplateKey({ code: set.code });
    if (!nextTemplateKey) {
      return done();
    }

    const template = GameTypeRegistry.getTemplate(nextTemplateKey);
    const generatedRules = GameTypeRegistry.buildRulesFromTemplate(nextTemplateKey);

    this.setUpdate({
      ...update,
      $set: {
        ...set,
        templateKey: nextTemplateKey,
        rules: generatedRules,
        betPhaseType: template.betPhaseType,
      },
      $inc: {
        ...(update.$inc || {}),
        rulesVersion: 1,
      },
    });

    return done();
  } catch (error) {
    return done(error);
  }
});

module.exports = mongoose.model('GameType', gameTypeSchema);
