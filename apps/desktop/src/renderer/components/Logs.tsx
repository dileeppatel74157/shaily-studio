import React, { useState } from "react";
import { useDesktopStore, LogItem } from "../store";
import { Trash2, Download, Search } from "lucide-react";

export default function Logs() {
  const { logs, clearLogs } = useDesktopStore();
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleExportLogs = () => {
    window.electronAPI.send("export-logs");
  };

  // Helper to determine active log category
  const matchesCategory = (log: LogItem) => {
    if (filter === "all") return true;
    if (filter === "error") return log.type === "error" || log.type === "warn";
    return log.category.toLowerCase() === filter;
  };

  const filteredLogs = logs.filter((log) => {
    const matchesCat = matchesCategory(log);
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="glass-card logs-panel" style={{ height: "calc(100vh - 160px)" }}>
      {/* Logs Header toolbar */}
      <div className="card-header" style={{ paddingBottom: "12px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <h3 className="card-title">System Shell Terminal</h3>
          <span style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            Live execution log pipelines
          </span>
        </div>
        <div className="logs-toolbar" style={{ marginBottom: 0 }}>
          {/* Category Tabs */}
          <div className="logs-filters">
            <button
              className={`filter-tab ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All Logs
            </button>
            <button
              className={`filter-tab ${filter === "runtime" ? "active" : ""}`}
              onClick={() => setFilter("runtime")}
            >
              Runtime
            </button>
            <button
              className={`filter-tab ${filter === "pipeline" ? "active" : ""}`}
              onClick={() => setFilter("pipeline")}
            >
              Pipeline
            </button>
            <button
              className={`filter-tab ${filter === "assistant" ? "active" : ""}`}
              onClick={() => setFilter("assistant")}
            >
              Assistant
            </button>
            <button
              className={`filter-tab ${filter === "error" ? "active" : ""}`}
              onClick={() => setFilter("error")}
            >
              Faults/Warnings
            </button>
          </div>

          {/* Search query input */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={12} style={{ position: "absolute", left: "10px", opacity: 0.4 }} />
            <input
              type="text"
              placeholder="Search shell logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="logs-search"
              style={{ paddingLeft: "28px" }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-outline btn-sm" onClick={handleExportLogs}>
              <Download size={12} />
              <span>Export</span>
            </button>
            <button className="btn btn-danger btn-sm" onClick={clearLogs}>
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>

      {/* Actual Logs Console screen */}
      <div className="card-content" style={{ flexGrow: 1, padding: "16px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div className="logs-console" style={{ flexGrow: 1 }}>
          {filteredLogs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>
              No log messages matching criteria. Trigger engine tasks to stream logs.
            </div>
          ) : (
            filteredLogs.map((log, idx) => (
              <div key={idx} className="log-line">
                <span className="log-time">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className="log-category">[{log.category.toUpperCase()}]</span>
                <span className={`log-msg-text log-${log.type}`}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
