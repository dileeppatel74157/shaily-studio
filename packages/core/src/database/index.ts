// ─── Enums ────────────────────────────────────────────────────────────────────
export { DatabaseState }            from "./DatabaseState";
export { DatabaseProvider }         from "./DatabaseProvider";
export { ConnectionState }          from "./ConnectionState";
export { TransactionState }         from "./TransactionState";
export { MigrationState }           from "./MigrationState";
export { CachePolicy }              from "./CachePolicy";
export { DatabaseEventType }        from "./DatabaseEventType";
export { DatabaseValidationResult } from "./DatabaseValidationResult";

// ─── Models ───────────────────────────────────────────────────────────────────
export type {
  DatabaseConnection,
  DatabaseConfiguration,
  ConnectionPool,
  Transaction,
  Migration,
  QueryRequest,
  QueryResponse,
  CacheEntry,
  BackupSnapshot,
  RestoreReport,
  HealthReport,
  DatabaseStatistics,
  DatabaseSnapshot,
  DatabaseEvent,
  ValidationIssue,
  ValidationReport
} from "./models";

// ─── Interfaces ───────────────────────────────────────────────────────────────
export type {
  IDatabaseEngine,
  IConnectionManager,
  IMigrationManager,
  ITransactionManager,
  IQueryManager,
  ICacheManager,
  IBackupManager,
  IRestoreManager,
  IHealthManager,
  IStatisticsManager,
  IProviderManager
} from "./interfaces";

// ─── Exceptions & Utilities ───────────────────────────────────────────────────
export {
  DatabaseException,
  ConnectionException,
  TransactionException,
  MigrationException,
  QueryException,
  BackupException,
  RestoreException,
  DatabaseValidationException,
  InvalidDatabaseStateException,
  deepFreeze
} from "./types";

// ─── Engine, Builder, Validator ───────────────────────────────────────────────
export { DatabaseEngine }    from "./DatabaseEngine";
export { DatabaseBuilder }   from "./DatabaseBuilder";
export { DatabaseValidator } from "./DatabaseValidator";
