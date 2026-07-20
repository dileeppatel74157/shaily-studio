import { DatabaseState }    from "./DatabaseState";
import { DatabaseProvider } from "./DatabaseProvider";
import { DatabaseEventType } from "./DatabaseEventType";
import {
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
  DatabaseEvent
} from "./models";

// ─── Primary Engine Interface ─────────────────────────────────────────────────

export interface IDatabaseEngine {
  /** Lifecycle */
  initialize(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  /** State */
  getState(): DatabaseState;
  getSnapshot(): DatabaseSnapshot;

  /** Connection Management */
  getConnectionManager(): IConnectionManager;

  /** Migration */
  getMigrationManager(): IMigrationManager;

  /** Transaction */
  getTransactionManager(): ITransactionManager;

  /** Query */
  getQueryManager(): IQueryManager;

  /** Cache */
  getCacheManager(): ICacheManager;

  /** Backup */
  getBackupManager(): IBackupManager;

  /** Restore */
  getRestoreManager(): IRestoreManager;

  /** Health */
  getHealthManager(): IHealthManager;

  /** Statistics */
  getStatisticsManager(): IStatisticsManager;

  /** Provider */
  getProviderManager(): IProviderManager;

  /** Events */
  on(eventType: DatabaseEventType, handler: (event: DatabaseEvent) => void): void;
  off(eventType: DatabaseEventType, handler: (event: DatabaseEvent) => void): void;
  emit(eventType: DatabaseEventType, payload?: unknown): void;
}

// ─── Internal Manager Interfaces ─────────────────────────────────────────────

export interface IConnectionManager {
  connect(config: DatabaseConfiguration): Promise<DatabaseConnection>;
  disconnect(connectionId: string): Promise<void>;
  reconnect(connectionId: string): Promise<void>;
  getConnection(id: string): DatabaseConnection | undefined;
  listConnections(): DatabaseConnection[];
  getPool(): ConnectionPool | undefined;
}

export interface IMigrationManager {
  runMigrations(): Promise<Migration[]>;
  rollbackMigration(version: number): Promise<void>;
  listMigrations(): Migration[];
  getPendingMigrations(): Migration[];
  getAppliedMigrations(): Migration[];
}

export interface ITransactionManager {
  beginTransaction(connectionId: string, isolationLevel?: string): Promise<Transaction>;
  commitTransaction(transactionId: string): Promise<void>;
  rollbackTransaction(transactionId: string): Promise<void>;
  getTransaction(transactionId: string): Transaction | undefined;
  listActiveTransactions(): Transaction[];
}

export interface IQueryManager {
  execute(request: QueryRequest): Promise<QueryResponse>;
  executeMany(requests: QueryRequest[]): Promise<QueryResponse[]>;
}

export interface ICacheManager {
  get(key: string): unknown | undefined;
  set(key: string, value: unknown, policy?: string, ttlMs?: number): void;
  delete(key: string): boolean;
  invalidate(pattern?: string): number;
  listEntries(): CacheEntry[];
  getStats(): { hits: number; misses: number; size: number };
}

export interface IBackupManager {
  createBackup(filePath?: string): Promise<BackupSnapshot>;
  listBackups(): BackupSnapshot[];
  deleteBackup(snapshotId: string): boolean;
}

export interface IRestoreManager {
  restore(snapshotId: string): Promise<RestoreReport>;
  listReports(): RestoreReport[];
}

export interface IHealthManager {
  checkHealth(): Promise<HealthReport>;
  getLastReport(): HealthReport | undefined;
}

export interface IStatisticsManager {
  getStatistics(): DatabaseStatistics;
  reset(): void;
}

export interface IProviderManager {
  getActiveProvider(): DatabaseProvider;
  supportsProvider(provider: DatabaseProvider): boolean;
  switchProvider(provider: DatabaseProvider, config: DatabaseConfiguration): Promise<void>;
}
