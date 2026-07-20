import { DatabaseValidationResult } from "./DatabaseValidationResult";
import { DatabaseProvider }         from "./DatabaseProvider";
import { CachePolicy }              from "./CachePolicy";
import {
  DatabaseConfiguration,
  Transaction,
  Migration,
  QueryRequest,
  CacheEntry,
  BackupSnapshot,
  DatabaseSnapshot,
  ValidationIssue,
  ValidationReport
} from "./models";
import { DatabaseValidationException } from "./types";

export class DatabaseValidator {

  // ─── 1. Connection Configuration ─────────────────────────────────────────────
  public static validateConfiguration(config: DatabaseConfiguration): void {
    if (!config) {
      throw new DatabaseValidationException("DatabaseConfiguration is required.");
    }
    if (!config.provider) {
      throw new DatabaseValidationException("DatabaseConfiguration.provider is required.");
    }
    if (config.provider === DatabaseProvider.SQLITE && !config.filePath) {
      throw new DatabaseValidationException("SQLite provider requires a filePath.");
    }
    if (config.provider === DatabaseProvider.POSTGRESQL) {
      if (!config.host && !config.url) {
        throw new DatabaseValidationException("PostgreSQL provider requires host or url.");
      }
    }
    if (config.provider === DatabaseProvider.QDRANT) {
      if (!config.url && !config.host) {
        throw new DatabaseValidationException("Qdrant provider requires url or host.");
      }
    }
    if (config.poolSize !== undefined && config.poolSize < 1) {
      throw new DatabaseValidationException("poolSize must be >= 1.");
    }
    if (config.maxConnections !== undefined && config.maxConnections < 1) {
      throw new DatabaseValidationException("maxConnections must be >= 1.");
    }
  }

  // ─── 2. Transaction Integrity ─────────────────────────────────────────────────
  public static validateTransaction(transaction: Transaction): void {
    if (!transaction) {
      throw new DatabaseValidationException("Transaction is required.");
    }
    if (!transaction.id) {
      throw new DatabaseValidationException("Transaction.id is required.");
    }
    if (!transaction.connectionId) {
      throw new DatabaseValidationException("Transaction.connectionId is required.");
    }
  }

  // ─── 3. Migration Ordering ────────────────────────────────────────────────────
  public static validateMigrationOrder(migrations: Migration[]): void {
    const sorted = [...migrations].sort((a, b) => a.version - b.version);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].version <= sorted[i - 1].version) {
        throw new DatabaseValidationException(
          `Migration versions must be strictly ascending. Conflict at version ${sorted[i].version}.`
        );
      }
    }
  }

  // ─── 4. Duplicate Migrations ──────────────────────────────────────────────────
  public static validateNoDuplicateMigrations(migrations: Migration[]): void {
    const seen = new Set<number>();
    for (const m of migrations) {
      if (seen.has(m.version)) {
        throw new DatabaseValidationException(`Duplicate migration version detected: ${m.version}.`);
      }
      seen.add(m.version);
    }
  }

  // ─── 5. Rollback Validation ───────────────────────────────────────────────────
  public static validateMigrationRollback(migration: Migration): void {
    if (!migration.downSql) {
      throw new DatabaseValidationException(
        `Migration version ${migration.version} does not have a rollback (downSql) script.`
      );
    }
  }

  // ─── 6. Query Validation ──────────────────────────────────────────────────────
  public static validateQueryRequest(request: QueryRequest): void {
    if (!request) {
      throw new DatabaseValidationException("QueryRequest is required.");
    }
    if (!request.id) {
      throw new DatabaseValidationException("QueryRequest.id is required.");
    }
    if (!request.sql && !request.collection) {
      throw new DatabaseValidationException("QueryRequest must have either sql or collection.");
    }
  }

  // ─── 7. Cache Consistency ─────────────────────────────────────────────────────
  public static validateCacheEntry(entry: CacheEntry): void {
    if (!entry || !entry.key) {
      throw new DatabaseValidationException("CacheEntry.key is required.");
    }
    if (entry.policy === CachePolicy.TTL && entry.expiresAt === undefined) {
      throw new DatabaseValidationException("TTL cache policy requires expiresAt to be set.");
    }
  }

  // ─── 8. Backup Integrity ──────────────────────────────────────────────────────
  public static validateBackupSnapshot(snapshot: BackupSnapshot): void {
    if (!snapshot) {
      throw new DatabaseValidationException("BackupSnapshot is required.");
    }
    if (!snapshot.id) {
      throw new DatabaseValidationException("BackupSnapshot.id is required.");
    }
    if (!snapshot.checksum) {
      throw new DatabaseValidationException("BackupSnapshot.checksum is required.");
    }
    if (!snapshot.filePath) {
      throw new DatabaseValidationException("BackupSnapshot.filePath is required.");
    }
    if (snapshot.sizeBytes <= 0) {
      throw new DatabaseValidationException("BackupSnapshot.sizeBytes must be > 0.");
    }
  }

  // ─── 9. Restore Compatibility ─────────────────────────────────────────────────
  public static validateRestoreCompatibility(snapshot: BackupSnapshot, targetProvider: DatabaseProvider): void {
    if (snapshot.provider !== targetProvider) {
      throw new DatabaseValidationException(
        `Cannot restore a ${snapshot.provider} backup onto a ${targetProvider} provider.`
      );
    }
  }

  // ─── 10. Snapshot Immutability ────────────────────────────────────────────────
  public static validateSnapshotImmutability(snapshot: DatabaseSnapshot): void {
    if (!snapshot) {
      throw new DatabaseValidationException("DatabaseSnapshot is required.");
    }
    if (!snapshot.timestamp) {
      throw new DatabaseValidationException("DatabaseSnapshot.timestamp is required.");
    }
  }

  // ─── Comprehensive Report ─────────────────────────────────────────────────────
  public static generateReport(config: DatabaseConfiguration): ValidationReport {
    const issues: ValidationIssue[] = [];

    const check = (rule: string, fn: () => void) => {
      try {
        fn();
        issues.push({ rule, result: DatabaseValidationResult.VALID, message: "OK" });
      } catch (err: any) {
        issues.push({ rule, result: DatabaseValidationResult.INVALID, message: err.message });
      }
    };

    check("connection-config",   () => DatabaseValidator.validateConfiguration(config));
    check("pool-size-warning",   () => {
      if (config.poolSize && config.poolSize > 50) {
        issues.push({ rule: "pool-size-warning", result: DatabaseValidationResult.WARNING, message: "poolSize > 50 may impact performance." });
      }
    });

    return {
      timestamp: new Date(),
      valid: issues.every(i => i.result !== DatabaseValidationResult.INVALID),
      issues
    };
  }
}
