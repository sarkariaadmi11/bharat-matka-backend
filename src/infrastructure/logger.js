const fs = require('fs');
const path = require('path');
const pino = require('pino');
const pinoPretty = require('pino-pretty');
const config = require('@config');

const level = config.LOG_LEVEL || (config.NODE_ENV === 'production' ? 'info' : 'debug');
const logDir = path.join(process.cwd(), 'logs');
const logFilePath = path.join(logDir, 'application.log');
const colorize = process.env.NO_COLOR
  ? false
  : process.env.FORCE_COLOR
    ? true
    : Boolean(process.stdout.isTTY);

const createPrettyStream = () => pinoPretty({
  colorize,
  translateTime: 'yyyy-mm-dd HH:MM:ss.l',
  ignore: 'pid,hostname',
  singleLine: false,
  messageKey: 'message',
  errorLikeObjectKeys: ['err', 'error'],
  messageFormat: (log, messageKey) => {
    const message = log[messageKey] || 'log';
    const event = log.event ? ` (${log.event})` : '';

    if (log.message === 'server.started') {
      return `Server started${event}\n    Listening on http://localhost:${log.port}/api/${log.apiVersion}\n    Environment: ${log.env}`;
    }

    if (log.message === 'database.connected') {
      const host = log.host ? ` @ ${log.host}` : '';
      return `MongoDB connected${event}\n    Database: ${log.databaseName || 'default'}${host}`;
    }

    return `${message}${event}`;
  },
});

const createLogger = () => {
  fs.mkdirSync(logDir, { recursive: true });

  return pino(
    {
      level,
      messageKey: 'message',
      base: {
        service: 'betting-backend',
        env: config.NODE_ENV,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
      },
    },
    pino.multistream([
      { stream: pino.destination({ dest: logFilePath, sync: false }) },
      { stream: createPrettyStream() },
    ]),
  );
};

const logger = createLogger();

module.exports = logger;
module.exports.LOG_FILE_PATH = logFilePath;
