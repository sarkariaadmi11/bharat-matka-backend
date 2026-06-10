/**
 * Repository Factory
 * Creates and manages repository instances
 * Isolates database operations from business logic
 */

const UserRepository = require('./userRepository');
const AuthRepository = require('./authRepository');
const WalletRepository = require('./walletRepository');
const BetRepository = require('./betRepository');
const GameSessionRepository = require('./gameSessionRepo');
const TransactionRepository = require('./transactionRepository');
const PaymentRepository = require('./paymentRepository');
const PayoutRepository = require('./payoutRepository');
const BankDetailRepository = require('./bankDetailRepository');
const GlobalConfigRepository = require('./globalConfigRepository');
const MarketRepository = require('./marketRepository');
const RoleRepository = require('./roleRepository');
const PermissionRepository = require('./permissionRepository');
const GameTypeRepository = require('./gameTypeRepo');
const LogRepository = require('./logRepository');
const UserDeviceRepository = require('./userDeviceRepository');
const SessionExposureRepository = require('./sessionExposureRepository');
const UserRoleRepository = require('./userRoleRepository');
const RolePermissionRepository = require('./rolePermissionRepository');
const SettlementJobRepository = require('./settlementJobRepository');
const RevertBatchRepository = require('./revertBatchRepository');
const ResultAuditRecordRepository = require('./resultAuditRecordRepository');
const AdminAnalyticsRepository = require('./adminAnalyticsRepository');

class RepositoryFactory {
  static repositories = {};

  static getRepository(entityName) {
    if (!this.repositories[entityName]) {
      this.repositories[entityName] = this.createRepository(entityName);
    }
    return this.repositories[entityName];
  }

  static createRepository(entityName) {
    switch (entityName) {
      case 'User':
        return new UserRepository();
      case 'Auth':
        return new AuthRepository();
      case 'Wallet':
        return new WalletRepository();
      case 'Bet':
        return new BetRepository();
      case 'GameSession':
        return new GameSessionRepository();
      case 'Transaction':
        return new TransactionRepository();
      case 'Payment':
        return new PaymentRepository();
      case 'Payout':
        return new PayoutRepository();
      case 'BankDetail':
        return new BankDetailRepository();
      case 'GlobalConfig':
        return new GlobalConfigRepository();
      case 'Market':
        return new MarketRepository();
      case 'Role':
        return new RoleRepository();
      case 'Permission':
        return new PermissionRepository();
      case 'GameType':
        return new GameTypeRepository();
      case 'Log':
        return new LogRepository();
      case 'UserDevice':
        return new UserDeviceRepository();
      case 'SessionExposure':
        return new SessionExposureRepository();
      case 'UserRole':
        return new UserRoleRepository();
      case 'RolePermission':
        return new RolePermissionRepository();
      case 'SettlementJob':
        return new SettlementJobRepository();
      case 'RevertBatch':
        return new RevertBatchRepository();
      case 'ResultAuditRecord':
        return new ResultAuditRecordRepository();
      case 'AdminAnalytics':
        return new AdminAnalyticsRepository();
      default:
        throw new Error(`Repository for ${entityName} not found`);
    }
  }

  static registerRepository(entityName, RepositoryClass) {
    this.repositories[entityName] = new RepositoryClass();
  }
}

module.exports = RepositoryFactory;

