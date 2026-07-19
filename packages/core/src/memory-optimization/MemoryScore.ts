export enum MemoryScore {
  CRITICAL = "CRITICAL",   // Must never be removed
  HIGH = "HIGH",           // Frequently accessed, high value
  MEDIUM = "MEDIUM",       // Normal retention
  LOW = "LOW",             // Rarely accessed
  STALE = "STALE",         // Candidate for archiving
  EXPIRED = "EXPIRED",     // Candidate for deletion
}
