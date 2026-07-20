/**
 * Sprint 23.2 — DatabaseEngine Test Suite
 * Run: npx ts-node packages/core/src/test-database.ts
 */

import { DatabaseBuilder }   from "./database/DatabaseBuilder";
import { DatabaseValidator } from "./database/DatabaseValidator";
import { DatabaseEngine }    from "./database/DatabaseEngine";
import { DatabaseState }     from "./database/DatabaseState";
import { DatabaseProvider }  from "./database/DatabaseProvider";
import { DatabaseEventType } from "./database/DatabaseEventType";
import { CachePolicy }       from "./database/CachePolicy";
import { MigrationState }    from "./database/MigrationState";
import { TransactionState }  from "./database/TransactionState";

// ─── Minimal context ──────────────────────────────────────────────────────────
const ctx = { env: "test", namespace: "shaily-studio" };

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function run(): Promise<void> {
  console.log("\n=== START SPRINT 23.2 DATABASE ENGINE TESTS ===\n");

  // 1. Builder Validation
  console.log("1. Builder Validation...");
  const engine = new DatabaseBuilder()
    .withContext(ctx)
    .withProvider(DatabaseProvider.SQLITE)
    .withFilePath(":memory:")
    .withCachePolicy(CachePolicy.READ_THROUGH)
    .build() as DatabaseEngine;
  assert(engine !== undefined, "DatabaseEngine built successfully");

  // 2. Lifecycle Transitions
  console.log("2. Lifecycle Transitions...");
  assert(engine.getState() === DatabaseState.CREATED, "Initial state is CREATED");
  await engine.initialize();
  assert(
    engine.getState() === DatabaseState.DISCONNECTED,
    "State after initialize() is DISCONNECTED"
  );

  // 3. SQLite Connection
  console.log("3. SQLite Connection...");
  await engine.connect();
  assert(engine.getState() === DatabaseState.READY, "SQLite READY after connect()");

  // 4. PostgreSQL Connection (provider switch)
  console.log("4. PostgreSQL Connection...");
  const pgEngine = new DatabaseBuilder()
    .withContext(ctx)
    .withProvider(DatabaseProvider.POSTGRESQL)
    .withHost("localhost")
    .withPort(5432)
    .withDatabase("shaily_db")
    .build() as DatabaseEngine;
  await pgEngine.initialize();
  await pgEngine.connect();
  assert(pgEngine.getState() === DatabaseState.READY, "PostgreSQL engine READY");

  // 5. Qdrant Connection
  console.log("5. Qdrant Connection...");
  const qdEngine = new DatabaseBuilder()
    .withContext(ctx)
    .withProvider(DatabaseProvider.QDRANT)
    .withUrl("http://localhost:6333")
    .build() as DatabaseEngine;
  await qdEngine.initialize();
  await qdEngine.connect();
  assert(qdEngine.getState() === DatabaseState.READY, "Qdrant engine READY");

  // 6. Connection Pool
  console.log("6. Connection Pool...");
  const pool = engine.getConnectionManager().getPool();
  assert(pool !== undefined, "Connection pool exists");
  assert((pool?.activeCount ?? 0) >= 1, "Pool has active connection");

  // 7. Transaction Management
  console.log("7. Transaction Management...");
  const connections = engine.getConnectionManager().listConnections();
  const tx = await engine.getTransactionManager().beginTransaction(connections[0].id);
  assert(tx.state === TransactionState.ACTIVE, "Transaction is ACTIVE");

  // 8. Commit Transaction
  console.log("8. Commit Transaction...");
  await engine.getTransactionManager().commitTransaction(tx.id);
  const committed = engine.getTransactionManager().getTransaction(tx.id);
  assert(committed?.state === TransactionState.COMMITTED, "Transaction COMMITTED");

  // 9. Rollback Transaction
  console.log("9. Rollback Transaction...");
  const tx2 = await engine.getTransactionManager().beginTransaction(connections[0].id);
  await engine.getTransactionManager().rollbackTransaction(tx2.id);
  assert(
    engine.getTransactionManager().getTransaction(tx2.id)?.state === TransactionState.ROLLED_BACK,
    "Transaction ROLLED_BACK"
  );

  // 10. Migration Runner
  console.log("10. Migration Runner...");
  const migrations = engine.getMigrationManager().listMigrations();
  const applied = engine.getMigrationManager().getAppliedMigrations();
  assert(migrations.length >= 3, `At least 3 migrations registered (${migrations.length})`);
  assert(applied.length === migrations.length, "All migrations applied");

  // 11. Query Execution
  console.log("11. Query Execution...");
  const resp = await engine.getQueryManager().execute({
    id: "q-001", sql: "SELECT * FROM events", params: []
  });
  assert(resp !== undefined, "Query response returned");
  assert(resp.requestId === "q-001", "Query response ID matches");

  // 12. Cache Manager
  console.log("12. Cache Manager...");
  const cached = await engine.getQueryManager().execute({
    id: "q-001", sql: "SELECT * FROM events", params: []
  });
  assert(cached.fromCache === true, "Second identical query served from cache");

  // 13. Backup Creation
  console.log("13. Backup Creation...");
  const backup = await engine.getBackupManager().createBackup("./test-backup.db");
  assert(backup.id.startsWith("bkp-"), "Backup snapshot created");
  assert(backup.checksum.startsWith("sha256-"), "Backup has checksum");

  // 14. Database Restore
  console.log("14. Database Restore...");
  const restoreReport = await engine.getRestoreManager().restore(backup.id);
  assert(restoreReport.success === true, "Restore succeeded");
  assert(restoreReport.snapshotId === backup.id, "Restore references correct backup");

  // 15. Health Monitoring
  console.log("15. Health Monitoring...");
  const health = await engine.getHealthManager().checkHealth();
  assert(health.score > 0, `Health score > 0 (${health.score})`);
  assert(health.state === DatabaseState.READY, "Health state is READY");

  // 16. Runtime Integration
  console.log("16. Runtime Integration...");
  const snapshot = engine.getSnapshot();
  assert(snapshot.state === DatabaseState.READY, "Snapshot state is READY");
  assert(Object.isFrozen(snapshot), "Snapshot is immutable (deepFrozen)");

  // 17. Event Publishing
  console.log("17. Event Publishing...");
  let eventFired = false;
  engine.on(DatabaseEventType.CACHE_INVALIDATED, () => { eventFired = true; });
  engine.getCacheManager().invalidate();
  assert(eventFired, "CACHE_INVALIDATED event published");

  // 18. Snapshot Immutability
  console.log("18. Snapshot Immutability...");
  const snap2 = engine.getSnapshot();
  let threw = false;
  try { (snap2 as any).state = "MUTATED"; } catch { threw = true; }
  assert(threw || snap2.state === DatabaseState.READY, "Snapshot cannot be mutated");

  // 19. Validator Rules
  console.log("19. Validator Rules...");
  let validationThrew = false;
  try {
    DatabaseValidator.validateConfiguration({ provider: DatabaseProvider.SQLITE });
  } catch {
    validationThrew = true;
  }
  assert(validationThrew, "Validation rejects SQLite config missing filePath");

  const report = DatabaseValidator.generateReport({
    provider: DatabaseProvider.SQLITE,
    filePath: "./test.db"
  });
  assert(report.valid, "Valid config produces VALID report");

  // 20. Complete End-to-End Lifecycle
  console.log("20. Complete End-to-End Database Lifecycle...");
  const stats = engine.getStatisticsManager().getStatistics();
  assert(stats.totalQueries >= 1, `Total queries tracked (${stats.totalQueries})`);
  assert(stats.committedTransactions >= 1, "Committed transactions tracked");
  assert(stats.totalBackups >= 1, "Backups tracked");
  assert(stats.totalRestores >= 1, "Restores tracked");
  assert(stats.totalMigrationsApplied >= 3, "Migrations tracked");
  await engine.disconnect();
  assert(engine.getState() === DatabaseState.DISCONNECTED, "Final state DISCONNECTED");

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n=== ${passed}/${passed + failed} DATABASE ENGINE TESTS PASSED ${failed === 0 ? "SUCCESSFULLY" : `— ${failed} FAILED`} ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
