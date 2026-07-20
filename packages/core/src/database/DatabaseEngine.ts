import { IDatabaseEngine, IConnectionManager, IMigrationManager, ITransactionManager,
  IQueryManager, ICacheManager, IBackupManager, IRestoreManager,
  IHealthManager, IStatisticsManager, IProviderManager } from "./interfaces";
import { DatabaseState }          from "./DatabaseState";
import { DatabaseProvider }       from "./DatabaseProvider";
import { ConnectionState }        from "./ConnectionState";
import { TransactionState }       from "./TransactionState";
import { MigrationState }         from "./MigrationState";
import { CachePolicy }            from "./CachePolicy";
import { DatabaseEventType }      from "./DatabaseEventType";
import { DatabaseValidator }      from "./DatabaseValidator";
import {
  DatabaseConnection, DatabaseConfiguration, ConnectionPool,
  Transaction, Migration, QueryRequest, QueryResponse,
  CacheEntry, BackupSnapshot, RestoreReport, HealthReport,
  DatabaseStatistics, DatabaseSnapshot, DatabaseEvent
} from "./models";
import {
  DatabaseException, ConnectionException, TransactionException,
  MigrationException, QueryException, BackupException, RestoreException,
  InvalidDatabaseStateException, deepFreeze
} from "./types";

// ─── Internal Helper Types ────────────────────────────────────────────────────

interface StatsAccumulator {
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
  totalQueryMs: number;
  startedAt: Date;
}

// ─── ConnectionManagerImpl ────────────────────────────────────────────────────

class ConnectionManagerImpl implements IConnectionManager {
  private readonly _connections = new Map<string, DatabaseConnection>();
  private _pool: ConnectionPool | undefined;

  constructor(private readonly _engine: DatabaseEngine) {}

  async connect(config: DatabaseConfiguration): Promise<DatabaseConnection> {
    const id = `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const conn: DatabaseConnection = {
      id,
      provider: config.provider,
      state: ConnectionState.CONNECTING,
      host: config.host,
      port: config.port,
      database: config.database,
      filePath: config.filePath,
      url: config.url,
      createdAt: new Date()
    };
    this._connections.set(id, conn);

    // Simulate async connection handshake
    await new Promise(r => setTimeout(r, 0));
    conn.state = ConnectionState.CONNECTED;
    conn.lastActivityAt = new Date();

    // Initialise pool if first connection
    if (!this._pool) {
      this._pool = {
        id: `pool-${id}`,
        provider: config.provider,
        minSize: 1,
        maxSize: config.maxConnections ?? config.poolSize ?? 10,
        activeCount: 1,
        idleCount: 0,
        waitingCount: 0,
        totalAcquired: 1,
        totalReleased: 0,
        createdAt: new Date()
      };
    } else {
      this._pool.activeCount++;
      this._pool.totalAcquired++;
    }

    return conn;
  }

  async disconnect(connectionId: string): Promise<void> {
    const conn = this._connections.get(connectionId);
    if (!conn) return;
    conn.state = ConnectionState.DISCONNECTED;
    this._connections.delete(connectionId);
    if (this._pool && this._pool.activeCount > 0) {
      this._pool.activeCount--;
      this._pool.totalReleased++;
    }
  }

  async reconnect(connectionId: string): Promise<void> {
    const conn = this._connections.get(connectionId);
    if (!conn) throw new ConnectionException(`Connection "${connectionId}" not found.`);
    conn.state = ConnectionState.RECONNECTING;
    await new Promise(r => setTimeout(r, 0));
    conn.state = ConnectionState.CONNECTED;
    conn.lastActivityAt = new Date();
  }

  getConnection(id: string): DatabaseConnection | undefined {
    return this._connections.get(id);
  }

  listConnections(): DatabaseConnection[] {
    return Array.from(this._connections.values());
  }

  getPool(): ConnectionPool | undefined {
    return this._pool;
  }
}

// ─── MigrationManagerImpl ─────────────────────────────────────────────────────

class MigrationManagerImpl implements IMigrationManager {
  private readonly _migrations: Migration[] = [];

  constructor(private readonly _engine: DatabaseEngine) {
    // Seed three built-in baseline migrations
    this._migrations.push(
      {
        id: "mig-001", version: 1, name: "create_core_schema",
        description: "Bootstrap core schema tables", state: MigrationState.PENDING,
        upSql: "CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT);",
        downSql: "DROP TABLE IF EXISTS _migrations;",
        checksum: "abc123"
      },
      {
        id: "mig-002", version: 2, name: "create_events_table",
        description: "Create event log table", state: MigrationState.PENDING,
        upSql: "CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, type TEXT, payload TEXT, ts TEXT);",
        downSql: "DROP TABLE IF EXISTS events;",
        checksum: "def456"
      },
      {
        id: "mig-003", version: 3, name: "create_cache_table",
        description: "Create persistent cache table", state: MigrationState.PENDING,
        upSql: "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT, expires_at TEXT);",
        downSql: "DROP TABLE IF EXISTS cache;",
        checksum: "ghi789"
      }
    );
  }

  async runMigrations(): Promise<Migration[]> {
    const pending = this._migrations.filter(m => m.state === MigrationState.PENDING);
    for (const m of pending) {
      m.state = MigrationState.RUNNING;
      await new Promise(r => setTimeout(r, 0));
      m.state = MigrationState.COMPLETED;
      m.appliedAt = new Date();
      m.durationMs = Math.floor(Math.random() * 20) + 1;
      this._engine._stats.totalMigrationsApplied++;
    }
    return this._migrations;
  }

  async rollbackMigration(version: number): Promise<void> {
    const m = this._migrations.find(x => x.version === version);
    if (!m) throw new MigrationException(`Migration version ${version} not found.`);
    if (m.state !== MigrationState.COMPLETED) {
      throw new MigrationException(`Migration ${version} cannot be rolled back in state ${m.state}.`);
    }
    if (!m.downSql) throw new MigrationException(`Migration ${version} has no rollback script.`);
    m.state = MigrationState.ROLLED_BACK;
    m.rolledBackAt = new Date();
  }

  listMigrations(): Migration[] { return [...this._migrations]; }
  getPendingMigrations(): Migration[] { return this._migrations.filter(m => m.state === MigrationState.PENDING); }
  getAppliedMigrations(): Migration[] { return this._migrations.filter(m => m.state === MigrationState.COMPLETED); }
}

// ─── TransactionManagerImpl ───────────────────────────────────────────────────

class TransactionManagerImpl implements ITransactionManager {
  private readonly _transactions = new Map<string, Transaction>();

  constructor(private readonly _engine: DatabaseEngine) {}

  async beginTransaction(connectionId: string, isolationLevel = "READ_COMMITTED"): Promise<Transaction> {
    const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tx: Transaction = {
      id, connectionId,
      state: TransactionState.CREATED,
      isolationLevel: isolationLevel as Transaction["isolationLevel"],
      startedAt: new Date(),
      operations: []
    };
    this._transactions.set(id, tx);
    tx.state = TransactionState.ACTIVE;
    this._engine._stats.totalTransactions++;
    return tx;
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const tx = this._transactions.get(transactionId);
    if (!tx) throw new TransactionException(`Transaction "${transactionId}" not found.`);
    if (tx.state !== TransactionState.ACTIVE) {
      throw new TransactionException(`Cannot commit transaction in state "${tx.state}".`);
    }
    tx.state = TransactionState.COMMITTED;
    tx.committedAt = new Date();
    this._engine._stats.committedTransactions++;
    this._engine.emit(DatabaseEventType.TRANSACTION_COMMITTED, { transactionId });
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const tx = this._transactions.get(transactionId);
    if (!tx) throw new TransactionException(`Transaction "${transactionId}" not found.`);
    if (tx.state !== TransactionState.ACTIVE) {
      throw new TransactionException(`Cannot rollback transaction in state "${tx.state}".`);
    }
    tx.state = TransactionState.ROLLED_BACK;
    tx.rolledBackAt = new Date();
    this._engine._stats.rolledBackTransactions++;
    this._engine.emit(DatabaseEventType.TRANSACTION_ROLLED_BACK, { transactionId });
  }

  getTransaction(transactionId: string): Transaction | undefined {
    return this._transactions.get(transactionId);
  }

  listActiveTransactions(): Transaction[] {
    return Array.from(this._transactions.values()).filter(t => t.state === TransactionState.ACTIVE);
  }
}

// ─── QueryManagerImpl ─────────────────────────────────────────────────────────

class QueryManagerImpl implements IQueryManager {
  constructor(
    private readonly _engine: DatabaseEngine,
    private readonly _cache: CacheManagerImpl
  ) {}

  async execute(request: QueryRequest): Promise<QueryResponse> {
    DatabaseValidator.validateQueryRequest(request);

    const start = Date.now();
    const isWrite = request.sql
      ? /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(request.sql)
      : false;

    // Cache lookup for reads
    if (!isWrite && this._cache) {
      const cached = this._cache.get(request.id);
      if (cached !== undefined) {
        this._engine._stats.cacheHits++;
        this._engine._stats.totalReads++;
        return {
          id: `resp-${Date.now()}`,
          requestId: request.id,
          rows: cached as unknown[],
          durationMs: Date.now() - start,
          fromCache: true
        };
      }
      this._engine._stats.cacheMisses++;
    }

    // Simulate execution
    await new Promise(r => setTimeout(r, 0));
    const rows = isWrite ? [] : [{ id: "row-1", data: "sample" }];

    const durationMs = Date.now() - start;
    this._engine._stats.totalQueries++;
    this._engine._stats.totalQueryMs += durationMs;
    if (isWrite) {
      this._engine._stats.totalWrites++;
    } else {
      this._engine._stats.totalReads++;
      // Populate cache
      if (this._engine._config?.cachePolicy !== CachePolicy.NONE) {
        this._cache.set(request.id, rows, this._engine._config?.cachePolicy);
      }
    }

    return {
      id: `resp-${Date.now()}`,
      requestId: request.id,
      rows,
      rowsAffected: isWrite ? 1 : undefined,
      durationMs,
      fromCache: false
    };
  }

  async executeMany(requests: QueryRequest[]): Promise<QueryResponse[]> {
    return Promise.all(requests.map(r => this.execute(r)));
  }
}

// ─── CacheManagerImpl ─────────────────────────────────────────────────────────

class CacheManagerImpl implements ICacheManager {
  private readonly _store = new Map<string, CacheEntry>();

  constructor(private readonly _engine: DatabaseEngine) {}

  get(key: string): unknown | undefined {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this._store.delete(key);
      return undefined;
    }
    entry.hitCount++;
    return entry.value;
  }

  set(key: string, value: unknown, policy: any = CachePolicy.READ_THROUGH, ttlMs?: number): void {
    const entry: CacheEntry = {
      key, value,
      policy: policy as CachePolicy,
      createdAt: new Date(),
      expiresAt: ttlMs ? new Date(Date.now() + ttlMs) : undefined,
      hitCount: 0,
      dirty: policy === CachePolicy.WRITE_BACK
    };
    this._store.set(key, entry);
  }

  delete(key: string): boolean {
    return this._store.delete(key);
  }

  invalidate(pattern?: string): number {
    if (!pattern) {
      const count = this._store.size;
      this._store.clear();
      this._engine.emit(DatabaseEventType.CACHE_INVALIDATED, { pattern: "*", count });
      return count;
    }
    const regex = new RegExp(pattern);
    let count = 0;
    for (const key of this._store.keys()) {
      if (regex.test(key)) { this._store.delete(key); count++; }
    }
    this._engine.emit(DatabaseEventType.CACHE_INVALIDATED, { pattern, count });
    return count;
  }

  listEntries(): CacheEntry[] {
    return Array.from(this._store.values());
  }

  getStats(): { hits: number; misses: number; size: number } {
    return {
      hits: this._engine._stats.cacheHits,
      misses: this._engine._stats.cacheMisses,
      size: this._store.size
    };
  }
}

// ─── BackupManagerImpl ────────────────────────────────────────────────────────

class BackupManagerImpl implements IBackupManager {
  private readonly _snapshots: BackupSnapshot[] = [];

  constructor(private readonly _engine: DatabaseEngine) {}

  async createBackup(filePath?: string): Promise<BackupSnapshot> {
    const id = `bkp-${Date.now()}`;
    const path = filePath ?? `./backups/${id}.db`;
    const snapshot: BackupSnapshot = {
      id, provider: this._engine._activeProvider,
      filePath: path,
      sizeBytes: Math.floor(Math.random() * 1024 * 1024) + 1024,
      checksum: `sha256-${id}`,
      createdAt: new Date()
    };
    DatabaseValidator.validateBackupSnapshot(snapshot);
    this._snapshots.push(snapshot);
    this._engine._stats.totalBackups++;
    this._engine.emit(DatabaseEventType.BACKUP_CREATED, { snapshotId: id });
    return snapshot;
  }

  listBackups(): BackupSnapshot[] { return [...this._snapshots]; }

  deleteBackup(snapshotId: string): boolean {
    const idx = this._snapshots.findIndex(s => s.id === snapshotId);
    if (idx < 0) return false;
    this._snapshots.splice(idx, 1);
    return true;
  }
}

// ─── RestoreManagerImpl ───────────────────────────────────────────────────────

class RestoreManagerImpl implements IRestoreManager {
  private readonly _reports: RestoreReport[] = [];

  constructor(
    private readonly _engine: DatabaseEngine,
    private readonly _backup: BackupManagerImpl
  ) {}

  async restore(snapshotId: string): Promise<RestoreReport> {
    const snapshot = this._backup.listBackups().find(s => s.id === snapshotId);
    if (!snapshot) throw new RestoreException(`Backup snapshot "${snapshotId}" not found.`);

    DatabaseValidator.validateRestoreCompatibility(snapshot, this._engine._activeProvider);
    const start = Date.now();
    await new Promise(r => setTimeout(r, 0));

    const report: RestoreReport = {
      id: `rst-${Date.now()}`,
      snapshotId,
      success: true,
      restoredAt: new Date(),
      durationMs: Date.now() - start,
      tablesRestored: 3
    };
    this._reports.push(report);
    this._engine._stats.totalRestores++;
    this._engine.emit(DatabaseEventType.RESTORE_COMPLETED, { snapshotId, reportId: report.id });
    return report;
  }

  listReports(): RestoreReport[] { return [...this._reports]; }
}

// ─── HealthManagerImpl ────────────────────────────────────────────────────────

class HealthManagerImpl implements IHealthManager {
  private _lastReport: HealthReport | undefined;

  constructor(private readonly _engine: DatabaseEngine) {}

  async checkHealth(): Promise<HealthReport> {
    const connections = this._engine.getConnectionManager().listConnections();
    const active = connections.filter(c => c.state === ConnectionState.CONNECTED).length;
    const failed = connections.filter(c => c.state === ConnectionState.FAILED).length;
    const stats = this._engine._stats;

    const cacheHitRate = stats.cacheHits + stats.cacheMisses > 0
      ? stats.cacheHits / (stats.cacheHits + stats.cacheMisses)
      : 1;

    const avgQueryMs = stats.totalQueries > 0
      ? stats.totalQueryMs / stats.totalQueries
      : 0;

    const score = Math.max(0, 100 - failed * 20 - (avgQueryMs > 500 ? 10 : 0));

    this._lastReport = {
      timestamp: new Date(),
      state: this._engine.getState(),
      score,
      connections: { total: connections.length, active, failed },
      migrations: {
        applied: this._engine.getMigrationManager().getAppliedMigrations().length,
        pending: this._engine.getMigrationManager().getPendingMigrations().length
      },
      cacheHitRate,
      avgQueryMs,
    };
    return this._lastReport;
  }

  getLastReport(): HealthReport | undefined { return this._lastReport; }
}

// ─── StatisticsManagerImpl ────────────────────────────────────────────────────

class StatisticsManagerImpl implements IStatisticsManager {
  constructor(private readonly _engine: DatabaseEngine) {}

  getStatistics(): DatabaseStatistics {
    const s = this._engine._stats;
    return {
      totalQueries: s.totalQueries,
      totalWrites: s.totalWrites,
      totalReads: s.totalReads,
      cacheHits: s.cacheHits,
      cacheMisses: s.cacheMisses,
      totalTransactions: s.totalTransactions,
      committedTransactions: s.committedTransactions,
      rolledBackTransactions: s.rolledBackTransactions,
      totalMigrationsApplied: s.totalMigrationsApplied,
      totalBackups: s.totalBackups,
      totalRestores: s.totalRestores,
      avgQueryMs: s.totalQueries > 0 ? s.totalQueryMs / s.totalQueries : 0,
      uptimeMs: Date.now() - s.startedAt.getTime()
    };
  }

  reset(): void {
    const s = this._engine._stats;
    s.totalQueries = 0; s.totalWrites = 0; s.totalReads = 0;
    s.cacheHits = 0; s.cacheMisses = 0;
    s.totalTransactions = 0; s.committedTransactions = 0; s.rolledBackTransactions = 0;
    s.totalMigrationsApplied = 0; s.totalBackups = 0; s.totalRestores = 0;
    s.totalQueryMs = 0; s.startedAt = new Date();
  }
}

// ─── ProviderManagerImpl ──────────────────────────────────────────────────────

class ProviderManagerImpl implements IProviderManager {
  private readonly _supported = new Set<DatabaseProvider>([
    DatabaseProvider.SQLITE,
    DatabaseProvider.POSTGRESQL,
    DatabaseProvider.QDRANT,
    DatabaseProvider.MEMORY
  ]);

  constructor(private readonly _engine: DatabaseEngine) {}

  getActiveProvider(): DatabaseProvider {
    return this._engine._activeProvider;
  }

  supportsProvider(provider: DatabaseProvider): boolean {
    return this._supported.has(provider);
  }

  async switchProvider(provider: DatabaseProvider, config: DatabaseConfiguration): Promise<void> {
    if (!this._supported.has(provider)) {
      throw new DatabaseException(`Provider "${provider}" is not supported.`);
    }
    this._engine._activeProvider = provider;
    this._engine._config = config;
  }
}

// ─── DatabaseEngine ───────────────────────────────────────────────────────────

export class DatabaseEngine implements IDatabaseEngine {
  private _state: DatabaseState = DatabaseState.CREATED;

  /** @internal – accessed by sub-managers */ _activeProvider: DatabaseProvider;
  /** @internal */ _config: DatabaseConfiguration | undefined;
  /** @internal */ _stats: StatsAccumulator;

  private readonly _connectionManager: ConnectionManagerImpl;
  private readonly _migrationManager: MigrationManagerImpl;
  private readonly _transactionManager: TransactionManagerImpl;
  private readonly _cacheManager: CacheManagerImpl;
  private readonly _queryManager: QueryManagerImpl;
  private readonly _backupManager: BackupManagerImpl;
  private readonly _restoreManager: RestoreManagerImpl;
  private readonly _healthManager: HealthManagerImpl;
  private readonly _statisticsManager: StatisticsManagerImpl;
  private readonly _providerManager: ProviderManagerImpl;

  private readonly _eventHandlers = new Map<DatabaseEventType, Set<(e: DatabaseEvent) => void>>();

  constructor(
    private readonly _context: any,
    config: DatabaseConfiguration
  ) {
    DatabaseValidator.validateConfiguration(config);
    this._config = config;
    this._activeProvider = config.provider;

    this._stats = {
      totalQueries: 0, totalWrites: 0, totalReads: 0,
      cacheHits: 0, cacheMisses: 0,
      totalTransactions: 0, committedTransactions: 0, rolledBackTransactions: 0,
      totalMigrationsApplied: 0, totalBackups: 0, totalRestores: 0,
      totalQueryMs: 0, startedAt: new Date()
    };

    this._connectionManager   = new ConnectionManagerImpl(this);
    this._migrationManager    = new MigrationManagerImpl(this);
    this._transactionManager  = new TransactionManagerImpl(this);
    this._cacheManager        = new CacheManagerImpl(this);
    this._queryManager        = new QueryManagerImpl(this, this._cacheManager);
    this._backupManager       = new BackupManagerImpl(this);
    this._restoreManager      = new RestoreManagerImpl(this, this._backupManager);
    this._healthManager       = new HealthManagerImpl(this);
    this._statisticsManager   = new StatisticsManagerImpl(this);
    this._providerManager     = new ProviderManagerImpl(this);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this._state !== DatabaseState.CREATED) {
      throw new InvalidDatabaseStateException("initialize", this._state);
    }
    this._state = DatabaseState.INITIALIZING;
    // Run baseline migrations
    this._state = DatabaseState.MIGRATING;
    await this._migrationManager.runMigrations();
    this._state = DatabaseState.DISCONNECTED;
  }

  async connect(): Promise<void> {
    if (this._state !== DatabaseState.DISCONNECTED && this._state !== DatabaseState.INITIALIZING) {
      throw new InvalidDatabaseStateException("connect", this._state);
    }
    this._state = DatabaseState.CONNECTING;
    await this._connectionManager.connect(this._config!);
    this._state = DatabaseState.READY;
    this.emit(DatabaseEventType.CONNECTED, { provider: this._activeProvider });
  }

  async disconnect(): Promise<void> {
    if (this._state === DatabaseState.DISCONNECTED) return;
    const connections = this._connectionManager.listConnections();
    for (const c of connections) {
      await this._connectionManager.disconnect(c.id);
    }
    this._state = DatabaseState.DISCONNECTED;
    this.emit(DatabaseEventType.DISCONNECTED, {});
  }

  // ─── State / Snapshot ──────────────────────────────────────────────────────

  getState(): DatabaseState { return this._state; }

  getSnapshot(): DatabaseSnapshot {
    // Create plain-object copies of live mutable objects so deepFreeze
    // does not lock the engine's internal state.
    const connectionsCopy = this._connectionManager.listConnections().map(c => ({ ...c }));
    const migrationsCopy  = this._migrationManager.listMigrations().map(m => ({ ...m }));
    const rawPool = this._connectionManager.getPool();
    const poolCopy = rawPool ? { ...rawPool } : undefined;
    const lastHealth = this._healthManager.getLastReport();
    const healthCopy = lastHealth ? { ...lastHealth, connections: { ...lastHealth.connections }, migrations: { ...lastHealth.migrations } } : {
      timestamp: new Date(), state: this._state, score: 100,
      connections: { total: 0, active: 0, failed: 0 },
      migrations: { applied: 0, pending: 0 },
      cacheHitRate: 1, avgQueryMs: 0
    };
    return deepFreeze<DatabaseSnapshot>({
      timestamp: new Date(),
      state: this._state,
      connections: connectionsCopy,
      pool: poolCopy,
      migrations: migrationsCopy,
      statistics: this._statisticsManager.getStatistics(),
      health: healthCopy
    });
  }

  // ─── Manager Accessors ─────────────────────────────────────────────────────

  getConnectionManager():  IConnectionManager  { return this._connectionManager; }
  getMigrationManager():   IMigrationManager   { return this._migrationManager; }
  getTransactionManager(): ITransactionManager { return this._transactionManager; }
  getQueryManager():       IQueryManager       { return this._queryManager; }
  getCacheManager():       ICacheManager       { return this._cacheManager; }
  getBackupManager():      IBackupManager      { return this._backupManager; }
  getRestoreManager():     IRestoreManager     { return this._restoreManager; }
  getHealthManager():      IHealthManager      { return this._healthManager; }
  getStatisticsManager():  IStatisticsManager  { return this._statisticsManager; }
  getProviderManager():    IProviderManager    { return this._providerManager; }

  // ─── Events ────────────────────────────────────────────────────────────────

  on(eventType: DatabaseEventType, handler: (e: DatabaseEvent) => void): void {
    if (!this._eventHandlers.has(eventType)) {
      this._eventHandlers.set(eventType, new Set());
    }
    this._eventHandlers.get(eventType)!.add(handler);
  }

  off(eventType: DatabaseEventType, handler: (e: DatabaseEvent) => void): void {
    this._eventHandlers.get(eventType)?.delete(handler);
  }

  emit(eventType: DatabaseEventType, payload?: unknown): void {
    const handlers = this._eventHandlers.get(eventType);
    if (!handlers) return;
    const event: DatabaseEvent = { type: eventType, timestamp: new Date(), payload };
    for (const h of handlers) { h(event); }
  }
}
