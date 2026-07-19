import React, { useState } from "react";
import { useDesktopStore } from "../store";
import { Folder, File, FolderOpen, ShieldCheck, Database, HardDrive } from "lucide-react";

export default function Workspace() {
  const { selectedWorkspace, setSelectedWorkspace, activeProject } = useDesktopStore();
  const [loading, setLoading] = useState(false);

  const handleSelectFolder = async () => {
    setLoading(true);
    try {
      const path = await window.electronAPI.invoke("select-directory");
      if (path) {
        setSelectedWorkspace(path);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Mock tree structure for display when selected
  const filesTree = [
    { name: "apps", type: "dir", children: [
      { name: "api", type: "dir" },
      { name: "desktop", type: "dir" },
      { name: "web", type: "dir" }
    ]},
    { name: "packages", type: "dir", children: [
      { name: "core", type: "dir" },
      { name: "shared", type: "dir" },
      { name: "ui", type: "dir" }
    ]},
    { name: "storage", type: "dir", children: [
      { name: "backups", type: "dir" },
      { name: "media_cache", type: "dir" }
    ]},
    { name: "package.json", type: "file" },
    { name: "pnpm-workspace.yaml", type: "file" },
    { name: "README.md", type: "file" }
  ];

  const renderTree = (nodes: any[], depth = 0) => {
    return nodes.map((node, idx) => (
      <div key={idx} style={{ marginLeft: `${depth * 16}px` }}>
        <div className="tree-node">
          {node.type === "dir" ? (
            <Folder size={14} className="text-violet" />
          ) : (
            <File size={14} className="text-secondary" />
          )}
          <span>{node.name}</span>
        </div>
        {node.children && renderTree(node.children, depth + 1)}
      </div>
    ));
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px" }}>
      {/* File Tree Explorer Column */}
      <div className="glass-card">
        <div className="card-header">
          <h3 className="card-title">
            <FolderOpen size={16} className="text-violet" />
            <span>WorkspaceEngine Directory Tree</span>
          </h3>
        </div>
        <div className="card-content">
          {selectedWorkspace ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ padding: "8px 12px", backgroundColor: "rgba(0,0,0,0.3)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", fontSize: "11px", wordBreak: "break-all" }}>
                <strong>Active Root:</strong> {selectedWorkspace}
              </div>
              <div className="workspace-explorer" style={{ maxHeight: "360px", overflowY: "auto", border: "1px solid rgba(255,255,255,0.03)", borderRadius: "var(--radius-md)", padding: "12px", backgroundColor: "rgba(0,0,0,0.15)" }}>
                {renderTree(filesTree)}
              </div>
              <button className="btn btn-outline btn-sm" onClick={handleSelectFolder} disabled={loading} style={{ alignSelf: "flex-start" }}>
                Switch Directory Root
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                No active workspace folder selected. Direct WorkspaceEngine to your project repository.
              </p>
              <button className="btn btn-primary" onClick={handleSelectFolder} disabled={loading}>
                Open Project Directory
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Workspace Statistics and Meta column */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Workspace Details card */}
        <div className="glass-card">
          <div className="card-header">
            <h3 className="card-title">
              <Database size={16} className="text-cyan" />
              <span>Project Metadata</span>
            </h3>
          </div>
          <div className="card-content" style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.8rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Selected Project:</span>
              <span style={{ fontWeight: 600 }}>{activeProject}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Total Indexed Files:</span>
              <span style={{ fontWeight: 600 }}>182</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Project Format:</span>
              <span style={{ fontWeight: 600 }}>Shaily Monorepo (pnpm)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Media Cache Size:</span>
              <span style={{ fontWeight: 600 }}>1.4 GB</span>
            </div>
          </div>
        </div>

        {/* Security & Backup status */}
        <div className="glass-card" style={{ flexGrow: 1 }}>
          <div className="card-header">
            <h3 className="card-title">
              <ShieldCheck size={16} className="text-emerald" />
              <span>Local Storage & Backup</span>
            </h3>
          </div>
          <div className="card-content" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <HardDrive size={18} className="text-cyan" />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 600, fontSize: "12px" }}>Auto-backup Status</span>
                <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>Daily backup active</span>
              </div>
            </div>

            <hr style={{ borderColor: "rgba(255,255,255,0.05)" }} />

            <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              All database schemas are stored locally in SQLite / PostgreSQL container structures. Video compilations are cached locally at `storage/media_cache/` to minimize API latency.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
