const config = require('@config');
const mongoose = require('mongoose');
const globalTransform = require('@utils/mongooseTransform');
const logger = require('@utils/logger');

mongoose.plugin(globalTransform);

const connectDB = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI,
      {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
      },
    );

    logger.info({
      message: 'database.connected',
      host: mongoose.connection?.host || null,
      databaseName: mongoose.connection?.name || null,
    });
    return mongoose.connection;
  } catch (error) {
    logger.error({
      message: 'database.connection_failed',
      error: {
        name: error?.name || 'Error',
        message: error?.message || 'Database connection failed',
        stack: error?.stack,
      },
    });
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info({
      message: 'database.disconnected',
    });
  } catch (error) {
    logger.error({
      message: 'database.disconnection_failed',
      error: {
        name: error?.name || 'Error',
        message: error?.message || 'Database disconnection failed',
        stack: error?.stack,
      },
    });
    throw error;
  }
};

module.exports = { connectDB, disconnectDB };
