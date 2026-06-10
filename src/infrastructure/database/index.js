module.exports = {
  connectDB: require('./connection').connectDB,
  disconnectDB: require('./connection').disconnectDB,
  RepositoryFactory: require('../repositories/repositoryFactory'),
};
