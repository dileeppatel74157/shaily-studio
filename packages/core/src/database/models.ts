import { DatabaseState }          from "./DatabaseState";
import { DatabaseProvider }       from "./DatabaseProvider";
import { ConnectionState }        from "./ConnectionState";
import { TransactionState }       from "./TransactionState";
import { MigrationState }         from "./MigrationState";
import { CachePolicy }            from "./CachePolicy";
import { DatabaseEventType }      from "./DatabaseEventType";
import { DatabaseValidationResult } from "./DatabaseValidationResult";

// ─── Connection ───────────────────────────────────────────────────────────────

export interface DatabaseConnection {
  id: string;
  provider: DatabaseProvider;
  state: ConnectionState;
  host?: string;
  port?: number;
  database?: string;
  filePath?: string;        // SQLite
  url?: string;             // Qdrant / PostgreSQL DSN
  poolId?: string;
  createdAt: Date;
  lastActivityAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface DatabaseConfiguration {
  provider: DatabaseProvider;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  filePath?: string;
  url?: string;
  poolSize?: number;
  maxConnections?: number;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
  enableWAL?: boolean;           // SQLite WAL mode
  enableSSL?: boolean;
  cachePolicy?: CachePolicy;
  cacheTTLMs?: number;
  maxCacheEntries?: number;
  metadata?: Record<string, unknown>;
}

// ─── Connection Pool ──────────────────────────────────────────────────────────

export interface ConnectionPool {
  id: string;
  provider: DatabaseProvider;
  minSize: number;
  maxSize: number;
  activeCount: number;
  idleCount: number;
  waitingCount: number;
  totalAcquired: number;
  totalReleased: number;
  createdAt: Date;
}

// ─── Transaction ──────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  connectionId: string;
  state: TransactionState;
  isolationLevel: "READ_UNCOMMITTED" | "READ_COMMITTED" | "REPEATABLE_READ" | "SERIALIZABLE";
  startedAt: Date;
  committedAt?: Date;
  rolledBackAt?: Date;
  operations: string[];
  metadata?: Record<string, unknown>;
}

// ─── Migration ────────────────────────────────────────────────────────────────

export interface Migration {
  id: string;
  version: number;
  name: string;
  description?: string;
  state: MigrationState;
  upSql: string;
  downSql?: string;
  checksum: string;
  appliedAt?: Date;
  rolledBackAt?: Date;
  durationMs?: number;
  error?: string;
}

// ─── Query ────────────────────────────────────────────────────────────────────

export interface QueryRequest {
  id: string;
  sql?: string;
  collection?: string;       // Qdrant collection
  filter?: Record<string, unknown>;
  params?: unknown[];
  transactionId?: string;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface QueryResponse {
  id: string;
  requestId: string;
  rows?: unknown[];
  rowsAffected?: number;
  durationMs: number;
  fromCache: boolean;
  error?: string;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

export interface CacheEntry {
  key: string;
  value: unknown;
  policy: CachePolicy;
  createdAt: Date;
  expiresAt?: Date;
  hitCount: number;
  dirty: boolean;             // write-back dirty flag
}

// ─── Backup / Restore ─────────────────────────────────────────────────────────

export interface BackupSnapshot {
  id: string;
  provider: DatabaseProvider;
  filePath: string;
  sizeBytes: number;
  checksum: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface RestoreReport {
  id: string;
  snapshotId: string;
  success: boolean;
  restoredAt: Date;
  durationMs: number;
  tablesRestored?: number;
  error?: string;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export interface HealthReport {
  timestamp: Date;
  state: DatabaseState;
  score: number;              // 0–100
  connections: { total: number; active: number; failed: number };
  migrations: { applied: number; pending: number };
  cacheHitRate: number;
  avgQueryMs: number;
  details?: Record<string, unknown>;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export interface DatabaseStatistics {
  totalQueries: number;
  totalWrites: number;
  totalReads: number;
  cacheHits: number;
  cacheMisses: number;
  totalTransactions: number;
  committedTransactions: number;
  rolledBackTransactions: number;
  totalMigrationsApplied: number;
  totalBackups: number;
  totalRestores: number;
  avgQueryMs: number;
  uptimeMs: number;
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

export interface DatabaseSnapshot {
  timestamp: Date;
  state: DatabaseState;
  connections: DatabaseConnection[];
  pool?: ConnectionPool;
  migrations: Migration[];
  statistics: DatabaseStatistics;
  health: HealthReport;
  metadata?: Record<string, unknown>;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export interface DatabaseEvent {
  type: DatabaseEventType;
  timestamp: Date;
  payload?: unknown;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationIssue {
  rule: string;
  result: DatabaseValidationResult;
  message: string;
  context?: Record<string, unknown>;
}

export interface ValidationReport {
  timestamp: Date;
  valid: boolean;
  issues: ValidationIssue[];
}
