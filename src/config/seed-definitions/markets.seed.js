const { GAME_TYPE_CODES } = require('@config/constants/gameTypes');
const { MARKET_STATUS } = require('@config/constants/domain');
const { WEEKDAY_KEYS } = require('@domain/markets/marketSchedule');

const DEFAULT_WEEKLY_SCHEDULE = Object.freeze(
  WEEKDAY_KEYS.reduce((schedule, weekday) => {
    schedule[weekday] = true;
    return schedule;
  }, {}),
);

const buildMarketDefinition = ({ code, name, openTime, closeTime }) => ({
  code,
  name,
  openTime,
  closeTime,
  schedule: DEFAULT_WEEKLY_SCHEDULE,
  gameTypeCodes: GAME_TYPE_CODES,
  status: MARKET_STATUS.ACTIVE,
});

module.exports = Object.freeze([
  buildMarketDefinition({ code: 'BHARAT_MORNING', name: 'Bharat Morning', openTime: '09:30', closeTime: '10:00' }),
  buildMarketDefinition({ code: 'SRIDEVI_MORNING', name: 'Sridevi Morning', openTime: '09:45', closeTime: '10:20' }),
  buildMarketDefinition({ code: 'KARNATAKA_DAY', name: 'Karnataka Day', openTime: '10:20', closeTime: '11:20' }),
  buildMarketDefinition({ code: 'MILAN_MORNING', name: 'Milan Morning', openTime: '10:25', closeTime: '11:25' }),
  buildMarketDefinition({ code: 'KALYAN_MORNING', name: 'Kalyan Morning', openTime: '10:50', closeTime: '11:50' }),
  buildMarketDefinition({ code: 'SRIDEVI_DAY', name: 'Sridevi Day', openTime: '11:25', closeTime: '12:25' }),
  buildMarketDefinition({ code: 'MADHUR_MORNING', name: 'Madhur Morning', openTime: '11:35', closeTime: '12:35' }),
  buildMarketDefinition({ code: 'TIME_BAZAR', name: 'Time Bazaar', openTime: '12:50', closeTime: '13:50' }),
  buildMarketDefinition({ code: 'BHARAT_DAY', name: 'Bharat Day', openTime: '13:00', closeTime: '15:00' }),
  buildMarketDefinition({ code: 'MADHUR_DAY', name: 'Madhur Day', openTime: '13:35', closeTime: '14:35' }),
  buildMarketDefinition({ code: 'MILAN_DAY', name: 'Milan Day', openTime: '14:50', closeTime: '16:50' }),
  buildMarketDefinition({ code: 'RAJDHANI_DAY', name: 'Rajdhani Day', openTime: '15:10', closeTime: '17:10' }),
  buildMarketDefinition({ code: 'SUPREME_DAY', name: 'Supreme Day', openTime: '15:25', closeTime: '17:25' }),
  buildMarketDefinition({ code: 'KALYAN_DAY', name: 'Kalyan Day', openTime: '15:30', closeTime: '17:30' }),
  buildMarketDefinition({ code: 'KARNATAKA_NIGHT', name: 'Karnataka Night', openTime: '18:45', closeTime: '19:45' }),
  buildMarketDefinition({ code: 'SRIDEVI_NIGHT', name: 'Sridevi Night', openTime: '19:00', closeTime: '20:00' }),
  buildMarketDefinition({ code: 'BHARAT_NIGHT', name: 'Bharat Night', openTime: '19:30', closeTime: '20:30' }),
  buildMarketDefinition({ code: 'MADHUR_NIGHT', name: 'Madhur Night', openTime: '20:10', closeTime: '22:30' }),
  buildMarketDefinition({ code: 'SUPREME_NIGHT', name: 'Supreme Night', openTime: '20:35', closeTime: '22:35' }),
  buildMarketDefinition({ code: 'MILAN_NIGHT', name: 'Milan Night', openTime: '20:55', closeTime: '22:55' }),
  buildMarketDefinition({ code: 'KALYAN_NIGHT', name: 'Kalyan Night', openTime: '21:20', closeTime: '23:20' }),
  buildMarketDefinition({ code: 'RAJDHANI_NIGHT', name: 'Rajdhani Night', openTime: '21:35', closeTime: '23:45' }),
  buildMarketDefinition({ code: 'MAIN_BAZAR', name: 'Main Bazaar', openTime: '21:55', closeTime: '23:59' }),
]);
